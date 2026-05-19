import { createAdminClient } from '@/lib/supabase/admin'
import type { ChurnMetrics } from '@/types/api'

/**
 * Calculate churn metrics for a single WHMCS instance
 */
export async function calculateChurn(instanceId: string, periodDays: number = 30): Promise<ChurnMetrics> {
  const supabase = createAdminClient()

  // Use the database function for churn calculation
  const { data, error } = await supabase.rpc('calculate_churn', {
    p_instance_id: instanceId,
    p_period_days: periodDays,
  })

  if (error) {
    console.error('Churn calculation error:', error)
    // Return empty metrics on error
    const now = new Date()
    return {
      period_days: periodDays,
      period_start: new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      period_end: now.toISOString().split('T')[0],
      churned_services: 0,
      churned_mrr: 0,
      churn_rate: 0,
    }
  }

  const result = data?.[0]

  return {
    period_days: periodDays,
    period_start: result?.period_start || '',
    period_end: result?.period_end || '',
    churned_services: Number(result?.churned_services) || 0,
    churned_mrr: Number(result?.churned_mrr) || 0,
    churn_rate: Number(result?.churn_rate) || 0,
  }
}

/**
 * Calculate churn metrics for multiple WHMCS instances.
 *
 * MRR-weighted aggregation: sums churned_mrr and active_mrr_start across
 * instances, then computes the portfolio-level rate. Averaging per-instance
 * rates would over-weight tiny instances.
 */
export async function calculateChurnMultiInstance(instanceIds: string[], periodDays: number = 30): Promise<ChurnMetrics> {
  const supabase = createAdminClient()

  const now = new Date()
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000)

  const results = await Promise.all(
    instanceIds.map(async (instanceId) => {
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

  return {
    period_days: periodDays,
    period_start: periodStart.toISOString().split('T')[0],
    period_end: now.toISOString().split('T')[0],
    churned_services: totals.churned_services,
    churned_mrr: totals.churned_mrr,
    churn_rate: churnRate,
  }
}
