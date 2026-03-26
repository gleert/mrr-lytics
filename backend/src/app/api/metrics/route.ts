import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { calculateMrrMultiInstance, calculateChurnMultiInstance, calculateRevenueByProductMultiInstance } from '@/lib/metrics'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'
import { parseDateRange } from '@/utils/date-helpers'
import { cached } from '@/lib/cache'

export const dynamic = 'force-dynamic'

/**
 * GET /api/metrics - Get all metrics summary
 * 
 * This endpoint first tries to read from metrics_daily (fast, pre-calculated).
 * If no data exists, it falls back to calculating from materialized views.
 * 
 * Query params:
 * - instance_ids: Comma-separated list of WHMCS instance IDs (supports multiple)
 * - instance_id: Single instance ID (legacy, fallback)
 * - period: Preset period (today, 7d, 30d, 90d, 365d, ytd)
 * - start_date: Custom start date (ISO format)
 * - end_date: Custom end date (ISO format)
 */
export async function GET(request: NextRequest) {
  try {
    const headersList = await headers()
    const auth = getAuthContext(headersList)

    if (!auth) {
      throw new UnauthorizedError('Authentication required')
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const instanceIdsParam = searchParams.get('instance_ids')
    const instanceIdParam = searchParams.get('instance_id')
    const period = searchParams.get('period') || '30d'
    const startDateParam = searchParams.get('start_date')
    const endDateParam = searchParams.get('end_date')

    // Support multiple instance IDs (comma-separated) or single instance_id
    let instanceIds: string[] = []
    if (instanceIdsParam) {
      instanceIds = instanceIdsParam.split(',').filter(id => id.trim())
    } else if (instanceIdParam) {
      instanceIds = [instanceIdParam]
    }

    if (instanceIds.length === 0) {
      throw new Error('No instance specified')
    }

    // Parse date range
    const { startDate, endDate, days } = parseDateRange(period, startDateParam, endDateParam)

    // Try to get metrics from metrics_daily first (fast path)
    const cacheKey = `metrics:${instanceIds.sort().join(',')}:${period}`
    const dailyMetrics = await cached(
      `daily:${cacheKey}`, 120, // 2 min TTL
      () => getMetricsFromDaily(instanceIds)
    )

    // Get previous period metrics for comparison (same period last month)
    const previousMetrics = await cached(
      `prev:${cacheKey}`, 300, // 5 min TTL
      () => getPreviousPeriodMetrics(instanceIds, days)
    )
    
    // Calculate percentage changes
    const calculateChange = (current: number, previous: number): number | undefined => {
      if (previous === 0) return current > 0 ? 100 : undefined
      return Math.round(((current - previous) / previous) * 10000) / 100
    }
    
    if (dailyMetrics) {
      // Fast path: use pre-calculated metrics
      const changes = previousMetrics ? {
        mrr_change: calculateChange(dailyMetrics.mrr, previousMetrics.mrr),
        arr_change: calculateChange(dailyMetrics.arr, previousMetrics.arr),
        active_clients_change: calculateChange(dailyMetrics.active_clients, previousMetrics.active_clients),
        churn_rate_change: previousMetrics.churn_rate !== undefined 
          ? Math.round((dailyMetrics.churn_rate - previousMetrics.churn_rate) * 100) / 100
          : undefined,
      } : {}
      
      return success({
        mrr: {
          mrr: dailyMetrics.mrr,
          arr: dailyMetrics.arr,
          active_services: dailyMetrics.active_services,
          mrr_by_cycle: dailyMetrics.mrr_by_cycle,
          calculated_at: dailyMetrics.updated_at,
          mrr_change: changes.mrr_change,
          arr_change: changes.arr_change,
        },
        churn: {
          period_days: days,
          period_start: startDate.toISOString(),
          period_end: endDate.toISOString(),
          churned_services: dailyMetrics.churned_services_day,
          churned_mrr: dailyMetrics.churned_mrr,
          churn_rate: dailyMetrics.churn_rate,
          churn_rate_change: changes.churn_rate_change,
        },
        revenue_by_product: dailyMetrics.top_products,
        clients: {
          total: dailyMetrics.total_clients,
          active: dailyMetrics.active_clients,
          inactive: dailyMetrics.inactive_clients,
          closed: dailyMetrics.closed_clients,
          active_change: changes.active_clients_change,
        },
        invoices: {
          paid_count: dailyMetrics.paid_invoices_day,
          unpaid_count: dailyMetrics.unpaid_invoices,
          total_paid: dailyMetrics.amount_paid_day,
          total_unpaid: dailyMetrics.amount_unpaid,
          revenue_last_30_days: dailyMetrics.revenue_mtd,
          overdue_count: dailyMetrics.overdue_invoices,
          amount_overdue: dailyMetrics.amount_overdue,
        },
        domains: {
          total: dailyMetrics.total_domains,
          active: dailyMetrics.active_domains,
          expiring_30d: dailyMetrics.expiring_domains_30d,
        },
        arpu: dailyMetrics.arpu,
        period: {
          type: period,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          days,
        },
        source: 'metrics_daily',
      }, { instance_ids: instanceIds })
    }

    // Fallback: Calculate metrics from materialized views
    const [mrr, churn, revenueByProduct, clientsAndInvoices] = await Promise.all([
      calculateMrrMultiInstance(instanceIds),
      calculateChurnMultiInstance(instanceIds, days),
      calculateRevenueByProductMultiInstance(instanceIds),
      getClientAndInvoiceSummaryMultiInstance(instanceIds, startDate, endDate),
    ])

    return success({
      mrr,
      churn,
      revenue_by_product: revenueByProduct,
      clients: clientsAndInvoices.clients,
      invoices: clientsAndInvoices.invoices,
      period: {
        type: period,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        days,
      },
      source: 'materialized_views',
    }, { instance_ids: instanceIds })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to get metrics'))
  }
}

/**
 * Get aggregated metrics from metrics_daily for today
 */
async function getMetricsFromDaily(instanceIds: string[]) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const today = new Date().toISOString().split('T')[0]

  const { data, error: dbError } = await supabase
    .from('metrics_daily')
    .select('*')
    .in('instance_id', instanceIds)
    .eq('date', today)

  if (dbError || !data || data.length === 0) {
    return null
  }

  // Aggregate across all instances
  const aggregated = data.reduce((acc, row) => ({
    mrr: acc.mrr + Number(row.mrr || 0),
    arr: acc.arr + Number(row.arr || 0),
    revenue_day: acc.revenue_day + Number(row.revenue_day || 0),
    revenue_mtd: acc.revenue_mtd + Number(row.revenue_mtd || 0),
    active_services: acc.active_services + (row.active_services || 0),
    new_services_day: acc.new_services_day + (row.new_services_day || 0),
    churned_services_day: acc.churned_services_day + (row.churned_services_day || 0),
    suspended_services: acc.suspended_services + (row.suspended_services || 0),
    total_clients: acc.total_clients + (row.total_clients || 0),
    active_clients: acc.active_clients + (row.active_clients || 0),
    inactive_clients: acc.inactive_clients + (row.inactive_clients || 0),
    closed_clients: acc.closed_clients + (row.closed_clients || 0),
    new_clients_day: acc.new_clients_day + (row.new_clients_day || 0),
    total_domains: acc.total_domains + (row.total_domains || 0),
    active_domains: acc.active_domains + (row.active_domains || 0),
    expiring_domains_30d: acc.expiring_domains_30d + (row.expiring_domains_30d || 0),
    paid_invoices_day: acc.paid_invoices_day + (row.paid_invoices_day || 0),
    unpaid_invoices: acc.unpaid_invoices + (row.unpaid_invoices || 0),
    overdue_invoices: acc.overdue_invoices + (row.overdue_invoices || 0),
    amount_paid_day: acc.amount_paid_day + Number(row.amount_paid_day || 0),
    amount_unpaid: acc.amount_unpaid + Number(row.amount_unpaid || 0),
    amount_overdue: acc.amount_overdue + Number(row.amount_overdue || 0),
    churned_mrr: acc.churned_mrr + Number(row.churned_mrr || 0),
    churn_rate: acc.churn_rate + Number(row.churn_rate || 0),
  }), {
    mrr: 0, arr: 0, revenue_day: 0, revenue_mtd: 0,
    active_services: 0, new_services_day: 0, churned_services_day: 0, suspended_services: 0,
    total_clients: 0, active_clients: 0, inactive_clients: 0, closed_clients: 0, new_clients_day: 0,
    total_domains: 0, active_domains: 0, expiring_domains_30d: 0,
    paid_invoices_day: 0, unpaid_invoices: 0, overdue_invoices: 0,
    amount_paid_day: 0, amount_unpaid: 0, amount_overdue: 0,
    churned_mrr: 0, churn_rate: 0,
  })

  // Average churn rate across instances
  aggregated.churn_rate = data.length > 0 ? aggregated.churn_rate / data.length : 0

  // Calculate ARPU
  const arpu = aggregated.active_clients > 0 
    ? Math.round((aggregated.mrr / aggregated.active_clients) * 100) / 100 
    : 0

  // Merge mrr_by_cycle from all instances
  const cycleMap = new Map<string, { count: number; mrr: number }>()
  data.forEach(row => {
    const cycles = row.mrr_by_cycle || []
    cycles.forEach((c: { cycle: string; count: number; mrr: number }) => {
      const existing = cycleMap.get(c.cycle) || { count: 0, mrr: 0 }
      cycleMap.set(c.cycle, {
        count: existing.count + c.count,
        mrr: existing.mrr + c.mrr,
      })
    })
  })
  const mrr_by_cycle = Array.from(cycleMap.entries()).map(([cycle, d]) => ({
    cycle,
    count: d.count,
    mrr: d.mrr,
  }))

  // Merge top_products (take top 10 by total MRR)
  const productMap = new Map<number, { product_name: string; product_type: string; active_count: number; mrr: number }>()
  data.forEach(row => {
    const products = row.top_products || []
    products.forEach((p: { product_id: number; product_name: string; product_type: string; active_count: number; mrr: number }) => {
      const existing = productMap.get(p.product_id)
      if (existing) {
        existing.active_count += p.active_count
        existing.mrr += p.mrr
      } else {
        productMap.set(p.product_id, {
          product_name: p.product_name,
          product_type: p.product_type,
          active_count: p.active_count,
          mrr: p.mrr,
        })
      }
    })
  })
  const top_products = Array.from(productMap.entries())
    .map(([product_id, d]) => ({ product_id, ...d }))
    .sort((a, b) => b.mrr - a.mrr)
    .slice(0, 10)

  return {
    ...aggregated,
    arpu,
    mrr_by_cycle,
    top_products,
    updated_at: data[0]?.updated_at || new Date().toISOString(),
  }
}

