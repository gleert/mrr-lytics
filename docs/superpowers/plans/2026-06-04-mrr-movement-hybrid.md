# MRR Movement Hybrid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `mrr-movement`, `mrr-movement/items`, and `churn` from fragile date proxies to observed movement events behind a per-instance 30-day maturity gate + cent-equality reconciliation guard, with zero regression on deploy.

**Architecture:** A new read-only module `movement-hybrid.ts` decides per instance/window whether to serve from `mrr_movement_events` (anchored to `metrics_daily` so figures match the live KPI to the cent) or fall back to the existing proxy path. Events only bridge between two `metrics_daily` snapshot anchors `(dS, dE]`; if the bridge does not reconcile to the cent, the instance falls to proxy. The three consumers sum each instance's chosen-mode contribution.

**Tech Stack:** Next.js 16 App Router route handlers, `@supabase/supabase-js` (no ORM), TypeScript. No test runner in this repo — verification is `tsc --noEmit` + `eslint` + post-deploy reconciliation checks against prod via the Supabase MCP (the gate keeps prod on proxy today ⇒ deploy is byte-identical).

**Spec:** `docs/superpowers/specs/2026-06-04-mrr-movement-hybrid-design.md`

---

## Testing approach (decided)

No automated test runner is added. Each task ends with `tsc`/`lint` verification. The final task performs **manual reconciliation validation against prod via the Supabase MCP**: confirm the endpoints still return today's numbers (all months `proxy`) and inspect the new `source` block. The guard + gate guarantee zero behavioral change until July 2026 matures, so a clean `tsc`/`lint` + identical prod output is sufficient verification for deploy.

`tsc` command (run from `backend/`): `npx tsc --noEmit`
`lint` command (run from `backend/`): `npm run lint`

---

## File Structure

- **Create** `backend/src/lib/metrics/movement-hybrid.ts` — pure helpers (`isMature`, `summarizeEvents`, `guardOk`, `round2`) + IO resolvers (`resolveMonthlyMovement`, `resolveChurnWindow`). Single responsibility: the events-vs-proxy decision and the events-mode figures.
- **Modify** `backend/src/app/api/metrics/mrr-movement/route.ts` — per-month, per-instance merge of events vs proxy; add `reactivation_mrr` field + `source` block.
- **Modify** `backend/src/app/api/metrics/mrr-movement/items/route.ts` — events-mode item sourcing from `mrr_movement_events`; add `source`.
- **Modify** `backend/src/lib/metrics/churn.ts` — per-instance events vs RPC proxy in `calculateChurnMultiInstance` and `calculateChurn`; add `source`.
- **Modify** `backend/src/types/api.ts` — add optional `source` to `ChurnMetrics`.

---

## Task 1: Create the `movement-hybrid.ts` resolver module

**Files:**
- Create: `backend/src/lib/metrics/movement-hybrid.ts`

- [ ] **Step 1: Write the full module**

Create `backend/src/lib/metrics/movement-hybrid.ts` with exactly this content:

