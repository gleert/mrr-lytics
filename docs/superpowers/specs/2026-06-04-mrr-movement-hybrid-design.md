# MRR Movement Hybrid — Gated Cutover from Date Proxies to Observed Events

**Date:** 2026-06-04
**Status:** Approved design, pending implementation plan
**Scope:** Backend only (`backend/`). No migration, no RLS/grant changes, no dashboard changes.

## Context

The daily per-entity MRR snapshot infrastructure (migration `00055`, `lib/metrics/active-set.ts`,
`lib/metrics/movement-snapshot.ts`, read endpoint `/api/metrics/mrr-movement-events`) was deployed to
prod on 2026-05-29. It diffs the active set day-over-day and records **observed** movement events
(`new` / `churn` / `expansion` / `contraction` / `reactivation`) into `mrr_movement_events`, with
per-entity current state in `entity_mrr_state`. Money columns are `NUMERIC(14,6)` so sums reconcile
with the full-precision MRR KPI to the cent.

Three production consumers still compute movement/churn from **fragile date proxies** (hosting
`terminationdate`/`nextduedate`, billable `cancelled_at`/`duedate`, domain `expirydate`), and hardcode
`expansion`/`contraction` to `0` because there is no price history:

- `backend/src/app/api/metrics/mrr-movement/route.ts` — monthly waterfall series (default 6 months)
- `backend/src/app/api/metrics/mrr-movement/items/route.ts` — `new`/`churned` drill-down list
- `backend/src/lib/metrics/churn.ts` — churn KPI (rolling N-day window, RPC `calculate_churn`)

This design migrates all three to a **gated hybrid** that auto-activates per instance/window once the
observed data is mature and reconciles, and otherwise falls back to the existing proxy path. The proxy
path is preserved verbatim as a safety net.

## Goals

- **Exact reconciliation is the top priority.** Events-mode figures anchor to `metrics_daily` so the
  waterfall matches the live MRR KPI to the cent, drill-down list totals match their pills, and any
  month that does not reconcile within €0.01 falls back to proxy rather than show approximate numbers.
- Serve movement/churn from observed events where the data is trustworthy; keep proxies elsewhere.
- **Zero regression on deploy**: with the gate active, everything falls to proxy today (first
  events-eligible month ≈ July 2026), so prod behavior is byte-identical until maturity.
- Auto-activation with no cron flip and no manual flag — a runtime maturity gate plus a reconciliation
  guard that self-heals when a late sync corrects a drift.
- Detect `expansion`/`contraction` (impossible with proxies) once on the events path.

## Non-Goals (separate pending items)

- Dashboard "observed data" badge consuming the new `source` field.
- Drill-down for `expansion` / `contraction` / `reactivation` items.
- Seeding the Demo instance (auto-seeds on next full sync; synthetic, low stakes).
- pg_cron fallback for the snapshot + event pruning.

## Architecture (Approach A — shared resolver, gate+guard computed on read)

**New module:** `backend/src/lib/metrics/movement-hybrid.ts`. Read-only over `mrr_movement_events`,
`metrics_daily`, and `entity_mrr_state`. Does **not** touch the snapshot infra.

Two public resolvers over shared private primitives:

- `resolveMonthlyMovement(instanceIds, monthKey)` — for `mrr-movement` and `items`. Returns, per
  instance: `{ mode: 'events' | 'proxy', reason, starting_mrr, new_mrr, reactivation_mrr,
  churned_mrr, expansion_mrr, contraction_mrr, ending_mrr, net_change }` (events-mode populated from
  events; proxy-mode left for the caller to fill from its existing path — see Integration).
- `resolveChurnWindow(instanceIds, periodStart, periodEnd)` — for `churn.ts`. Returns, per instance:
  `{ mode, reason, churned_mrr, active_mrr_start }`.

**Private primitives** (module-internal, unit-tested with injectable fixtures):

- `firstObservedDate(instanceId)` — cold-start/seed date from `entity_mrr_state` (min `first_seen_active`)
  or events. Null ⇒ never eligible.
- `isMatureFor(instanceId, windowStart)` — 30-day maturity gate (below).
- `reconcileGuard(instanceId, start, end)` — €0.01 conservation guard vs `metrics_daily` (below).
- `aggregateEvents(instanceId, start, end)` — sums event deltas per type at full `NUMERIC(14,6)`
  precision (no pre-rounding).

