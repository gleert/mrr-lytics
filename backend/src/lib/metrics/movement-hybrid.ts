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
  /**
   * True for a domain 'new' event that is really a pre-existing domain the sync
   * finally captured (see isDomainBackfill), not a real sale. Set in
   * resolveOneMonth; undefined elsewhere (e.g. the churn path, which ignores it).
   */
  is_backfill?: boolean
}

/**
 * A domain is "old enough" to be treated as pre-existing (a backfill) when it was
 * registered more than this many days before we first OBSERVED it active. The
 * daily snapshot diff emits a 'new' event the first time it sees a domain in the
 * active set; when a long-standing domain was absent from the synced active set
 * for a while (sync coverage gaps) and a later sync includes it, that 'new' event
 * is spurious. Prod data shows a clean split: real new domains are observed within
 * ~44 days of registration, backfills are 12-15 years old. 365 days sits well
 * inside that gap while keeping the risk of hiding a genuine recent transfer-in low.
 */
export const BACKFILL_MIN_AGE_DAYS = 365

/**
 * Is this domain 'new' event a backfill (pre-existing domain, not a real sale)?
 * Pure. registrationDate is 'YYYY-MM-DD' (or null/sentinel when unknown -> not a
 * backfill, since we can't justify hiding it). A registrationDate after the
 * observation (negative age) is likewise not a backfill.
 */
export function isDomainBackfill(observedDate: string, registrationDate: string | null): boolean {
  if (!registrationDate || registrationDate <= '0001-01-01') return false
  const ageDays = (parseDay(observedDate) - parseDay(registrationDate)) / DAY_MS
  return ageDays > BACKFILL_MIN_AGE_DAYS
}

/**
 * All amounts are FULL precision (not pre-rounded) -- like active-set.ts. Consumers
 * sum these across instances/entities and round ONCE at the edge, so the totals
 * reconcile with the live KPI to the cent (round-then-sum here would inject
 * per-instance drift and make a drill-down list total disagree with its pill).
 * starting_mrr / ending_mrr come from metrics_daily, which is already cents.
 */
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

/**
 * Is the window fully covered by observation? The window must start strictly AFTER
 * the cold-start seed day, so every movement inside it was captured as an event
 * (the seed day itself emits zero events and bakes pre-existing state into the
 * baseline). No long "maturity" wait -- a month/window is trusted as soon as it is
 * entirely within the observed period; the reconciliation guard is the safety net.
 */
export function isFullyObserved(firstObserved: string | null, windowStart: string): boolean {
  if (!firstObserved) return false
  return parseDay(windowStart) > parseDay(firstObserved)
}

/** Sum event deltas per type at full precision. churn/contraction deltas are negative. */
export function summarizeEvents(events: EventRow[]): {
  new_mrr: number          // real new only (excludes backfills)
  backfill_mrr: number     // domain 'new' events flagged is_backfill (pre-existing domains)
  reactivation_mrr: number
  expansion_mrr: number
  contraction_mrr: number  // negative (sum of negative contraction deltas)
  churned_mrr: number      // positive magnitude
  net_events: number       // signed sum of ALL deltas, INCLUDING backfills (guard input)
} {
  let neu = 0, bak = 0, rea = 0, exp = 0, con = 0, chu = 0
  for (const e of events) {
    switch (e.event_type) {
      // A backfill is a pre-existing domain the sync finally captured, not a sale.
      // Its delta leaves new_mrr (folded into starting_mrr by the caller) but MUST
      // stay in net_events so the reconciliation guard still matches metrics_daily.
      case 'new': if (e.is_backfill) bak += e.mrr_delta; else neu += e.mrr_delta; break
      case 'reactivation': rea += e.mrr_delta; break
      case 'expansion': exp += e.mrr_delta; break
      case 'contraction': con += e.mrr_delta; break
      case 'churn': chu += e.mrr_delta; break
    }
  }
  return {
    new_mrr: neu,
    backfill_mrr: bak,
    reactivation_mrr: rea,
    expansion_mrr: exp,
    contraction_mrr: con,
    churned_mrr: -chu, // positive magnitude
    net_events: neu + bak + rea + exp + con + chu,
  }
}

/**
 * Reconciliation tolerance. metrics_daily.mrr is DECIMAL(12,2): each snapshot
 * endpoint carries up to +/-0.005 of cent-rounding, so netDaily (a difference of
 * two rounded endpoints) can differ from the full-precision event net by up to
 * ~1 cent even when the data is perfectly correct. 0.02 absorbs that with margin
 * while staying far below any real movement (smallest realistic ~ EUR0.40/mo for a
 * cheap domain) -- verified against prod 2026-06-04: events reconcile with
 * metrics_daily to within ~0.6 cents (pure accumulated rounding, no real drift).
 */
export const GUARD_TOLERANCE = 0.02