```ts
/**
 * Movement hybrid resolver.
 *
 * Decides, per instance and time window, whether MRR movement / churn is served
 * from OBSERVED events (mrr_movement_events) or the legacy date-proxy path.
 *
 *  - Gate: a window is events-eligible only once the daily snapshot has been
 *    running for >= MATURITY_DAYS before the window's start (firstObserved + 30d).
 *  - Guard: the events in the window must reconcile to the cent against the
 *    metrics_daily MRR delta between the two snapshot anchors; else proxy.
 *  - Anchoring: starting_mrr / ending_mrr come straight from metrics_daily (the
 *    same source as the live MRR KPI), so events-mode figures match the KPI to
 *    the cent. Events only bridge between the anchors.
 *
 * Read-only. Consumed by mrr-movement, mrr-movement/items, and churn.
 *
 * Window is expressed as the half-open interval of observed_dates (dS, dE], where
 * dS = the latest metrics_daily snapshot strictly before the window start and
 * dE = the latest snapshot at/after the window start and <= the window end. Using
 * real snapshot dates (not calendar dates) makes conservation hold across snapshot
 * gaps and partial current months.
 */
import { createAdminClient } from '@/lib/supabase/admin'

export type EntityType = 'hosting' | 'billable' | 'domain'
export type MovementEventType = 'new' | 'churn' | 'expansion' | 'contraction' | 'reactivation'
export type SourceMode = 'events' | 'proxy'

/** Days the snapshot must have run before a window's start for events to be trusted. */
export const MATURITY_DAYS = 30

const DAY_MS = 86_400_000
export const round2 = (n: number): number => Math.round(n * 100) / 100

/** 'YYYY-MM-DD' -> epoch ms (UTC midnight). */
function parseDay(d: string): number {
  return new Date(d + 'T00:00:00Z').getTime()
}
/** epoch ms -> 'YYYY-MM-DD'. */
function fmtDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export interface EventRow {
  entity_type: EntityType
  entity_id: number
  event_type: MovementEventType
  mrr_before: number
  mrr_after: number
  mrr_delta: number
  observed_date: string
  effective_date: string | null
}

export interface EventsBreakdown {
  starting_mrr: number
  new_mrr: number
  reactivation_mrr: number
  churned_mrr: number      // positive magnitude
  expansion_mrr: number
  contraction_mrr: number  // negative
  ending_mrr: number
  net_change: number
}

export interface MonthlyDecision {
  instance_id: string
  mode: SourceMode
  reason: string
  breakdown?: EventsBreakdown // present iff mode === 'events'
  events?: EventRow[]         // events in (dS, dE], present iff mode === 'events'
}

export interface ChurnDecision {
  instance_id: string
  mode: SourceMode
  reason: string
  churned_mrr?: number      // positive magnitude, present iff mode === 'events'
  active_mrr_start?: number  // present iff mode === 'events'
}

// --- Pure helpers (no IO) ---

export function isMature(firstObserved: string | null, windowStart: string): boolean {
  if (!firstObserved) return false
  return parseDay(windowStart) >= parseDay(firstObserved) + MATURITY_DAYS * DAY_MS
}

/** Sum event deltas per type at full precision. churn/contraction deltas are negative. */
export function summarizeEvents(events: EventRow[]): {
  new_mrr: number
  reactivation_mrr: number
  expansion_mrr: number
  contraction_mrr: number
  churned_mrr: number
  net_events: number
} {
  let neu = 0, rea = 0, exp = 0, con = 0, chu = 0
  for (const e of events) {
    switch (e.event_type) {
      case 'new': neu += e.mrr_delta; break
      case 'reactivation': rea += e.mrr_delta; break
      case 'expansion': exp += e.mrr_delta; break
      case 'contraction': con += e.mrr_delta; break
      case 'churn': chu += e.mrr_delta; break
    }
  }
  return {
    new_mrr: neu,
    reactivation_mrr: rea,
    expansion_mrr: exp,
    contraction_mrr: con,
    churned_mrr: -chu, // positive magnitude
    net_events: neu + rea + exp + con + chu,
  }
}

/** Cent-equality guard. metrics_daily.mrr is DECIMAL(12,2); round events to cents first. */
export function guardOk(netEvents: number, netDaily: number): boolean {
  return Math.abs(round2(netEvents) - round2(netDaily)) < 0.005
}

// --- IO ---

type Admin = ReturnType<typeof createAdminClient>

interface Anchors {
  startDate: string
  endDate: string
  mrrStart: number
  mrrEnd: number
}

/** First seed/observation date for an instance (min first_seen_active). Null => never observed. */
async function firstObservedDate(supabase: Admin, instanceId: string): Promise<string | null> {
  const { data } = await supabase
    .from('entity_mrr_state')
    .select('first_seen_active')
    .eq('instance_id', instanceId)
    .not('first_seen_active', 'is', null)
    .order('first_seen_active', { ascending: true })
    .limit(1)
  return data?.[0]?.first_seen_active ?? null
}

/**
 * Resolve the two metrics_daily anchors for an instance over [windowStart, windowEnd]:
 *   dS = latest snapshot strictly before windowStart
 *   dE = latest snapshot in [windowStart, windowEnd]
 * Returns null if either is missing (snapshot gap => caller falls to proxy).
 */
async function fetchAnchors(
  supabase: Admin,
  instanceId: string,
  windowStart: string,
  windowEnd: string,
): Promise<Anchors | null> {
  const [startRes, endRes] = await Promise.all([
    supabase
      .from('metrics_daily')
      .select('date, mrr')
      .eq('instance_id', instanceId)
      .lt('date', windowStart)
      .order('date', { ascending: false })
      .limit(1),
    supabase
      .from('metrics_daily')
      .select('date, mrr')
      .eq('instance_id', instanceId)
      .gte('date', windowStart)
      .lte('date', windowEnd)
      .order('date', { ascending: false })
      .limit(1),
  ])
  const s = startRes.data?.[0]
  const e = endRes.data?.[0]
  if (!s || !e) return null
  return {
    startDate: s.date,
    endDate: e.date,
    mrrStart: Number(s.mrr) || 0,
    mrrEnd: Number(e.mrr) || 0,
  }
}

/** Fetch events in (startDate, endDate] by observed_date. */
async function fetchEvents(
  supabase: Admin,
  instanceId: string,
  startDate: string,
  endDate: string,
): Promise<EventRow[]> {
  const { data } = await supabase
    .from('mrr_movement_events')
    .select('entity_type, entity_id, event_type, mrr_before, mrr_after, mrr_delta, observed_date, effective_date')
    .eq('instance_id', instanceId)
    .gt('observed_date', startDate)
    .lte('observed_date', endDate)
    .limit(10000)
  return (data ?? []).map((e) => ({
    entity_type: e.entity_type as EntityType,
    entity_id: e.entity_id as number,
    event_type: e.event_type as MovementEventType,
    mrr_before: Number(e.mrr_before) || 0,
    mrr_after: Number(e.mrr_after) || 0,
    mrr_delta: Number(e.mrr_delta) || 0,
    observed_date: e.observed_date as string,
    effective_date: (e.effective_date as string | null) ?? null,
  }))
}

async function resolveOneMonth(
  supabase: Admin,
  instanceId: string,
  monthStart: string,
  windowEnd: string,
): Promise<MonthlyDecision> {
  const proxy = (reason: string): MonthlyDecision => ({ instance_id: instanceId, mode: 'proxy', reason })

  const firstObserved = await firstObservedDate(supabase, instanceId)
  if (!isMature(firstObserved, monthStart)) return proxy(firstObserved ? 'immature' : 'no_events')

  const anchors = await fetchAnchors(supabase, instanceId, monthStart, windowEnd)
  if (!anchors) return proxy('missing_metrics_daily')

  const events = await fetchEvents(supabase, instanceId, anchors.startDate, anchors.endDate)
  const s = summarizeEvents(events)
  const netDaily = anchors.mrrEnd - anchors.mrrStart
  if (!guardOk(s.net_events, netDaily)) return proxy('guard_failed')

  const breakdown: EventsBreakdown = {
    starting_mrr: round2(anchors.mrrStart),
    new_mrr: round2(s.new_mrr),
    reactivation_mrr: round2(s.reactivation_mrr),
    churned_mrr: round2(s.churned_mrr),
    expansion_mrr: round2(s.expansion_mrr),
    contraction_mrr: round2(s.contraction_mrr),
    ending_mrr: round2(anchors.mrrEnd),
    net_change: round2(s.new_mrr + s.reactivation_mrr + s.expansion_mrr + s.contraction_mrr - s.churned_mrr),
  }
  return { instance_id: instanceId, mode: 'events', reason: 'ok', breakdown, events }
}

/**
 * Per-instance events-vs-proxy decision for one calendar month.
 * @param monthKey 'YYYY-MM'
 * @param asOf server "today" as 'YYYY-MM-DD' (caps the current partial month)
 */
export async function resolveMonthlyMovement(
  instanceIds: string[],
  monthKey: string,
  asOf: string,
): Promise<MonthlyDecision[]> {
  if (instanceIds.length === 0) return []
  const supabase = createAdminClient()
  const [y, m] = monthKey.split('-').map(Number)
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
  const nextStart = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  const lastDayMs = parseDay(nextStart) - DAY_MS
  const windowEnd = fmtDay(Math.min(lastDayMs, parseDay(asOf)))
  return Promise.all(instanceIds.map((id) => resolveOneMonth(supabase, id, monthStart, windowEnd)))
}

/**
 * Per-instance events-vs-proxy decision for a rolling churn window [periodStart, periodEnd].
 * @param periodStart 'YYYY-MM-DD' inclusive
 * @param periodEnd   'YYYY-MM-DD' inclusive (server today)
 */
export async function resolveChurnWindow(
  instanceIds: string[],
  periodStart: string,
  periodEnd: string,
): Promise<ChurnDecision[]> {
  if (instanceIds.length === 0) return []
  const supabase = createAdminClient()
  return Promise.all(
    instanceIds.map(async (instanceId): Promise<ChurnDecision> => {
      const proxy = (reason: string): ChurnDecision => ({ instance_id: instanceId, mode: 'proxy', reason })

      const firstObserved = await firstObservedDate(supabase, instanceId)
      if (!isMature(firstObserved, periodStart)) return proxy(firstObserved ? 'immature' : 'no_events')

      const anchors = await fetchAnchors(supabase, instanceId, periodStart, periodEnd)
      if (!anchors) return proxy('missing_metrics_daily')

      const events = await fetchEvents(supabase, instanceId, anchors.startDate, anchors.endDate)
      const s = summarizeEvents(events)
      const netDaily = anchors.mrrEnd - anchors.mrrStart
      if (!guardOk(s.net_events, netDaily)) return proxy('guard_failed')

      return {
        instance_id: instanceId,
        mode: 'events',
        reason: 'ok',
        churned_mrr: round2(s.churned_mrr),
        active_mrr_start: round2(anchors.mrrStart),
      }
    }),
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `backend/`): `npx tsc --noEmit`
Expected: no errors referencing `movement-hybrid.ts`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/lib/metrics/movement-hybrid.ts
git commit -m "feat(mrr-movement): add gated events-vs-proxy resolver module"
```