/**
 * Get metrics from same period last month for comparison
 */
async function getPreviousPeriodMetrics(instanceIds: string[], days: number) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Calculate the same day last month
  const today = new Date()
  const lastMonth = new Date(today)
  lastMonth.setMonth(lastMonth.getMonth() - 1)
  const lastMonthDate = lastMonth.toISOString().split('T')[0]

  const { data, error: dbError } = await supabase
    .from('metrics_daily')
    .select('mrr, arr, active_clients, churn_rate')
    .in('instance_id', instanceIds)
    .eq('date', lastMonthDate)

  if (dbError || !data || data.length === 0) {
    return null
  }

  // Aggregate across all instances
  const aggregated = data.reduce((acc, row) => ({
    mrr: acc.mrr + Number(row.mrr || 0),
    arr: acc.arr + Number(row.arr || 0),
    active_clients: acc.active_clients + (row.active_clients || 0),
    churn_rate: acc.churn_rate + Number(row.churn_rate || 0),
  }), { mrr: 0, arr: 0, active_clients: 0, churn_rate: 0 })

  // Average churn rate across instances
  aggregated.churn_rate = data.length > 0 ? aggregated.churn_rate / data.length : 0

  return aggregated
}

async function getClientAndInvoiceSummaryMultiInstance(instanceIds: string[], startDate: Date, endDate: Date) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get all clients
  const { data: allClients } = await supabase
    .from('whmcs_clients')
    .select('whmcs_id, instance_id, status')
    .in('instance_id', instanceIds)

  // Get client IDs that have at least one service (to filter spam)
  const { data: clientServices } = await supabase
    .from('whmcs_hosting')
    .select('client_id, instance_id')
    .in('instance_id', instanceIds)

  const clientsWithService = new Set<string>()
  clientServices?.forEach(s => {
    clientsWithService.add(`${s.instance_id}:${s.client_id}`)
  })

  // Count by status, excluding Closed clients without services
  const clientSummary = (allClients || []).reduce(
    (acc, c) => {
      if (c.status === 'Active') acc.active++
      else if (c.status === 'Inactive') acc.inactive++
      else if (c.status === 'Closed') {
        if (clientsWithService.has(`${c.instance_id}:${c.whmcs_id}`)) acc.closed++
        else return acc // skip spam
      }
      acc.total++
      return acc
    },
    { active: 0, inactive: 0, closed: 0, total: 0 }
  )

  // Get invoice summary with date filter (across all instances)
  const { data: invoices } = await supabase
    .from('whmcs_invoices')
    .select('status, total')
    .in('instance_id', instanceIds)
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0])

  // Calculate invoice metrics from filtered data
  const paidInvoices = invoices?.filter(i => i.status === 'Paid') || []
  const unpaidInvoices = invoices?.filter(i => i.status === 'Unpaid') || []

  return {
    clients: clientSummary,
    invoices: {
      paid_count: paidInvoices.length,
      unpaid_count: unpaidInvoices.length,
      total_paid: paidInvoices.reduce((sum, i) => sum + Number(i.total), 0),
      total_unpaid: unpaidInvoices.reduce((sum, i) => sum + Number(i.total), 0),
      revenue_last_30_days: paidInvoices.reduce((sum, i) => sum + Number(i.total), 0),
    },
  }
}