**Granularity decision — gate+guard evaluated PER INSTANCE.** The aggregate sums each instance's
chosen-mode contribution (events if mature+guard-OK, else that instance's proxy path). This prevents
the later-seeded synthetic **Demo** instance from blocking events mode for the real instances. Each
per-instance contribution is internally consistent, so the aggregate `ending_mrr` still reconciles
with total live MRR.

## Gate & Guard semantics

### Maturity gate (30 days)

Per instance, a window `[start, end)` is **eligible** for events mode iff:

```
start >= firstObservedDate(instance) + 30 days
```

- Real instances (seed ≈ 2026-05-30) → threshold ≈ **2026-06-29**. First events-servable **calendar
  month** = **July 2026** (`monthStart = 2026-07-01 ≥ 2026-06-29`). June and earlier → proxy. Clean
  month-level boundary, no intra-month mixing.
- **Churn** (rolling window): `[now − periodDays, now)` eligible only when
  `now − periodDays ≥ firstObserved + 30d`. With the default 30-day period that is ≈ **2026-07-29**
  (first instant a full 30-day window lies entirely past the maturity threshold).

### Conservation guard (full-precision, €0.02 tolerance)

Per instance and window `[start, end)`:

```
netEvents = Σ mrr_delta of ALL events in (dS, dE]   (new + reactivation + expansion + contraction + churn)
netDaily  = metrics_daily.mrr@dE  −  metrics_daily.mrr@dS
guard_ok  = |netEvents − netDaily| < 0.02            // GUARD_TOLERANCE, full precision
```

**Precision note (important, validated against prod 2026-06-04):** event deltas are `NUMERIC(14,6)`
(full precision), but `metrics_daily.mrr` is `DECIMAL(12,2)` — cent-rounded per day (it *is* the
cent-rounded MRR KPI). Each of the two snapshot endpoints (`@dS`, `@dE`) carries up to ±0.005 of
rounding, so `netDaily` (a difference of two rounded endpoints) can differ from the full-precision
`netEvents` by up to ~1 cent **even when the data is perfectly correct**. Prod confirms this: over the
first accrued window the events net was −74.904166 (more precise) while metrics_daily showed −74.91 —
a ~0.6-cent gap of pure accumulated rounding, no real divergence.

Therefore the guard:
- compares at **FULL precision** — `netEvents` is NOT pre-rounded (rounding it to cents would inflate a
  sub-cent gap of 0.006 into a full 0.01 and spuriously fail);
- uses a **€0.02 tolerance** (`GUARD_TOLERANCE`), which absorbs the inherent ±0.01 endpoint rounding
  with margin while staying far below any real movement (the smallest realistic ≈ €0.40/mo for a cheap
  domain), so any genuinely missed movement still trips it.

This satisfies the user's "cuadra al céntimo" intent: events reconcile with metrics_daily to within the
precision metrics_daily can even express. A strict same-cent guard was tried first and proven infeasible
(it would keep the events path dormant forever on benign rounding).

- `metrics_daily.mrr@(start-1)` = MRR at close of the day before the window start (= `starting_mrr` /
  `active_mrr_start`). Aligns with the existing waterfall convention (`prevMonthEnd`). Already cent
  precision, so it is the display value directly.
- Missing `metrics_daily` row at either boundary (snapshot gap) ⇒ `guard_ok = false` ⇒ proxy.
- In events mode, `active_mrr_start` is taken directly from `metrics_daily.mrr@(start-1)` (source of
  truth) — **not** reconstructed from events.

### Anchoring for exact KPI reconciliation (primary goal: data must reconcile as closely as possible)

In events mode, **both** endpoints of the waterfall are anchored to `metrics_daily` (the same source
as the live MRR KPI), never reconstructed by summing events:

```
starting_mrr = metrics_daily.mrr@(start-1)
ending_mrr   = metrics_daily.mrr@(end-1)
```

The event components (`new`, `reactivation`, `expansion`, `contraction`, `churn`) only **bridge**
between these two anchored endpoints. The €0.01 guard guarantees the bridge closes:
`starting + new + reactivation + expansion + contraction − churn == ending` to the cent. If it does
not close, `guard_ok = false` and the instance falls to proxy — so a non-reconciling events month is
never shown.

Two reconciliation guarantees follow:

1. **Exact KPI match**: an events-mode month's `ending_mrr` equals the live MRR card exactly (same
   `metrics_daily` value), not "within €0.01".
2. **Month-to-month continuity**: month M's `ending_mrr` (`metrics_daily@(monthEnd-1)`, i.e. last day
   of M) is the *same* `metrics_daily` row as month M+1's `starting_mrr` (`metrics_daily@(nextStart-1)`),
   so consecutive bars line up with no gap — including across a proxy→events boundary, since the proxy
   path already reconciles its `ending_mrr` to the same KPI.

### Per-window decision (per instance)

```
use events  ⟺  eligible(gate)  AND  guard_ok
otherwise   →  that instance's existing proxy path (untouched, safety net)
```

The guard runs fresh on every request, so a month "heals" itself and flips to events once a late sync
corrects a drift, with no intervention.

`expansion`/`contraction` are non-zero only in events-mode windows; proxy windows keep them at `0`
(no price history). Expected, and surfaced via `source`.

## Integration & response shapes (all additive / backward-compatible)

### `mrr-movement/route.ts` (waterfall, N-month series)

The existing monthly loop stays as the **proxy path**. For each month, and each instance, call
`resolveMonthlyMovement`; sum each instance's chosen contribution. Response keeps the current shape
and adds a `source` block and the new `reactivation_mrr` field:

