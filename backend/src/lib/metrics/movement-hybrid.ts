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
