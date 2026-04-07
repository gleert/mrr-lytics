import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'
import { parseDateRange } from '@/utils/date-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/clients/top-clients - Get top clients by revenue in period
 *
 * Query params:
 * - instance_ids: Comma-separated list of WHMCS instance IDs
 * - limit: Number of clients to return (default: 6, max: 10)
 * - period: Time period (default: 30d)
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
    const limitParam = searchParams.get('limit') || '6'
    const period = searchParams.get('period') || '30d'
    const startDateParam = searchParams.get('start_date')
    const endDateParam = searchParams.get('end_date')
    const sortBy = searchParams.get('sort_by') || 'revenue' // 'revenue' or 'mrr'

    let instanceIds: string[] = []
    if (instanceIdsParam) {
      instanceIds = instanceIdsParam.split(',').filter(id => id.trim())
    } else if (instanceIdParam) {
      instanceIds = [instanceIdParam]
    }

    if (instanceIds.length === 0) {
      throw new Error('No instance specified')
    }

    const limit = Math.min(10, Math.max(1, parseInt(limitParam, 10)))
    const { startDate, endDate } = parseDateRange(period, startDateParam, endDateParam)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get paid invoices in period, grouped by client
    const { data: invoices, error: invoicesError } = await supabase
      .from('whmcs_invoices')
      .select('client_id, instance_id, total')
      .in('instance_id', instanceIds)
      .eq('status', 'Paid')
      .gte('datepaid', startDate.toISOString().split('T')[0])
      .lte('datepaid', endDate.toISOString().split('T')[0])
      .gt('total', 0)

    if (invoicesError) {
      console.error('Invoices query error:', invoicesError)
      return success({ clients: [], total_revenue: 0 }, { instance_ids: instanceIds })
    }

    if (!invoices || invoices.length === 0) {
      return success({ clients: [], total_revenue: 0 }, { instance_ids: instanceIds })
    }

    // Aggregate revenue per client
    const clientRevenue = new Map<string, { client_id: number; instance_id: string; revenue: number }>()
    invoices.forEach(inv => {
      const key = `${inv.instance_id}:${inv.client_id}`
      const existing = clientRevenue.get(key)
      if (existing) {
        existing.revenue += Number(inv.total) || 0
      } else {
        clientRevenue.set(key, {
          client_id: inv.client_id,
          instance_id: inv.instance_id,
          revenue: Number(inv.total) || 0,
        })
      }
    })

    // Sort by revenue descending, take top N
    const topEntries = Array.from(clientRevenue.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit)

    if (topEntries.length === 0) {
      return success({ clients: [], total_revenue: 0 }, { instance_ids: instanceIds })
    }

    // Fetch client details
    const clientWhmcsIds = topEntries.map(e => e.client_id)
    const { data: clientRows } = await supabase
      .from('whmcs_clients')
      .select('whmcs_id, instance_id, firstname, lastname, companyname, status')
      .in('instance_id', instanceIds)
      .in('whmcs_id', clientWhmcsIds)

    // Also fetch current MRR from active hosting services
    const { data: hostingRows } = await supabase
      .from('whmcs_hosting')
      .select('client_id, instance_id, amount, billingcycle')
      .in('instance_id', instanceIds)
      .in('client_id', clientWhmcsIds)
      .eq('domainstatus', 'Active')

    // Build client name map
    const clientNameMap = new Map<string, { name: string; status: string }>()
    clientRows?.forEach(c => {
      const key = `${c.instance_id}:${c.whmcs_id}`
      const name = c.companyname || `${c.firstname || ''} ${c.lastname || ''}`.trim() || 'Unknown'
      clientNameMap.set(key, { name, status: c.status || 'Unknown' })
    })

    // Build MRR map per client
    const toMonthlyAmount = (amount: number, cycle: string): number => {
      const map: Record<string, number> = {
        monthly: 1, quarterly: 3, 'semi-annually': 6, semiannually: 6,
        annually: 12, yearly: 12, biennially: 24, triennially: 36,
      }
      return amount / (map[cycle?.toLowerCase()] || 1)
    }

    const clientMrrMap = new Map<string, number>()
    hostingRows?.forEach(h => {
      const key = `${h.instance_id}:${h.client_id}`
      const monthly = toMonthlyAmount(Number(h.amount) || 0, h.billingcycle)
      clientMrrMap.set(key, (clientMrrMap.get(key) || 0) + monthly)
    })

    // Build final result based on sort_by
    let clients: Array<{
      client_id: number
      name: string
      status: string
      revenue_in_period: number
      current_mrr: number
    }>

    if (sortBy === 'mrr') {
      // Sort by MRR — take clients with highest current MRR
      const allMrrClients = Array.from(clientMrrMap.entries())
        .map(([key, mrr]) => {
          const [instanceId, clientIdStr] = key.split(':')
          return { key, instance_id: instanceId, client_id: parseInt(clientIdStr), mrr }
        })
        .sort((a, b) => b.mrr - a.mrr)
        .slice(0, limit)

      // If we need more client details, fetch them
      const mrrClientIds = allMrrClients.map(c => c.client_id)
      if (mrrClientIds.length > 0) {
        const { data: mrrClientRows } = await supabase
          .from('whmcs_clients')
          .select('whmcs_id, instance_id, firstname, lastname, companyname, status')
          .in('instance_id', instanceIds)
          .in('whmcs_id', mrrClientIds)

        mrrClientRows?.forEach(c => {
          const key = `${c.instance_id}:${c.whmcs_id}`
          if (!clientNameMap.has(key)) {
            const name = c.companyname || `${c.firstname || ''} ${c.lastname || ''}`.trim() || 'Unknown'
            clientNameMap.set(key, { name, status: c.status || 'Unknown' })
          }
        })
      }

      clients = allMrrClients.map(entry => {
        const info = clientNameMap.get(entry.key)
        const revenueEntry = clientRevenue.get(entry.key)
        return {
          client_id: entry.client_id,
          name: info?.name || 'Unknown Client',
          status: info?.status || 'Unknown',
          revenue_in_period: Math.round((revenueEntry?.revenue || 0) * 100) / 100,
          current_mrr: Math.round(entry.mrr * 100) / 100,
        }
      })
    } else {
      // Sort by revenue (default)
      clients = topEntries.map(entry => {
        const key = `${entry.instance_id}:${entry.client_id}`
        const info = clientNameMap.get(key)
        return {
          client_id: entry.client_id,
          name: info?.name || 'Unknown Client',
          status: info?.status || 'Unknown',
          revenue_in_period: Math.round(entry.revenue * 100) / 100,
          current_mrr: Math.round((clientMrrMap.get(key) || 0) * 100) / 100,
        }
      })
    }

    const totalRevenue = topEntries.reduce((sum, e) => sum + e.revenue, 0)
    const totalMrr = clients.reduce((sum, c) => sum + c.current_mrr, 0)

    return success({
      clients,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_mrr: Math.round(totalMrr * 100) / 100,
      sort_by: sortBy,
    }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/clients/top-clients:', err)
    return error(err instanceof Error ? err : new Error('Failed to get top clients'))
  }
}