---

## Task 2: Integrate the resolver into `mrr-movement/route.ts`

The existing monthly loop becomes the proxy path, computed **per proxy-instance** so it can be summed with events-instances. Adds `reactivation_mrr` and a `source` block.

**Files:**
- Modify: `backend/src/app/api/metrics/mrr-movement/route.ts`

- [ ] **Step 1: Import the resolver**

At the top of the file, after the existing imports, add:

```ts
import { resolveMonthlyMovement, round2 } from '@/lib/metrics/movement-hybrid'
```

- [ ] **Step 2: Add `reactivation_mrr` to the data point interface**

Replace the `MovementDataPoint` interface (currently lines ~11-20) with:

```ts
interface MovementDataPoint {
  month: string
  starting_mrr: number
  new_mrr: number
  reactivation_mrr: number
  churned_mrr: number
  expansion_mrr: number
  contraction_mrr: number
  ending_mrr: number
  net_change: number
}

type MonthMode = 'events' | 'proxy' | 'mixed'
interface MonthSource {
  mode: MonthMode
  reason: string
  per_instance?: Record<string, 'events' | 'proxy'>
}
```

- [ ] **Step 3: Keep `instance_id` on domains and billable items**

In the `whmcs_domains` select (currently line ~84-87), add `instance_id`:

