import { createAdminClient } from '@/lib/supabase/admin'
import type { ChurnMetrics } from '@/types/api'
import { resolveChurnWindow } from '@/lib/metrics/movement-hybrid'

/**
 * Calculate churn metrics for a single WHMCS instance.
 * Thin wrapper around calculateChurnMultiInstance.
 */
export async function calculateChurn(instanceId: string, periodDays: number = 30): Promise<ChurnMetrics> {
  return calculateChurnMultiInstance([instanceId], periodDays)
}

/**
 * Calculate churn metrics for multiple WHMCS instances.
 *
 * Uses events-mode data (metrics_daily snapshots) when a sufficient observation
 * window exists for an instance; falls back to the calculate_churn RPC (proxy)
 * otherwise. MRR-weighted aggregation across all instances.
 */
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
