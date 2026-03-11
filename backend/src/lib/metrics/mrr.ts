/**
 * MRR (Monthly Recurring Revenue) Calculations
 * 
 * This module provides functions to calculate MRR metrics from WHMCS data.
 * MRR is calculated by normalizing all recurring revenue to monthly amounts.
 * 
 * @module lib/metrics/mrr
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { MrrMetrics } from '@/types/api'

/**
 * Calculate MRR metrics for a single WHMCS instance
 * 
 * Retrieves pre-calculated MRR data from materialized views for performance.
 * The views are refreshed after each sync operation.
 * 
 * @param instanceId - The WHMCS instance UUID
 * @returns MRR metrics including total MRR, ARR, and breakdown by billing cycle
 * 
 * @example
 * ```typescript
 * const metrics = await calculateMrr('instance-uuid')
 * console.log(`Current MRR: $${metrics.mrr}`)
 * console.log(`ARR: $${metrics.arr}`)
 * ```
 */
export async function calculateMrr(instanceId: string): Promise<MrrMetrics> {
  const supabase = createAdminClient()

  // Get current MRR from materialized view
  const { data: mrrData } = await supabase
    .from('mv_mrr_current')
    .select('mrr, arr, active_services, calculated_at')
    .eq('instance_id', instanceId)
    .single()

  // Get MRR by billing cycle
  const { data: cycleData } = await supabase
    .from('mv_mrr_by_cycle')
    .select('billingcycle, service_count, mrr_contribution')
    .eq('instance_id', instanceId)

  const mrr_by_cycle = (cycleData || []).map((c) => ({
    cycle: c.billingcycle || 'Unknown',
    count: c.service_count || 0,
    mrr: Number(c.mrr_contribution) || 0,
  }))

  return {
    mrr: Number(mrrData?.mrr) || 0,
    arr: Number(mrrData?.arr) || 0,
    active_services: mrrData?.active_services || 0,
    mrr_by_cycle,
    calculated_at: mrrData?.calculated_at || new Date().toISOString(),
  }
}

/**
 * Calculate MRR metrics for multiple WHMCS instances (summed)
 */
export async function calculateMrrMultiInstance(instanceIds: string[]): Promise<MrrMetrics> {
  const supabase = createAdminClient()

  // Get current MRR from materialized view for all instances
  const { data: mrrData } = await supabase
    .from('mv_mrr_current')
    .select('mrr, arr, active_services, calculated_at')
    .in('instance_id', instanceIds)

  // Sum MRR data across all instances
  const totals = (mrrData || []).reduce(
    (acc, row) => ({
      mrr: acc.mrr + (Number(row.mrr) || 0),
      arr: acc.arr + (Number(row.arr) || 0),
      active_services: acc.active_services + (row.active_services || 0),
    }),
    { mrr: 0, arr: 0, active_services: 0 }
  )

  // Get MRR by billing cycle (aggregated across instances)
  const { data: cycleData } = await supabase
    .from('mv_mrr_by_cycle')
    .select('billingcycle, service_count, mrr_contribution')
    .in('instance_id', instanceIds)

  // Aggregate by billing cycle
  const cycleMap = new Map<string, { count: number; mrr: number }>()
  ;(cycleData || []).forEach((c) => {
    const cycle = c.billingcycle || 'Unknown'
    const existing = cycleMap.get(cycle) || { count: 0, mrr: 0 }
    cycleMap.set(cycle, {
      count: existing.count + (c.service_count || 0),
      mrr: existing.mrr + (Number(c.mrr_contribution) || 0),
    })
  })

  const mrr_by_cycle = Array.from(cycleMap.entries()).map(([cycle, data]) => ({
    cycle,
    count: data.count,
    mrr: data.mrr,
  }))

  return {
    mrr: totals.mrr,
    arr: totals.arr,
    active_services: totals.active_services,
    mrr_by_cycle,
    calculated_at: new Date().toISOString(),
  }
}

/**
 * Normalize a billing amount to monthly equivalent
 * 
 * Converts amounts from any billing cycle to their monthly equivalent.
 * Used for MRR calculations where all revenue needs to be normalized.
 * 
 * @param amount - The billing amount
 * @param cycle - The billing cycle (monthly, quarterly, annually, etc.)
 * @returns The monthly equivalent amount
 * 
 * @example
 * ```typescript
 * normalizeToMonthly(120, 'annually')  // Returns 10
 * normalizeToMonthly(30, 'quarterly')  // Returns 10
 * normalizeToMonthly(10, 'monthly')    // Returns 10
 * ```
 */
export function normalizeToMonthly(amount: number, cycle: string): number {
  const cycleMap: Record<string, number> = {
    monthly: 1,
    quarterly: 3,
    'semi-annually': 6,
    semiannually: 6,
    annually: 12,
    biennially: 24,
    triennially: 36,
  }

  const divisor = cycleMap[cycle.toLowerCase()] || 1
  return amount / divisor
}