```ts
      supabase
        .from('whmcs_domains')
        .select('instance_id, recurringamount, registrationperiod, status, registrationdate, expirydate')
        .in('instance_id', instanceIds)
        .limit(10000),
```

In the `billableWithStart` mapping object (the returned object inside the `flatMap`, currently lines ~171-179), add `instance_id: item.instance_id` so it reads:

```ts
      return [{
        instance_id: item.instance_id,
        startDate,
        cycleMonths,
        recurfor: item.recurfor ?? 0,
        mrr,
        invoiceAction: item.invoice_action ?? 0,
        cancelledAt: item.cancelled_at ? new Date(item.cancelled_at) : null,
        dueDate,
      }]
```

And add `instance_id: string` as the first field of the `BillableItemMovement` type (currently lines ~154-162):

```ts
    type BillableItemMovement = {
      instance_id: string
      startDate: Date
      cycleMonths: number
      recurfor: number
      mrr: number
      invoiceAction: number
      cancelledAt: Date | null
      dueDate: Date
    }
```

- [ ] **Step 4: Replace the per-month loop body to merge events + proxy per instance**

Replace the entire `for (let i = 0; i < months; i++) { ... }` loop (currently lines ~263-338) and add a `monthSources` accumulator just before it. The new code:

```ts
    const movementData: MovementDataPoint[] = []
    const monthSources: Record<string, MonthSource> = {}
    const now = new Date()
    const asOf = now.toISOString().slice(0, 10)

    for (let i = 0; i < months; i++) {
      const monthDate = new Date(startDate)
      monthDate.setMonth(startDate.getMonth() + i)

      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
      const naturalMonthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999)
      const monthEnd = naturalMonthEnd > now ? now : naturalMonthEnd
      const prevMonthEnd = new Date(monthStart.getTime() - 1)
      const isCurrentMonth = naturalMonthEnd > now

      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`

      // Per-instance events-vs-proxy decision for this month.
      const decisions = await resolveMonthlyMovement(instanceIds, monthKey, asOf)
      const eventsDecisions = decisions.filter((d) => d.mode === 'events')
      const eventsSet = new Set(eventsDecisions.map((d) => d.instance_id))
      const proxySet = new Set(instanceIds.filter((id) => !eventsSet.has(id)))

      let starting_mrr = 0
      let new_mrr = 0
      let reactivation_mrr = 0
      let churned_mrr = 0
      let expansion_mrr = 0
      let contraction_mrr = 0
      let ending_mrr = 0

      // 1. Events-mode instances: anchored figures from the resolver.
      for (const d of eventsDecisions) {
        const b = d.breakdown!
        starting_mrr += b.starting_mrr
        new_mrr += b.new_mrr
        reactivation_mrr += b.reactivation_mrr
        churned_mrr += b.churned_mrr
        expansion_mrr += b.expansion_mrr
        contraction_mrr += b.contraction_mrr
        ending_mrr += b.ending_mrr
      }

      // 2. Proxy-mode instances: existing date-proxy accumulation, filtered to proxySet.
      if (proxySet.size > 0) {
        hostingServices?.forEach(service => {
          if (!proxySet.has(service.instance_id)) return
          const wasActive = wasActiveAt(service, prevMonthEnd, false)
          const isActive = wasActiveAt(service, monthEnd, isCurrentMonth)
          const mrr = getMonthlyAmount(service)
          if (wasActive) starting_mrr += mrr
          if (isActive) ending_mrr += mrr
          if (!wasActive && isActive) new_mrr += mrr
          if (wasActive && !isActive) churned_mrr += mrr
        })

        billableWithStart.forEach(item => {
          if (!proxySet.has(item.instance_id)) return
          const wasActive = billableActiveAt(item, prevMonthEnd, false)
          const isActive = billableActiveAt(item, monthEnd, isCurrentMonth)
          if (wasActive) starting_mrr += item.mrr
          if (isActive) ending_mrr += item.mrr
          if (!wasActive && isActive) new_mrr += item.mrr
          if (wasActive && !isActive) churned_mrr += item.mrr
        })

        domainServices?.forEach(domain => {
          if (!proxySet.has(domain.instance_id)) return
          const mrr = domainMonthlyAmount(domain)
          if (mrr === 0) return
          const wasActive = domainActiveAt(domain, prevMonthEnd, false)
          const isActive = domainActiveAt(domain, monthEnd, isCurrentMonth)
          if (wasActive) starting_mrr += mrr
          if (isActive) ending_mrr += mrr
          if (!wasActive && isActive) new_mrr += mrr
          if (wasActive && !isActive) churned_mrr += mrr
        })
      }

      const net_change = new_mrr + reactivation_mrr + expansion_mrr + contraction_mrr - churned_mrr

      movementData.push({
        month: monthKey,
        starting_mrr: round2(starting_mrr),
        new_mrr: round2(new_mrr),
        reactivation_mrr: round2(reactivation_mrr),
        churned_mrr: round2(churned_mrr),
        expansion_mrr: round2(expansion_mrr),
        contraction_mrr: round2(contraction_mrr),
        ending_mrr: round2(ending_mrr),
        net_change: round2(net_change),
      })

      // Source diagnostics for this month.
      const mode: MonthMode =
        eventsSet.size === 0 ? 'proxy' : proxySet.size === 0 ? 'events' : 'mixed'
      const source: MonthSource = { mode, reason: mode === 'proxy' ? (decisions[0]?.reason ?? 'immature') : 'ok' }
      if (mode === 'mixed') {
        source.per_instance = {}
        for (const id of instanceIds) source.per_instance[id] = eventsSet.has(id) ? 'events' : 'proxy'
      }
      monthSources[monthKey] = source
    }
