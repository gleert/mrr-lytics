/**
 * Derived termination dates for undated cancellations.
 *
 * Some WHMCS entities are inactive "now" (a billable retainer whose
 * invoice_action flipped to 0, a Cancelled hosting service, …) yet carry NO
 * usable cancellation date: cancelled_at / terminationdate are NULL and the
 * stored duedate/nextduedate sits in the FUTURE. The legacy date-proxy in
 * mrr-movement therefore treats them as "active until that future date", so
 * they never surface as churn in any past month's bar — the €5 125 Magento
 * retainer that left on 2026-05-18 is the canonical case.
 *
 * metrics_daily is the ground truth (same source as the live MRR KPI and the
 * daily-MRR chart): the day such an entity stopped counting, the instance MRR
 * dropped by exactly its monthly amount. We recover the real churn date by
 * matching each undated entity's amount to a unique downward step in
 * metrics_daily. The match is intentionally conservative — one entity ↔ one
 * step within a tight tolerance — so when a day is noisy (several simultaneous
 * movements that don't sum to a single entity's amount) we attribute nothing
 * and the caller falls back to the existing proxy behaviour. Correct-or-nothing.
 *
 * The returned dates are injected into the proxy active-at checks as if they
 * were a real terminationdate, which (a) dates the churn in the right month and
 * (b) keeps the bar reconciled with metrics_daily, with no double counting.
 *
 * Read-only. Consumed by mrr-movement and mrr-movement/items.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface UndatedCandidate {
  instance_id: string
  /** Unique key per entity within the caller (e.g. `billable:230`). */
  key: string
  /** Monthly MRR amount of the entity. */
  mrr: number
}

/**
 * Tolerance for matching an entity's monthly amount to a metrics_daily step.
 * metrics_daily.mrr is DECIMAL(12,2); monthly amounts derived from annual
 * cycles carry sub-cent rounding. €1.00 absorbs that while staying far below
 * any realistic ambiguity between distinct retainers.
 */
const MATCH_TOLERANCE = 1.0

/** How far back to scan metrics_daily for a matching step. */
const LOOKBACK_DAYS = 540

/**
 * Resolve a best-effort churn date for each undated candidate by matching its
 * monthly amount to a unique downward step in the instance's metrics_daily.
 *
 * @returns Map keyed by `${instance_id}:${key}` → effective churn Date. Absent
 *          keys mean no confident match was found (caller keeps proxy default).
 */
export async function resolveDerivedTerminations(
  supabase: SupabaseClient,
  candidates: UndatedCandidate[],
  now: Date,
): Promise<Map<string, Date>> {
  const result = new Map<string, Date>()
  if (candidates.length === 0) return result

  const byInstance = new Map<string, UndatedCandidate[]>()
  for (const c of candidates) {
    const list = byInstance.get(c.instance_id)
    if (list) list.push(c)
    else byInstance.set(c.instance_id, [c])
  }

  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10)

  await Promise.all(
    Array.from(byInstance.entries()).map(async ([instanceId, cands]) => {
      const { data } = await supabase
        .from('metrics_daily')
        .select('date, mrr')
        .eq('instance_id', instanceId)
        .gte('date', since)
        .order('date', { ascending: true })
        .limit(10000)
      const rows = data ?? []

      // Downward steps between consecutive snapshots.
      const steps: { date: Date; drop: number }[] = []
      for (let i = 1; i < rows.length; i++) {
        const delta = (Number(rows[i].mrr) || 0) - (Number(rows[i - 1].mrr) || 0)
        if (delta < -MATCH_TOLERANCE) steps.push({ date: new Date(rows[i].date), drop: -delta })
      }

      // Strict uniqueness — correct-or-nothing. Attribute a step to a candidate
      // ONLY when exactly one step matches its amount AND no other candidate
      // shares that amount. Any ambiguity (two same-amount items, or two steps
      // of the same size) yields no attribution and the caller keeps the proxy
      // default, so we never silently mis-date a churn.
      for (const c of cands) {
        const matchingSteps = steps.filter((s) => Math.abs(s.drop - c.mrr) <= MATCH_TOLERANCE)
        const rivalCandidate = cands.some((o) => o !== c && Math.abs(o.mrr - c.mrr) <= MATCH_TOLERANCE)
        if (matchingSteps.length === 1 && !rivalCandidate) {
          result.set(`${c.instance_id}:${c.key}`, matchingSteps[0].date)
        }
      }
    }),
  )

  return result
}
