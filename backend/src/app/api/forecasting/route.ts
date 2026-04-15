import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'
import { parseDateRange } from '@/utils/date-helpers'
import { getRevenueInvoiceStatuses } from '@/lib/tenants/settings'

export const dynamic = 'force-dynamic'

/**
 * GET /api/forecasting - Get forecasting statistics
 * 
 * Calculates projections based on the selected period:
 * - Current Committed MRR: MRR from active services
 * - Projected MRR: MRR projected based on trends within the period
 * - Projected Growth: Expected growth percentage based on period trends
 * - Projected ARR: Annual projection
 * - Confidence Level: Based on data quality and trends
 * 
 * The period determines:
 * - Which historical data to analyze for trends
 * - The timeframe for growth calculations
 */
export async function GET(request: NextRequest) {
  try {
    const headersList = await headers()
    const auth = getAuthContext(headersList)

    if (!auth) {
      throw new UnauthorizedError('Authentication required')
    }

    const { searchParams } = new URL(request.url)
    const instanceIdsParam = searchParams.get('instance_ids')
    const instanceIdParam = searchParams.get('instance_id')
    const period = searchParams.get('period') || '30d'
    const startDateParam = searchParams.get('start_date')
    const endDateParam = searchParams.get('end_date')

    let instanceIds: string[] = []
    if (instanceIdsParam) {
      instanceIds = instanceIdsParam.split(',').filter(id => id.trim())
    } else if (instanceIdParam) {
      instanceIds = [instanceIdParam]
    }

    if (instanceIds.length === 0) {
      throw new Error('No instance specified')
    }

    // Parse the period to get date range
    const { startDate, endDate, days } = parseDateRange(period, startDateParam, endDateParam)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get active hosting services + recurring billable items + domains in parallel
    const [
      { data: hostingServices, error: hostingError },
      { data: billableItems },
      { data: activeDomains },
    ] = await Promise.all([
      supabase
        .from('whmcs_hosting')
        .select('amount, billingcycle, domainstatus')
        .in('instance_id', instanceIds)
        .eq('domainstatus', 'Active'),
      supabase
        .from('whmcs_billable_items')
        .select('amount, recurcycle, recurfor, invoicecount')
        .in('instance_id', instanceIds)
        .eq('invoice_action', 4)
        .gt('invoicecount', 0)
        .limit(10000),
      supabase
        .from('whmcs_domains')
        .select('recurringamount, registrationperiod')
        .in('instance_id', instanceIds)
        .eq('status', 'Active'),
    ])

    if (hostingError) {
      console.error('Hosting query error:', hostingError)
      throw new Error('Failed to fetch hosting data')
    }

    // Calculate current MRR from active services AND breakdown by billing cycle
    let currentMRR = 0
    const billingCycleBreakdown = new Map<string, { count: number; mrr: number; total: number }>()

    // Helper to convert billing cycle to monthly amount
    const toMonthlyAmount = (amount: number, cycle: string): number => {
      switch ((cycle || '').toLowerCase()) {
        case 'monthly':
        case 'months':
        case 'month': return amount
        case 'quarterly': return amount / 3
        case 'semi-annually':
        case 'semiannually': return amount / 6
        case 'annually':
        case 'yearly':
        case 'years':
        case 'year': return amount / 12
        case 'biennially': return amount / 24
        case 'triennially': return amount / 36
        default: return 0
      }
    }

    // Normalize billing cycle names for display
    const normalizeCycleName = (cycle: string): string => {
      switch (cycle) {
        case 'monthly': return 'Monthly'
        case 'quarterly': return 'Quarterly'
        case 'semi-annually':
        case 'semiannually': return 'Semi-Annually'
        case 'annually':
        case 'yearly': return 'Annually'
        case 'biennially': return 'Biennially'
        case 'triennially': return 'Triennially'
        case 'free account':
        case 'free': return 'Free'
        case 'one time':
        case 'onetime': return 'One Time'
        default: return cycle ? cycle.charAt(0).toUpperCase() + cycle.slice(1) : 'Unknown'
      }
    }

    hostingServices?.forEach(service => {
      const amount = Number(service.amount) || 0
      const cycle = service.billingcycle?.toLowerCase() || 'monthly'
      const monthlyAmount = toMonthlyAmount(amount, cycle)
      currentMRR += monthlyAmount

      // Track breakdown by billing cycle
      const cycleName = normalizeCycleName(cycle)
      const existing = billingCycleBreakdown.get(cycleName) || { count: 0, mrr: 0, total: 0 }
      billingCycleBreakdown.set(cycleName, {
        count: existing.count + 1,
        mrr: existing.mrr + monthlyAmount,
        total: existing.total + amount,
      })
    })

    // Add recurring billable items (filter in JS — PostgREST column comparison bug)
    const activeBillable = (billableItems ?? []).filter(
      item => (item.recurfor ?? 0) === 0 || (item.invoicecount ?? 0) < (item.recurfor ?? 0)
    )
    activeBillable.forEach(item => {
      const amount = Number(item.amount) || 0
      const cycle = (item.recurcycle || '').toLowerCase()
      const monthlyAmount = toMonthlyAmount(amount, cycle)
      if (monthlyAmount === 0) return
      currentMRR += monthlyAmount

      const cycleName = normalizeCycleName(cycle)
      const existing = billingCycleBreakdown.get(cycleName) || { count: 0, mrr: 0, total: 0 }
      billingCycleBreakdown.set(cycleName, {
        count: existing.count + 1,
        mrr: existing.mrr + monthlyAmount,
        total: existing.total + amount,
      })
    })

    // Add active domain recurring revenue (annual recurringamount normalized to monthly)
    activeDomains?.forEach(domain => {
      const annual = Number(domain.recurringamount) || 0
      const period = Number(domain.registrationperiod) || 1
      const monthlyAmount = annual > 0 && period > 0 ? annual / (period * 12) : 0
      if (monthlyAmount === 0) return
      currentMRR += monthlyAmount

      const cycleName = 'Annually'
      const existing = billingCycleBreakdown.get(cycleName) || { count: 0, mrr: 0, total: 0 }
      billingCycleBreakdown.set(cycleName, {
        count: existing.count + 1,
        mrr: existing.mrr + monthlyAmount,
        total: existing.total + annual,
      })
    })

    const revenueStatuses = await getRevenueInvoiceStatuses(supabase, auth.tenant_id)

    // Get historical invoice data within the selected period for trend analysis.
    // Use invoice date (not payment date) — MRR is committed when billed.
    const { data: periodInvoices, error: invoicesError } = await supabase
      .from('whmcs_invoices')
      .select('subtotal, date')
      .in('instance_id', instanceIds)
      .in('status', revenueStatuses)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true })

    if (invoicesError) {
      console.error('Invoices query error:', invoicesError)
    }

    // Calculate revenue by time bucket based on period length
    // For shorter periods, use daily buckets; for longer periods, use weekly/monthly
    const revenueByBucket = new Map<string, number>()
    let bucketFormat: 'daily' | 'weekly' | 'monthly'
    
    if (days <= 30) {
      bucketFormat = 'daily'
    } else if (days <= 90) {
      bucketFormat = 'weekly'
    } else {
      bucketFormat = 'monthly'
    }

    periodInvoices?.forEach(invoice => {
      if (invoice.date) {
        let bucketKey: string
        const invoiceDate = new Date(invoice.date)

        switch (bucketFormat) {
          case 'daily':
            bucketKey = invoice.date.substring(0, 10) // YYYY-MM-DD
            break
          case 'weekly':
            // Get the week number
            const weekStart = new Date(invoiceDate)
            weekStart.setDate(invoiceDate.getDate() - invoiceDate.getDay())
            bucketKey = weekStart.toISOString().substring(0, 10)
            break
          case 'monthly':
          default:
            bucketKey = invoice.date.substring(0, 7) // YYYY-MM
            break
        }
        
        revenueByBucket.set(bucketKey, (revenueByBucket.get(bucketKey) || 0) + (Number(invoice.subtotal) || 0))
      }
    })

    // Sort buckets chronologically and get values
    const sortedBuckets = Array.from(revenueByBucket.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    const revenueValues = sortedBuckets.map(([_, value]) => value)
    
    let growthRate = 0
    let confidenceLevel = 30 // Base confidence (lower for shorter periods)

    // Need at least 2 data points to calculate growth
    if (revenueValues.length >= 2) {
      // Calculate average period-over-period growth
      let totalGrowth = 0
      let growthCount = 0
      for (let i = 1; i < revenueValues.length; i++) {
        if (revenueValues[i - 1] > 0) {
          totalGrowth += (revenueValues[i] - revenueValues[i - 1]) / revenueValues[i - 1]
          growthCount++
        }
      }
      growthRate = growthCount > 0 ? (totalGrowth / growthCount) * 100 : 0
      
      // Adjust confidence based on data availability and period length
      const dataPointBonus = Math.min(30, revenueValues.length * 5)
      const periodBonus = Math.min(20, Math.floor(days / 30) * 5)
      confidenceLevel = Math.min(95, 30 + dataPointBonus + periodBonus)
      // Scale confidence down proportionally to data density (applied after caps below)
      
      // Adjust confidence based on revenue consistency
      if (revenueValues.length >= 3) {
        const avgRevenue = revenueValues.reduce((a, b) => a + b, 0) / revenueValues.length
        const variance = revenueValues.reduce((sum, val) => sum + Math.pow(val - avgRevenue, 2), 0) / revenueValues.length
        const stdDev = Math.sqrt(variance)
        const coefficientOfVariation = avgRevenue > 0 ? stdDev / avgRevenue : 1
        
        // Lower confidence if revenue is highly variable
        if (coefficientOfVariation > 0.5) {
          confidenceLevel = Math.max(20, confidenceLevel - 20)
        } else if (coefficientOfVariation < 0.2) {
          confidenceLevel = Math.min(95, confidenceLevel + 10)
        }
      }
    }

    // Cap growth rate to realistic bounds for a recurring-revenue business.
    // Invoice buckets are noisy (lumpy payments), so raw growth rates are unreliable.
    // ±20% per period is already aggressive for an established hosting/SaaS company.
    growthRate = Math.max(-20, Math.min(20, growthRate))

    // Dampen growth rate when data is sparse — projection should be near-flat with few points.
    // Use quadratic dampening so the curve flattens quickly: at 50% of required points,
    // growth is only 25% of its value; at 7/30 daily points it drops to ~5%.
    // Thresholds: daily needs 30+, weekly needs 12+, monthly needs 6+.
    const sufficientPoints = bucketFormat === 'monthly' ? 6 : bucketFormat === 'weekly' ? 12 : 30
    const dataConfidence = Math.min(1, revenueValues.length / sufficientPoints)
    const dampingFactor = Math.pow(dataConfidence, 2) // quadratic — aggressive flattening
    growthRate = growthRate * dampingFactor

    // Scale confidence level down with the same factor — low data → low confidence
    confidenceLevel = Math.max(5, Math.round(confidenceLevel * dampingFactor))

    // Project next period MRR based on current MRR and observed growth
    const projectedMRR = currentMRR * (1 + growthRate / 100)

    // Calculate projected ARR
    const projectedARR = projectedMRR * 12

    // Calculate scenario projections (pessimistic, baseline, optimistic)
    // Based on standard deviation of growth rates if we have enough data
    let growthStdDev = 0
    if (revenueValues.length >= 3) {
      const growthRates: number[] = []
      for (let i = 1; i < revenueValues.length; i++) {
        if (revenueValues[i - 1] > 0) {
          growthRates.push((revenueValues[i] - revenueValues[i - 1]) / revenueValues[i - 1] * 100)
        }
      }
      if (growthRates.length >= 2) {
        const avgGrowthRate = growthRates.reduce((a, b) => a + b, 0) / growthRates.length
        const variance = growthRates.reduce((sum, val) => sum + Math.pow(val - avgGrowthRate, 2), 0) / growthRates.length
        growthStdDev = Math.sqrt(variance)
      }
    }

    // Use stdDev for scenario spread, capped at ±5% to keep scenarios realistic.
    // Also dampen the spread proportionally to data confidence so scenarios converge
    // toward baseline when data is sparse.
    const scenarioSpread = Math.max(1, Math.min(5, growthStdDev)) * dataConfidence
    
    // Pessimistic: baseline growth minus spread — always <= baseline
    const pessimisticGrowth = growthRate - scenarioSpread
    const pessimisticMRR = currentMRR * (1 + pessimisticGrowth / 100)
    const pessimisticARR = pessimisticMRR * 12

    // Baseline: uses the calculated growth rate (already computed as projectedMRR/ARR)
    
    // Optimistic: baseline growth plus spread — always >= baseline (no artificial ceiling that would invert the order)
    const optimisticGrowth = growthRate + scenarioSpread
    const optimisticMRR = currentMRR * (1 + optimisticGrowth / 100)
    const optimisticARR = optimisticMRR * 12

    // Scenario comparison data
    const scenarios = {
      pessimistic: {
        growth: Math.round(pessimisticGrowth * 100) / 100,
        mrr: Math.round(pessimisticMRR * 100) / 100,
        arr: Math.round(pessimisticARR * 100) / 100,
      },
      baseline: {
        growth: Math.round(growthRate * 100) / 100,
        mrr: Math.round(projectedMRR * 100) / 100,
        arr: Math.round(projectedARR * 100) / 100,
      },
      optimistic: {
        growth: Math.round(optimisticGrowth * 100) / 100,
        mrr: Math.round(optimisticMRR * 100) / 100,
        arr: Math.round(optimisticARR * 100) / 100,
      },
    }

    // Get active clients count for ARPU calculation
    const { count: activeClients } = await supabase
      .from('whmcs_clients')
      .select('*', { count: 'exact', head: true })
      .in('instance_id', instanceIds)
      .eq('status', 'Active')

    const activeClientsCount = activeClients || 0
    const currentArpu = activeClientsCount > 0 ? currentMRR / activeClientsCount : 0
    const projectedArpu = activeClientsCount > 0 ? projectedMRR / activeClientsCount : 0

    // Calculate growth acceleration (is growth speeding up or slowing down?)
    let growthAcceleration: 'accelerating' | 'stable' | 'decelerating' = 'stable'
    if (revenueValues.length >= 4) {
      const midpoint = Math.floor(revenueValues.length / 2)
      const firstHalf = revenueValues.slice(0, midpoint)
      const secondHalf = revenueValues.slice(midpoint)

      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

      if (avgFirst > 0) {
        const halfGrowth = ((avgSecond - avgFirst) / avgFirst) * 100
        if (halfGrowth > 3) growthAcceleration = 'accelerating'
        else if (halfGrowth < -3) growthAcceleration = 'decelerating'
      }
    }

    // Calculate months to next milestone
    const milestones = [1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000]
    let nextMilestone: number | null = null
    let monthsToMilestone: number | null = null

    if (growthRate > 0 && currentMRR > 0) {
      nextMilestone = milestones.find(m => m > currentMRR) || null
      if (nextMilestone) {
        // months = ln(target/current) / ln(1 + monthlyGrowthRate)
        const monthlyGrowthDecimal = growthRate / 100
        if (monthlyGrowthDecimal > 0) {
          monthsToMilestone = Math.ceil(
            Math.log(nextMilestone / currentMRR) / Math.log(1 + monthlyGrowthDecimal)
          )
          // Cap at reasonable value
          if (monthsToMilestone > 120) monthsToMilestone = null
        }
      }
    }

    // Calculate total revenue in period
    const periodRevenue = revenueValues.reduce((sum, val) => sum + val, 0)

    // Format revenue trend data for charts
    const revenueTrend = sortedBuckets.map(([date, value]) => ({
      date,
      revenue: Math.round(value * 100) / 100,
    }))

    // Add projected data point (next period)
    if (revenueTrend.length > 0) {
      const lastDate = revenueTrend[revenueTrend.length - 1].date
      let nextDate: string
      
      if (bucketFormat === 'daily') {
        const d = new Date(lastDate)
        d.setDate(d.getDate() + 1)
        nextDate = d.toISOString().substring(0, 10)
      } else if (bucketFormat === 'weekly') {
        const d = new Date(lastDate)
        d.setDate(d.getDate() + 7)
        nextDate = d.toISOString().substring(0, 10)
      } else {
        const d = new Date(lastDate + '-01')
        d.setMonth(d.getMonth() + 1)
        nextDate = d.toISOString().substring(0, 7)
      }

      // Calculate projected value for next period based on average and growth
      const avgRevenue = periodRevenue / revenueValues.length
      const projectedPeriodRevenue = avgRevenue * (1 + growthRate / 100)
      
      revenueTrend.push({
        date: nextDate,
        revenue: Math.round(projectedPeriodRevenue * 100) / 100,
      })
    }

    // Format billing cycle breakdown for charts (sorted by MRR descending, max 6)
    const billingCycleData = Array.from(billingCycleBreakdown.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        mrr: Math.round(data.mrr * 100) / 100,
        total: Math.round(data.total * 100) / 100,
      }))
      .sort((a, b) => b.mrr - a.mrr)
      .slice(0, 6)

    return success({
      current_mrr: Math.round(currentMRR * 100) / 100,
      projected_mrr: Math.round(projectedMRR * 100) / 100,
      projected_growth: Math.round(growthRate * 100) / 100,
      projected_arr: Math.round(projectedARR * 100) / 100,
      confidence_level: Math.round(confidenceLevel),
      data_points: revenueValues.length,
      period_days: days,
      period_revenue: Math.round(periodRevenue * 100) / 100,
      bucket_type: bucketFormat,
      // ARPU
      active_clients: activeClientsCount,
      current_arpu: Math.round(currentArpu * 100) / 100,
      projected_arpu: Math.round(projectedArpu * 100) / 100,
      // Growth acceleration
      growth_acceleration: growthAcceleration,
      // Milestone
      next_milestone: nextMilestone,
      months_to_milestone: monthsToMilestone,
      // MRR delta
      mrr_delta: Math.round((projectedMRR - currentMRR) * 100) / 100,
      // Breakdown data
      revenue_trend: revenueTrend,
      billing_cycle_breakdown: billingCycleData,
      // Scenario comparison
      scenarios,
    }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/forecasting:', err)
    return error(err instanceof Error ? err : new Error('Failed to get forecasting data'))
  }
}