```

Note: the `domainstatus`-based `domainServices` variable in the original `Promise.all` destructure is named `domainServices` — keep that name (the select above feeds it).

- [ ] **Step 5: Add `reactivation_mrr` to totals and `source` to the response**

Replace the totals reducer + `return success(...)` block (currently lines ~340-362) with:

```ts
    const totals = movementData.reduce(
      (acc, m) => ({
        new_mrr: acc.new_mrr + m.new_mrr,
        reactivation_mrr: acc.reactivation_mrr + m.reactivation_mrr,
        churned_mrr: acc.churned_mrr + m.churned_mrr,
        expansion_mrr: acc.expansion_mrr + m.expansion_mrr,
        contraction_mrr: acc.contraction_mrr + m.contraction_mrr,
        net_change: acc.net_change + m.net_change,
      }),
      { new_mrr: 0, reactivation_mrr: 0, churned_mrr: 0, expansion_mrr: 0, contraction_mrr: 0, net_change: 0 }
    )

    return success({
      movement_data: movementData,
      totals: {
        new_mrr: round2(totals.new_mrr),
        reactivation_mrr: round2(totals.reactivation_mrr),
        churned_mrr: round2(totals.churned_mrr),
        expansion_mrr: round2(totals.expansion_mrr),
        contraction_mrr: round2(totals.contraction_mrr),
        net_change: round2(totals.net_change),
      },
      months,
      source: { per_month: monthSources },
    }, { instance_ids: instanceIds })
