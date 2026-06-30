# MRR Movement: domain backfill reclassification

Date: 2026-06-30
Status: Approved (design)

## Problem

In events mode, the MRR movement breakdown labels a domain as "new" the first
time the daily snapshot diff (`mrr_movement_events`) observes it in the active
set. When a long-standing domain is absent from the synced active set for a
while (incremental-sync coverage gaps) and a later sync finally includes it, the
diff engine has no prior record of it and emits a spurious `new` event.

Verified in prod (project Mrrlytics), since the snapshot cold-start (~2026-05-30,
~1 month of data): of 32 domain `new` events (33.38 EUR), 6 are backfills
(6.00 EUR, ~18%). They are 3 unique domains counted twice because one WHMCS feeds
two tenants (Naranjatec + NextGenWebs):

- marietadgp.com (registered 2011, observed 2026-06-01) 1.19 EUR
- marietadgp.es (registered 2011, observed 2026-06-01) 0.63 EUR
- universalpesca.com (registered 2014, observed 2026-06-29) 1.19 EUR

The split is clean: real new domains observed within 0-44 days of registration;
backfills 4434-5487 days (12-15 years). No ambiguous middle.

Economically these are not new sales; they are pre-existing MRR the pipeline
finally captured. Showing them as "new" pollutes the new-customer narrative
(~1 in 6 of the domains shown as new is not real).

## Goal

Stop showing old, pre-existing domains as new in the events-mode MRR movement
breakdown, without breaking the reconciliation guard or the conservation
identity, and without adding a new breakdown category or dashboard UI.

## Constraints

- The events-mode breakdown enforces
  `ending = starting + new + reactivation + expansion - contraction - churned`.
- A reconciliation guard requires `sum(event deltas) ~= metrics_daily delta`
  (tolerance 0.02). The backfill amount IS reflected in `metrics_daily` (the
  domain row entered the DB and the live KPI picked it up), so the event delta
  cannot simply be removed: doing so would fail the guard and drop the whole
  month to proxy mode, losing the events breakdown.
- Therefore the amount must be RECLASSIFIED, not deleted.

## Decision

Fold the backfill amount into the starting MRR (chosen by user over a dedicated
"adjustments" bucket). The backfill amount leaves `new_mrr` and is added to
`starting_mrr`; `net_events` (guard input) keeps all deltas; `ending` is
unchanged. Reads as "this domain was already there."

Accepted tradeoff: a month's displayed starting MRR no longer equals the raw
`metrics_daily` start anchor exactly when that month has backfills (a cosmetic
seam between consecutive months' ending -> starting). Backfills are sporadic, so
most months show starting == anchor.

## Scope

- Domains only (the `registrationdate` signal). Hosting/billable could have the
  same class of artifact but are not addressed here (out of scope, follow-up).
- Events mode only. Proxy mode never produces this false-new: a still-Active old
  domain evaluates `wasActive = true`, so it is not counted as new.

## Design

Single source of truth: `backend/src/lib/metrics/movement-hybrid.ts`. Both
consumers inherit the fix:

- `GET /api/metrics/mrr-movement` (pill) reads events-mode figures entirely from
  `decision.breakdown`.
- `GET /api/metrics/mrr-movement/items` (drilldown) iterates `decision.events`.

### 1. Threshold

`BACKFILL_MIN_AGE_DAYS = 365`. A domain `new` event is a backfill when
`observed_date - registrationdate > 365 days`. Rationale: a domain first
observed by us more than a year after its registration is almost certainly
pre-existing, not a fresh sale. Caveat: a real transfer-in of a domain
registered years ago would also be folded into starting (hidden from new); none
exist in current data (backfills are 12-15 years old), and 365 days keeps the
risk of hiding a recent transfer low.

### 2. Detection (`resolveOneMonth`)

After `fetchEvents`, collect the domain `entity_id`s of `event_type === 'new'`
events, query `whmcs_domains` for their `registrationdate` (scoped to the
instance), and mark each such `EventRow` with `is_backfill` when the event's
`observed_date - registrationdate > BACKFILL_MIN_AGE_DAYS`. A pure helper
`isDomainBackfill(observedDate, registrationDate)` encodes the rule.

`EventRow` gains an optional `is_backfill?: boolean` field.

### 3. Reclassification (`summarizeEvents`)

`summarizeEvents` accumulates a separate `backfill_mrr` (sum of deltas of `new`
events flagged `is_backfill`); `new_mrr` excludes them. `net_events` continues
to sum ALL deltas (including backfills), so the guard is unaffected.

### 4. Fold into starting (`resolveOneMonth`)

```
breakdown.starting_mrr = anchors.mrrStart + s.backfill_mrr
breakdown.new_mrr      = s.new_mrr            // real new only
// net_change recomputed from the displayed components; ending unchanged.
```

Identity check (full precision): with `starting' = mrrStart + backfill` and
`new' = new_incl_backfill - backfill`,
`starting' + new' + rea + exp + con - chu = mrrStart + new_incl_backfill + ... = ending`.
Unchanged.

### 5. Items endpoint

In `mrr-movement/items/route.ts`, in the events-mode branch for `type === 'new'`,
skip events with `is_backfill === true`. (Other types unaffected; proxy branch
unaffected.)

`resolveChurnWindow` is not modified: it reads only `churned_mrr` and
`net_events`, both unaffected. In that path `is_backfill` is never set, so
`backfill_mrr` is 0 there.

## Verification

Follows the existing convention for this module (see the mrr-movement-hybrid
plan): no automated test runner is added; verification is `tsc --noEmit` +
`eslint` + reconciliation against prod via the Supabase MCP.

- Compile + lint clean.
- Reconciliation (prod, real events): for the affected instances and June 2026,
  confirm the month still resolves to events mode (guard still passes: the
  backfill delta stays in `net_events`), and that `starting_mrr` rises by the
  backfill total while `new_mrr` drops by the same and `ending_mrr` is unchanged.
- Items: `type=new` for June no longer lists universalpesca.com / marietadgp.*.
- Guard-preservation logic (backfill stays in `net_events`, leaves `new_mrr`) is
  validated by replicating the resolver math over the real June events in SQL
  before/after, since the amount and identities are exactly reproducible.

## Rollout

- Backend logic only; no schema change, no migration.
- User-visible effect (the "new" pill drops and starting rises), so add a
  dashboard changelog entry (en/es) and bump the dashboard version per project
  convention, even though no dashboard code changes. Decided: include changelog +
  version bump.

## Out of scope / follow-ups

- Root cause: make the daily full-sync of domains reliable so the active set has
  no coverage gaps (eliminates the backfill source).
- Extending the same reclassification to hosting/billable if dimensioning shows
  it matters there.
