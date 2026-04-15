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

    const revenueStatuses = await getRevenueInvoiceStatuses(supabase, auth.tenant_id)

    // Get invoices in period grouped by client
    const { data: invoices, error: invoicesError } = await supabase
      .from('whmcs_invoices')
      .select('client_id, instance_id, subtotal')
      .in('instance_id', instanceIds)
      .in('status', revenueStatuses)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
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
        existing.revenue += Number(inv.subtotal) || 0
      } else {
        clientRevenue.set(key, {
          client_id: inv.client_id,
          instance_id: inv.instance_id,
          revenue: Number(inv.subtotal) || 0,
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
      .select('whmcs_id, instance_id, firstname, lastname, companyname, status, current_mrr')
      .in('instance_id', instanceIds)
      .in('whmcs_id', clientWhmcsIds)

    // Build client name + MRR map from whmcs_clients.current_mrr
    // (current_mrr already includes hosting + domains + billable items via update_client_metrics)
    const clientNameMap = new Map<string, { name: string; status: string }>()
    const clientMrrMap = new Map<string, number>()
    clientRows?.forEach(c => {
      const key = `${c.instance_id}:${c.whmcs_id}`
      const name = c.companyname || `${c.firstname || ''} ${c.lastname || ''}`.trim() || 'Unknown'
      clientNameMap.set(key, { name, status: c.status || 'Unknown' })
      clientMrrMap.set(key, Number((c as any).current_mrr) || 0)
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
      // Sort by MRR — query whmcs_clients directly sorted by current_mrr (includes hosting + domains + billable items)
      const { data: topMrrClients } = await supabase
        .from('whmcs_clients')
        .select('whmcs_id, instance_id, firstname, lastname, companyname, status, current_mrr')
        .in('instance_id', instanceIds)
        .eq('status', 'Active')
        .gt('current_mrr', 0)
        .order('current_mrr', { ascending: false })
        .limit(limit)

      clients = (topMrrClients || []).map(c => {
        const key = `${c.instance_id}:${c.whmcs_id}`
        const name = c.companyname || `${c.firstname || ''} ${c.lastname || ''}`.trim() || 'Unknown'
        const revenueEntry = clientRevenue.get(key)
        return {
          client_id: c.whmcs_id,
          name,
          status: c.status || 'Unknown',
          revenue_in_period: Math.round((revenueEntry?.revenue || 0) * 100) / 100,
          current_mrr: Math.round((Number(c.current_mrr) || 0) * 100) / 100,
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