```

- [ ] **Step 6: Remove the now-dead local `expansion_mrr`/`contraction_mrr = 0` lines**

The old loop had `const expansion_mrr = 0` / `const contraction_mrr = 0` and `const net_change = new_mrr - churned_mrr`. These are replaced by Step 4 — confirm none remain (search the file for `expansion_mrr  = 0`).

- [ ] **Step 7: Verify compile + lint**

Run (from `backend/`): `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add backend/src/app/api/metrics/mrr-movement/route.ts
git commit -m "feat(mrr-movement): hybrid waterfall (events per instance + reactivation_mrr + source)"
```

---

## Task 3: Integrate the resolver into `mrr-movement/items/route.ts`

Events-mode instances source `new`/`churned` items from `mrr_movement_events`; proxy-mode instances keep the existing path. `reactivation` is excluded from `new`.

**Files:**
- Modify: `backend/src/app/api/metrics/mrr-movement/items/route.ts`

- [ ] **Step 1: Import the resolver**

After the existing imports add:

```ts
import { resolveMonthlyMovement } from '@/lib/metrics/movement-hybrid'
```

- [ ] **Step 2: Compute the per-instance decision for the requested month**

Immediately after `isCurrentMonth` is computed (currently line ~68) and before the `supabase` client is created, add:

```ts
    const asOf = now.toISOString().slice(0, 10)
    const monthKeyStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
    const decisions = await resolveMonthlyMovement(instanceIds, monthKeyStr, asOf)
    const eventsById = new Map(decisions.filter(d => d.mode === 'events').map(d => [d.instance_id, d]))
    const proxySet = new Set(instanceIds.filter(id => !eventsById.has(id)))