```jsonc
{
  "movement_data": [
    { "month": "2026-07", "starting_mrr": …, "new_mrr": …, "reactivation_mrr": …,
      "churned_mrr": …, "expansion_mrr": …, "contraction_mrr": …, "ending_mrr": …, "net_change": … }
  ],
  "totals": { "new_mrr": …, "reactivation_mrr": …, "churned_mrr": …,
              "expansion_mrr": …, "contraction_mrr": …, "net_change": … },
  "months": 6,
  "source": {
    "per_month": {
      "2026-06": { "mode": "proxy",  "reason": "immature" },
      "2026-07": { "mode": "events", "reason": "ok" },
      "2026-08": { "mode": "mixed",  "reason": "demo_immature",
                   "per_instance": { "077859e0…": "events", "fc7fde1c…": "proxy" } }
    }
  }
}
```

- `net_change` = `new + reactivation + expansion + contraction − churn`.
- `mode` per month: `events` (all instances on events), `proxy` (all on proxy), `mixed` (combination).
- The dashboard can ignore `source` / `reactivation_mrr` (non-breaking) or adopt them later.

### `mrr-movement/items/route.ts` (`new` / `churned` drill-down)

Per instance and month: events-mode instances source items from `mrr_movement_events`
(`?type=new` → event type `new` ONLY; `?type=churned` → event type `churn`), hydrating display
metadata (`client_name`, `description`, `billing_cycle`) from the `whmcs_*` tables via
`entity_id = whmcs_id`. Proxy-mode instances use the existing path. The two lists are concatenated.
`reference_date` in events mode = `effective_date ?? observed_date`. Same response shape + a `source`
summary for the queried month.

- **`reactivation` is excluded from the `new` list** (user decision). Therefore `new_mrr` in events
  mode also excludes reactivations, so the list total matches the `new_mrr` pill exactly. Reactivation
  has its own `reactivation_mrr` field for conservation; a reactivation drill-down is out of scope.
- Boundary note: in **proxy** months an inactive→active reactivation falls implicitly inside `new_mrr`
  (date logic can't distinguish); in **events** months it is separated. Minor, month-bounded semantic
  shift; events is the more correct view.
- Scope: items still serves only `new` / `churned`.
- **Pill ↔ list reconciliation**: items derives its per-instance mode from the *same*
  `resolveMonthlyMovement` decision as the waterfall, so the drill-down list total matches the pill
  exactly — events-mode `new` list sum == `new_mrr`, `churned` list sum == `churned_mrr`. The only way
  they can disagree is a sync flipping the guard between the two separate HTTP requests; that window is
  transient and self-corrects on the next refresh (documented, not engineered around).

### `churn.ts` (`calculateChurn`, `calculateChurnMultiInstance`)

Per instance: if `resolveChurnWindow` ⇒ `events`, `churned_mrr` = Σ `churn` event deltas in the window
(positive magnitude), `active_mrr_start` = `metrics_daily.mrr@(start-1)`. If `proxy`, the existing RPC
`calculate_churn`. The existing MRR-weighted aggregation (`Σchurned / Σactive_start`) is unchanged —
only the source of each per-instance summand changes. `ChurnMetrics` gains an optional
`source?: { mode, per_instance }`.

## Edge cases

- **Snapshot gap** (missing `metrics_daily` boundary row): `guard_ok = false` → proxy.
- **Uneven maturity** (Demo immature): per-instance mode selection; aggregate = `mixed`, detailed in
  `source.per_instance`.
- **Current partial month**: gate requires `monthStart ≥ firstObserved + 30d`; the in-progress month
  typically stays on proxy until it qualifies. Proxy path already caps `monthEnd` at "now" — no
  regression.
- **Instance with no events / no seed**: `firstObservedDate` null → never eligible → proxy.
- **`metrics_daily.mrr` vs `active-set`**: already verified 0.00 on all three instances, so the €0.01
  guard should not false-trip under normal conditions.

## Testing

- **Unit (helper)** with injectable fixtures (no network): gate (before/after threshold); guard
  (reconciles / €0.02 drift → proxy / missing boundary row → proxy); `aggregateEvents` (full precision,
  correct signs); per-instance selection (mixed).
- **Reconciliation** (primary): for a synthetic events-month, `starting_mrr` and `ending_mrr` equal the
  anchored `metrics_daily` values **exactly** (not just within the guard tolerance), and
  `starting + new + reactivation + expansion + contraction − churn == ending` to the cent. Also assert
  the items `new`/`churned` list totals equal the corresponding waterfall pills exactly.
- **Shape backward-compat**: all three endpoints return current fields intact; `source` /
  `reactivation_mrr` are additive.
- `npm run lint` + `tsc --noEmit` clean.

## Deployment & safety

- **No migration** (reads existing tables only). No RLS/grant changes.
- Deploy **gated**: in prod today everything falls to proxy (gate ≈ 2026-06-29), behavior identical to
  current → **zero regression** on deploy. Auto-activates only when July matures.
- **Version:** bump backend; no dashboard changelog (internal change, not user-facing yet — the
  "observed data" badge is a separate PR).
- **Post-deploy validation** (via Supabase MCP): confirm `mrr-movement` still returns today's numbers
  (all months `proxy`) and inspect `source`.
