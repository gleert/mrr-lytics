import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'
import { parseDateRange } from '@/utils/date-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/clients/stats - Get client statistics
 * 
 * Query params:
 * - instance_ids: Comma-separated list of WHMCS instance IDs (supports multiple)
 * - instance_id: Single instance ID (legacy, fallback)
 * - period: Preset period (today, 7d, 30d, 90d, 365d, ytd)
 * - status: Client status filter (active, inactive, closed, all)
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
    // const statusFilter = searchParams.get('status') || 'all'

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

    const { startDate, endDate, days } = parseDateRange(period, null, null)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get all clients for the specified instances
    const { data: clients, error: clientsError } = await supabase
      .from('whmcs_clients')
      .select('*')
      .in('instance_id', instanceIds)

    if (clientsError) {
      console.error('Clients query error:', clientsError)
      throw new Error(`Failed to fetch clients: ${clientsError.message}`)
    }

    // If no data yet, return empty stats instead of failing
    if (!clients || clients.length === 0) {
      return success({
        total_clients: 0,
        active_clients: 0,
        inactive_clients: 0,
        closed_clients: 0,
        new_clients: 0,
        churned_clients: 0,
        mrr: 0,
        arr: 0,
        arpu: 0,
        ltv: 0,
        revenue_in_period: 0,
        clients_with_revenue: 0,
        retention_rate: 0,
        net_growth: 0,
        avg_client_age_months: 0,
        clients_without_services: 0,
        revenue_concentration: 0,
        period: {
          type: period,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          days,
        },
        _notice: 'No data synced yet. Please sync your WHMCS instance first.',
      }, { instance_ids: instanceIds })
    }

    // Get all active services with their amounts
    const { data: services, error: servicesError } = await supabase
      .from('whmcs_hosting')
      .select('client_id, amount, billingcycle, domainstatus')
      .in('instance_id', instanceIds)
      .eq('domainstatus', 'Active')

    if (servicesError) {
      throw new Error('Failed to fetch services')
    }

    // Determine bucket granularity (same logic as forecasting)
    const bucketType: 'daily' | 'weekly' | 'monthly' =
      days <= 30 ? 'daily' : days <= 90 ? 'weekly' : 'monthly'

    const toBucketKey = (dateStr: string): string => {
      const d = new Date(dateStr)
      if (bucketType === 'daily') return dateStr.substring(0, 10)
      if (bucketType === 'weekly') {
        const weekStart = new Date(d)
        weekStart.setDate(d.getDate() - d.getDay())
        return weekStart.toISOString().substring(0, 10)
      }
      return dateStr.substring(0, 7) // YYYY-MM
    }

    // Get new clients in period (with datecreated for bucketing)
    const { data: newClients, error: newClientsError } = await supabase
      .from('whmcs_clients')
      .select('id, datecreated')
      .in('instance_id', instanceIds)
      .gte('datecreated', startDate.toISOString().split('T')[0])
      .lte('datecreated', endDate.toISOString().split('T')[0])

    if (newClientsError) {
      throw new Error('Failed to fetch new clients')
    }

    // Get churned clients — use synced_at as proxy for close date (WHMCS doesn't expose a close date)
    const { data: churnedClientsRaw, error: churnedError } = await supabase
      .from('whmcs_clients')
      .select('id, whmcs_id, instance_id, synced_at')
      .in('instance_id', instanceIds)
      .eq('status', 'Closed')
      .gte('synced_at', startDate.toISOString())
      .lte('synced_at', endDate.toISOString())

    if (churnedError) {
      throw new Error('Failed to fetch churned clients')
    }

    // Filter out spam/empty clients: only count churned if they had at least 1 service
    let churnedClients = churnedClientsRaw
    if (churnedClientsRaw && churnedClientsRaw.length > 0) {
      const churnedWhmcsIds = churnedClientsRaw.map(c => c.whmcs_id)
      const { data: churnedServices } = await supabase
        .from('whmcs_hosting')
        .select('client_id, instance_id')
        .in('instance_id', instanceIds)
        .in('client_id', churnedWhmcsIds)

      const clientsWithAnyService = new Set<string>()
      churnedServices?.forEach(s => {
        clientsWithAnyService.add(`${s.instance_id}:${s.client_id}`)
      })

      churnedClients = churnedClientsRaw.filter(c =>
        clientsWithAnyService.has(`${c.instance_id}:${c.whmcs_id}`)
      )
    }

    // Build time-series buckets for new clients
    const newClientsBuckets = new Map<string, number>()
    newClients?.forEach(c => {
      if (c.datecreated) {
        const key = toBucketKey(c.datecreated)
        newClientsBuckets.set(key, (newClientsBuckets.get(key) || 0) + 1)
      }
    })
    const newClientsTrend = Array.from(newClientsBuckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }))

    // Build time-series buckets for churned clients
    const churnedBuckets = new Map<string, number>()
    churnedClients?.forEach(c => {
      if (c.synced_at) {
        const key = toBucketKey(c.synced_at)
        churnedBuckets.set(key, (churnedBuckets.get(key) || 0) + 1)
      }
    })
    const churnedClientsTrend = Array.from(churnedBuckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }))

    // Build set of all client IDs that have ever had at least one service
    const { data: allServicesForClients } = await supabase
      .from('whmcs_hosting')
      .select('client_id, instance_id')
      .in('instance_id', instanceIds)

    const allClientsWithService = new Set<string>()
    allServicesForClients?.forEach(s => {
      allClientsWithService.add(`${s.instance_id}:${s.client_id}`)
    })

    // Calculate client counts by status (filter spam from Closed)
    const activeClients = clients?.filter(c => c.status === 'Active') || []
    const inactiveClients = clients?.filter(c => c.status === 'Inactive') || []
    const closedClients = clients?.filter(c =>
      c.status === 'Closed' && allClientsWithService.has(`${c.instance_id}:${c.whmcs_id}`)
    ) || []

    // Calculate MRR per client (for ARPU)
    const clientMrr: Record<number, number> = {}
    
    services?.forEach(service => {
      const monthlyAmount = calculateMonthlyAmount(Number(service.amount), service.billingcycle)
      if (!clientMrr[service.client_id]) {
        clientMrr[service.client_id] = 0
      }
      clientMrr[service.client_id] += monthlyAmount
    })

    // Calculate total MRR
    const totalMrr = Object.values(clientMrr).reduce((sum, mrr) => sum + mrr, 0)
    
    // Calculate ARPU (Average Revenue Per User)
    const clientsWithRevenue = Object.keys(clientMrr).length
    const arpu = clientsWithRevenue > 0 ? totalMrr / clientsWithRevenue : 0

    // Calculate average LTV (simplified: ARPU * average lifetime in months)
    const averageLifetimeMonths = 24
    const ltv = arpu * averageLifetimeMonths

    // Total real clients = active + inactive + closed (with services only)
    const totalRealClients = activeClients.length + inactiveClients.length + closedClients.length

    // Calculate retention rate
    const retentionRate = totalRealClients > 0
      ? Math.round((activeClients.length / totalRealClients) * 10000) / 100
      : 0

    // Net client growth
    const netGrowth = (newClients?.length || 0) - (churnedClients?.length || 0)

    // Average client age in months (from datecreated of active clients)
    const now = new Date()
    let totalAgeMonths = 0
    let clientsWithDate = 0
    activeClients.forEach(c => {
      if (c.datecreated) {
        const created = new Date(c.datecreated)
        const ageMonths = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
        totalAgeMonths += ageMonths
        clientsWithDate++
      }
    })
    const avgClientAgeMonths = clientsWithDate > 0 ? Math.round(totalAgeMonths / clientsWithDate) : 0

    // Active clients without services (services_count = 0)
    const activeClientIds = new Set(activeClients.map(c => c.whmcs_id))
    const clientsWithServices = new Set<number>()
    services?.forEach(s => {
      if (activeClientIds.has(s.client_id)) {
        clientsWithServices.add(s.client_id)
      }
    })
    const clientsWithoutServices = activeClients.length - clientsWithServices.size

    // Revenue concentration — % of MRR from top 5 clients
    const sortedClientMrr = Object.entries(clientMrr)
      .map(([id, mrr]) => ({ id, mrr }))
      .sort((a, b) => b.mrr - a.mrr)
    const top5Mrr = sortedClientMrr.slice(0, 5).reduce((sum, c) => sum + c.mrr, 0)
    const revenueConcentration = totalMrr > 0
      ? Math.round((top5Mrr / totalMrr) * 10000) / 100
      : 0

    // Get paid invoices for revenue calculation
    const { data: paidInvoices, error: invoicesError } = await supabase
      .from('whmcs_invoices')
      .select('total, client_id')
      .in('instance_id', instanceIds)
      .eq('status', 'Paid')
      .gte('datepaid', startDate.toISOString().split('T')[0])
      .lte('datepaid', endDate.toISOString().split('T')[0])

    if (invoicesError) {
      console.error('Invoices query error:', invoicesError)
      throw new Error(`Failed to fetch invoices: ${invoicesError.message}`)
    }

    const revenueInPeriod = paidInvoices?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0

    return success({
      total_clients: totalRealClients,
      active_clients: activeClients.length,
      inactive_clients: inactiveClients.length,
      closed_clients: closedClients.length,
      new_clients: newClients?.length || 0,
      churned_clients: churnedClients?.length || 0,
      mrr: totalMrr,
      arr: totalMrr * 12,
      arpu: Math.round(arpu * 100) / 100,
      ltv: Math.round(ltv * 100) / 100,
      revenue_in_period: revenueInPeriod,
      clients_with_revenue: clientsWithRevenue,
      // New metrics
      retention_rate: retentionRate,
      net_growth: netGrowth,
      avg_client_age_months: avgClientAgeMonths,
      clients_without_services: clientsWithoutServices,
      revenue_concentration: revenueConcentration,
      // Time-series trends
      new_clients_trend: newClientsTrend,
      churned_clients_trend: churnedClientsTrend,
      bucket_type: bucketType,
      period: {
        type: period,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        days,
      },
    }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/clients/stats:', err)
    return error(err instanceof Error ? err : new Error('Failed to get client stats'))
  }
}

/**
 * Convert billing cycle amount to monthly amount
 */
function calculateMonthlyAmount(amount: number, billingCycle: string): number {
  const cycleMap: Record<string, number> = {
    'Monthly': 1,
    'Quarterly': 3,
    'Semi-Annually': 6,
    'Annually': 12,
    'Biennially': 24,
    'Triennially': 36,
  }
  
  const months = cycleMap[billingCycle] || 1
  return amount / months
}