```

- [ ] **Step 3: Restrict the proxy `forEach` blocks to proxy-mode instances**

In each of the three `forEach` blocks that build `items` (hosting at ~207, billable at ~231, domain at ~251), add an instance guard as the first line of the callback:

Hosting block — after `;(hostingRes.data ?? []).forEach(s => {` add:
```ts
      if (!proxySet.has(s.instance_id)) return
```
Billable block — after `;(billableRes.data ?? []).forEach(b => {` add:
```ts
      if (!proxySet.has(b.instance_id)) return
```
Domain block — after `;(domainsRes.data ?? []).forEach(d => {` add:
```ts
      if (!proxySet.has(d.instance_id)) return
```

- [ ] **Step 4: Append events-mode items from the resolver's event rows**

Immediately after the three proxy `forEach` blocks and before `items.sort(...)` (currently line ~271), add:

```ts
    // Events-mode instances: source items from the observed events.
    // ?type=new  -> event_type 'new' ONLY (reactivation excluded by design)
    // ?type=churned -> event_type 'churn'
    const wantTypes = typeParam === 'new' ? ['new'] : ['churn']
    for (const decision of eventsById.values()) {
      for (const ev of decision.events ?? []) {
        if (!wantTypes.includes(ev.event_type)) continue
        const instId = decision.instance_id
        const kind = ev.entity_type
        let description: string
        let billing_cycle = ''
        let client_id: number | null = null

        if (kind === 'hosting') {
          const s = (hostingRes.data ?? []).find(h => h.instance_id === instId && h.whmcs_id === ev.entity_id)
          client_id = s?.client_id ?? null
          const product = s ? productName.get(`${instId}:${s.packageid}`) : undefined
          description = [product, s?.domain].filter(Boolean).join(' — ') || `Service #${ev.entity_id}`
          billing_cycle = s?.billingcycle || ''
        } else if (kind === 'billable') {
          const b = (billableRes.data ?? []).find(x => x.instance_id === instId && x.whmcs_id === ev.entity_id)
          client_id = b?.client_id ?? null
          description = b?.description || `Billable #${ev.entity_id}`
          billing_cycle = b?.recurcycle || ''
        } else {
          const d = (domainsRes.data ?? []).find(x => x.instance_id === instId && x.whmcs_id === ev.entity_id)
          client_id = d?.client_id ?? null
          description = d?.domain || `Domain #${ev.entity_id}`
          billing_cycle = 'annually'
        }

        const monthly = typeParam === 'new' ? ev.mrr_after : ev.mrr_before
        items.push({
          kind,
          whmcs_id: ev.entity_id,
          client_id,
          client_name: clientName.get(`${instId}:${client_id}`) || `#${client_id}`,
          description,
          monthly_amount: Math.round(monthly * 100) / 100,
          billing_cycle,
          reference_date: ev.effective_date ?? ev.observed_date,
          instance_id: instId,
        })
      }
    }
```

- [ ] **Step 5: Add `source` to the response**

Replace the final `return success({ items, total, count, type, month }, ...)` block (currently lines ~274-280) with:

```ts
    items.sort((a, b) => b.monthly_amount - a.monthly_amount)
    const total = items.reduce((sum, it) => sum + it.monthly_amount, 0)

    const sourceMode = eventsById.size === 0 ? 'proxy' : proxySet.size === 0 ? 'events' : 'mixed'
    return success({
      items,
      total: Math.round(total * 100) / 100,
      count: items.length,
      type: typeParam,
      month: monthKeyStr,
      source: { mode: sourceMode },
    }, { instance_ids: instanceIds })
```

Remove the old `items.sort` + `const total` lines that previously preceded the return (they are now in this block).

- [ ] **Step 6: Verify compile + lint**

Run (from `backend/`): `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/app/api/metrics/mrr-movement/items/route.ts
git commit -m "feat(mrr-movement): hybrid items drill-down (events-sourced new/churned)"
```

---

## Task 4: Integrate the resolver into `churn.ts` + type

**Files:**
- Modify: `backend/src/types/api.ts`
- Modify: `backend/src/lib/metrics/churn.ts`

- [ ] **Step 1: Add optional `source` to `ChurnMetrics`**

In `backend/src/types/api.ts`, find the `ChurnMetrics` interface and add the field (keep all existing fields):

```ts
  source?: {
    mode: 'events' | 'proxy' | 'mixed'
    per_instance?: Record<string, 'events' | 'proxy'>
  }
```

- [ ] **Step 2: Import the resolver in `churn.ts`**

At the top of `backend/src/lib/metrics/churn.ts`, after the existing imports add:

```ts
import { resolveChurnWindow } from '@/lib/metrics/movement-hybrid'
```

- [ ] **Step 3: Rewrite `calculateChurnMultiInstance` to choose events vs RPC per instance**

Replace the entire `calculateChurnMultiInstance` function body with:

```ts
export async function calculateChurnMultiInstance(instanceIds: string[], periodDays: number = 30): Promise<ChurnMetrics> {
  const supabase = createAdminClient()

  const now = new Date()
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000)
  const periodStartStr = periodStart.toISOString().slice(0, 10)
  const periodEndStr = now.toISOString().slice(0, 10)

  // Per-instance events-vs-proxy decision.
  const decisions = await resolveChurnWindow(instanceIds, periodStartStr, periodEndStr)
  const eventsById = new Map(decisions.filter(d => d.mode === 'events').map(d => [d.instance_id, d]))

  const perInstance: Record<string, 'events' | 'proxy'> = {}

  const results = await Promise.all(
    instanceIds.map(async (instanceId) => {
      const ev = eventsById.get(instanceId)
      if (ev) {
        perInstance[instanceId] = 'events'
        return {
          churned_services: 0, // service count not tracked in events mode (MRR-weighted KPI only)
          churned_mrr: ev.churned_mrr ?? 0,
          active_mrr_start: ev.active_mrr_start ?? 0,
        }
      }
      perInstance[instanceId] = 'proxy'
      const { data, error } = await supabase.rpc('calculate_churn', {
        p_instance_id: instanceId,
        p_period_days: periodDays,
      })
      if (error) {
        console.error(`Churn calculation error for instance ${instanceId}:`, error)
        return { churned_services: 0, churned_mrr: 0, active_mrr_start: 0 }
      }
      const result = data?.[0]
      return {
        churned_services: Number(result?.churned_services) || 0,
        churned_mrr: Number(result?.churned_mrr) || 0,
        active_mrr_start: Number(result?.active_mrr_start) || 0,
      }
    })
  )

  const totals = results.reduce(
    (acc, r) => ({
      churned_services: acc.churned_services + r.churned_services,
      churned_mrr: acc.churned_mrr + r.churned_mrr,
      active_mrr_start: acc.active_mrr_start + r.active_mrr_start,
    }),
    { churned_services: 0, churned_mrr: 0, active_mrr_start: 0 }
  )

  const churnRate = totals.active_mrr_start > 0
    ? Math.round((totals.churned_mrr / totals.active_mrr_start) * 10000) / 100
    : 0

  const eventsCount = Object.values(perInstance).filter(v => v === 'events').length
  const mode: 'events' | 'proxy' | 'mixed' =
    eventsCount === 0 ? 'proxy' : eventsCount === instanceIds.length ? 'events' : 'mixed'

  return {
    period_days: periodDays,
    period_start: periodStartStr,
    period_end: periodEndStr,
    churned_services: totals.churned_services,
    churned_mrr: Math.round(totals.churned_mrr * 100) / 100,
    churn_rate: churnRate,
    source: mode === 'mixed' ? { mode, per_instance: perInstance } : { mode },
  }
}
```

- [ ] **Step 4: Route `calculateChurn` (single instance) through the multi-instance path**

Replace the entire `calculateChurn` function body with a thin wrapper so single-instance churn also gets the hybrid + `source` (keeps one code path):

```ts
export async function calculateChurn(instanceId: string, periodDays: number = 30): Promise<ChurnMetrics> {
  return calculateChurnMultiInstance([instanceId], periodDays)
}
```

Note: this changes single-instance churn from the raw RPC to the hybrid wrapper. In proxy mode the numbers are identical to before (same RPC, same aggregation over one instance). Confirm `ChurnMetrics` is still imported at the top of the file (it is).

- [ ] **Step 5: Verify compile + lint**

Run (from `backend/`): `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/types/api.ts backend/src/lib/metrics/churn.ts
git commit -m "feat(churn): hybrid churn (events per instance, RPC fallback, source)"
```

---

## Task 5: Final verification + version bump

**Files:**
- Modify: `backend/package.json` (version) — match the repo's existing version-bump convention for backend changes.

- [ ] **Step 1: Full typecheck + lint**

Run (from `backend/`): `npx tsc --noEmit && npm run lint`
Expected: clean (a pre-existing unused-var warning at `sync.ts:431` is acceptable; no new errors).

- [ ] **Step 2: Bump backend version**

Increment the `version` field in `backend/package.json` (patch bump). No dashboard changelog (internal change, not user-facing yet — per the spec).

- [ ] **Step 3: Commit**

```bash
git add backend/package.json
git commit -m "chore: bump backend version for mrr-movement hybrid"
```

---

## Task 6: Deploy gated + reconciliation validation against prod

This task is the verification substitute for automated tests. The gate keeps every instance on proxy in prod today (real instances mature ≈ 2026-06-29), so deploy must be byte-identical to current behavior.

**Files:** none (deploy + read-only prod checks)

- [ ] **Step 1: Capture current prod baselines (BEFORE deploy)**

Via the Supabase MCP (or the live API), record, for the real instance ids (Naranjatec `077859e0…`, NextGenWebs `e9a73eaf…`):
- `GET /api/metrics/mrr-movement?instance_ids=…&months=6` → save `movement_data` + `totals`.
- `GET /api/metrics/churn` → save `churned_mrr`, `churn_rate`.

- [ ] **Step 2: Deploy the branch to prod**

Follow the repo's deploy workflow (see `reference_deploy.md` / memory). Backend force-deploy as done for the snapshot infra.

- [ ] **Step 3: Confirm zero regression (AFTER deploy)**

Re-run the same two endpoints. Assert:
- `movement_data` / `totals` are **identical** to Step 1 (every month's `source.mode` should be `proxy`, `reason: 'immature'`).
- `churn` figures identical; `source.mode === 'proxy'`.
- New additive fields present: `reactivation_mrr` (= 0 everywhere), `source`.

If any pre-cutover number changed, STOP — the proxy path was altered. Diff against the baseline to find the per-instance filter bug.

- [ ] **Step 4: Spot-check the guard query directly (optional, via MCP SQL)**

For one real instance, run the conservation check for a recent fully-observed week to confirm the events accrued since 2026-05-30 reconcile against `metrics_daily` (sanity that the events path will pass the guard when July matures):

```sql
-- Replace :iid and the date window with a real instance + an observed range.
WITH ev AS (
  SELECT COALESCE(SUM(mrr_delta), 0) AS net_events
  FROM mrr_movement_events
  WHERE instance_id = :iid AND observed_date > :dS AND observed_date <= :dE
),
md AS (
  SELECT
    (SELECT mrr FROM metrics_daily WHERE instance_id = :iid AND date = :dE) -
    (SELECT mrr FROM metrics_daily WHERE instance_id = :iid AND date = :dS) AS net_daily
)
SELECT ev.net_events, md.net_daily, ROUND(ev.net_events, 2) = ROUND(md.net_daily, 2) AS reconciles
FROM ev, md;
```

Expected: `reconciles = true` for clean windows (and any mismatch is exactly what the guard would catch → that month would stay on proxy).

- [ ] **Step 5: Update memory**

Update `project_movement_snapshot_infra.md`: the gated hybrid is built + deployed; consumers (mrr-movement, items, churn) now auto-activate per instance at maturity (≈ July 2026 for months, ≈ 2026-07-29 for the 30-day churn window) behind the cent-equality guard.

---

## Self-Review (completed during planning)

- **Spec coverage:** resolver module (Task 1) ↔ Architecture/Gate/Guard/Anchoring; `mrr-movement` (Task 2) ↔ waterfall integration + `reactivation_mrr` + `source`; `items` (Task 3) ↔ drill-down, reactivation excluded from `new`; `churn` (Task 4) ↔ rolling-window hybrid + `source`; deploy/validation (Task 6) ↔ Deployment & safety. ✓
- **Guard precision:** cent-equality via `round2` both sides — matches the spec's DECIMAL(12,2) note. ✓
- **Anchoring:** `starting_mrr`/`ending_mrr` from `metrics_daily` only; events bridge. Continuity holds because month M's `dE` equals month M+1's `dS` for complete months. ✓
- **Type consistency:** `resolveMonthlyMovement`, `resolveChurnWindow`, `MonthlyDecision.breakdown`/`.events`, `ChurnDecision.churned_mrr`/`.active_mrr_start`, exported `round2` — names consistent across Tasks 1-4. ✓
- **Per-instance partitioning:** `instance_id` carried on hosting (already), domains (Step 3), billable (Step 3) so proxy `forEach`s can filter by `proxySet`. ✓