/**
 * Conservation guard: does the events' net match the metrics_daily delta within
 * GUARD_TOLERANCE? Compares at FULL precision -- do NOT pre-round netEvents, as
 * rounding it to cents would inflate a sub-cent rounding gap into a full cent and
 * spuriously fail (e.g. true diff 0.006 -> 0.01 after rounding both sides).
 */
export function guardOk(netEvents: number, netDaily: number): boolean {
  return Math.abs(netEvents - netDaily) < GUARD_TOLERANCE
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
 *
 * Adjacent months are contiguous with no overlap: month M's dE equals month M+1's
 * dS (since the next window starts the day after monthEnd), so no event is dropped
 * or double-counted. If the last days of a month have no snapshot, events observed
 * in that gap are attributed to the NEXT month's bar -- a harmless cosmetic shift;
 * each month's guard still reconciles against its own anchors.
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

/**
 * Flag domain 'new' events that are really pre-existing domains the sync finally
 * captured (see isDomainBackfill). Mutates the passed events in place, setting
 * is_backfill. Looks up each domain's registrationdate once per instance/window.
 * Only domain 'new' events are considered; everything else is left untouched.
 */
async function markDomainBackfills(
  supabase: Admin,
  instanceId: string,
  events: EventRow[],
): Promise<void> {
  const domainNewIds = Array.from(
    new Set(
      events
        .filter((e) => e.entity_type === 'domain' && e.event_type === 'new')
        .map((e) => e.entity_id),
    ),
  )
  if (domainNewIds.length === 0) return

  const { data } = await supabase
    .from('whmcs_domains')
    .select('whmcs_id, registrationdate')
    .eq('instance_id', instanceId)
    .in('whmcs_id', domainNewIds)
    .limit(10000)

  const regById = new Map<number, string | null>()
  for (const d of data ?? []) {
    regById.set(d.whmcs_id as number, (d.registrationdate as string | null) ?? null)
  }
  for (const e of events) {
    if (e.entity_type === 'domain' && e.event_type === 'new') {
      e.is_backfill = isDomainBackfill(e.observed_date, regById.get(e.entity_id) ?? null)
    }
  }
}

async function resolveOneMonth(
  supabase: Admin,
  instanceId: string,
  monthStart: string,
  windowEnd: string,
): Promise<MonthlyDecision> {
  const proxy = (reason: string): MonthlyDecision => ({ instance_id: instanceId, mode: 'proxy', reason })

  const firstObserved = await firstObservedDate(supabase, instanceId)
  if (!isFullyObserved(firstObserved, monthStart)) return proxy(firstObserved ? 'pre_observation' : 'no_events')

  const anchors = await fetchAnchors(supabase, instanceId, monthStart, windowEnd)
  if (!anchors) return proxy('missing_metrics_daily')

  const events = await fetchEvents(supabase, instanceId, anchors.startDate, anchors.endDate)
  await markDomainBackfills(supabase, instanceId, events)
  const s = summarizeEvents(events)
  const netDaily = anchors.mrrEnd - anchors.mrrStart
  // Guard uses net_events, which still includes backfill deltas, so flagging
  // backfills never changes whether the month reconciles (events vs proxy).
  if (!guardOk(s.net_events, netDaily)) return proxy('guard_failed')

  // Full precision throughout (see EventsBreakdown docs). Consumers round at the
  // edge; ending is the metrics_daily anchor (already cents). Backfills (old
  // domains the sync finally captured) are folded into starting_mrr instead of
  // being shown as new sales; ending is unchanged, so the identity still holds:
  //   starting' + new' + ... - churned = (mrrStart + backfill) + (new - backfill) + ... = ending.
  const breakdown: EventsBreakdown = {
    starting_mrr: anchors.mrrStart + s.backfill_mrr,
    new_mrr: s.new_mrr,
    reactivation_mrr: s.reactivation_mrr,
    churned_mrr: s.churned_mrr,
    expansion_mrr: s.expansion_mrr,
    contraction_mrr: s.contraction_mrr,
    ending_mrr: anchors.mrrEnd,
    net_change: s.new_mrr + s.reactivation_mrr + s.expansion_mrr + s.contraction_mrr - s.churned_mrr,
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
      if (!isFullyObserved(firstObserved, periodStart)) return proxy(firstObserved ? 'pre_observation' : 'no_events')

      const anchors = await fetchAnchors(supabase, instanceId, periodStart, periodEnd)
      if (!anchors) return proxy('missing_metrics_daily')

      const events = await fetchEvents(supabase, instanceId, anchors.startDate, anchors.endDate)
      const s = summarizeEvents(events)
      const netDaily = anchors.mrrEnd - anchors.mrrStart
      if (!guardOk(s.net_events, netDaily)) return proxy('guard_failed')

      // Full precision; churn.ts sums across instances and rounds at the edge.
      return {
        instance_id: instanceId,
        mode: 'events',
        reason: 'ok',
        churned_mrr: s.churned_mrr,
        active_mrr_start: anchors.mrrStart,
      }
    }),
  )
}
