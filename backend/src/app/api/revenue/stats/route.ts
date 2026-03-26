import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'
import { parseDateRange } from '@/utils/date-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/revenue/stats - Get revenue statistics
 * 
 * Returns:
 * - total_revenue: Total revenue in period
 * - recurring_revenue: Revenue from recurring services (MRR normalized)
 * - onetime_revenue: Revenue from one-time charges
 * - recurring_percentage: Percentage of revenue that is recurring
 * - mrr: Current MRR
 * - arr: Current ARR (MRR * 12)
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

    // Get all invoices in period (Paid + Unpaid)
    const { data: invoices, error: invoicesError } = await supabase
      .from('whmcs_invoices')
      .select('whmcs_id, total, subtotal, status, datepaid, date')
      .in('instance_id', instanceIds)
      .in('status', ['Paid', 'Unpaid', 'Payment Pending'])
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString())

    if (invoicesError) {
      console.error('Invoices query error:', invoicesError)
      // Return empty stats if table is empty or query fails gracefully
    }

    // Handle case when no data is synced yet
    if (!invoices || invoices.length === 0) {
      return success({
        total_revenue: 0,
        recurring_revenue: 0,
        onetime_revenue: 0,
        recurring_percentage: 0,
        mrr: 0,
        arr: 0,
        revenue_change: 0,
        recurring_change: 0,
        onetime_change: 0,
        recurring_pct_change: 0,
        invoices_count: 0,
        avg_invoice_amount: 0,
        paid_total: 0,
        paid_count: 0,
        unpaid_total: 0,
        unpaid_count: 0,
        projected_next_period: 0,
        recent_paid: [],
        top_product: null,
        period: {
          type: period,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          days,
        },
        _notice: 'No data synced yet. Please sync your WHMCS instance first.',
      }, { instance_ids: instanceIds })
    }

    // Get invoice items to categorize revenue (use whmcs_id)
    const invoiceWhmcsIds = invoices?.map(i => i.whmcs_id) || []
    
    let recurringRevenue = 0
    let onetimeRevenue = 0

    if (invoiceWhmcsIds.length > 0) {
      // Process in batches to avoid query limits
      const BATCH_SIZE = 500
      const allItems: { type: string | null; amount: string | number | null; description: string | null }[] = []
      
      for (let i = 0; i < invoiceWhmcsIds.length; i += BATCH_SIZE) {
        const batch = invoiceWhmcsIds.slice(i, i + BATCH_SIZE)
        const { data: batchItems, error: itemsError } = await supabase
          .from('whmcs_invoice_items')
          .select('type, amount, description')
          .in('instance_id', instanceIds)
          .in('invoice_id', batch)

        if (itemsError) {
          console.error('Invoice items query error:', itemsError)
          break
        }
        
        if (batchItems) {
          allItems.push(...batchItems)
        }
      }

      // Categorize items
      // Recurring types: Hosting, Domain (renewals), etc.
      // One-time types: Setup, Addon, DomainRegister, etc.
      const recurringTypes = ['Hosting', 'DomainRenew', 'Domain']
      const onetimeTypes = ['Setup', 'Addon', 'DomainRegister', 'PromoHosting', 'Item']

      allItems.forEach(item => {
        const amount = Number(item.amount) || 0
        const type = item.type || ''
        if (recurringTypes.includes(type)) {
          recurringRevenue += amount
        } else if (onetimeTypes.includes(type)) {
          onetimeRevenue += amount
        } else {
          // Default: check description for hints, otherwise treat as one-time
          const desc = (item.description || '').toLowerCase()
          if (desc.includes('renew') || desc.includes('hosting') || desc.includes('monthly') || desc.includes('annual')) {
            recurringRevenue += amount
          } else {
            onetimeRevenue += amount
          }
        }
      })
    }

    const totalRevenue = invoices?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0
    
    // If we couldn't categorize from items, estimate from total
    if (recurringRevenue === 0 && onetimeRevenue === 0 && totalRevenue > 0) {
      // Fallback: assume 80% recurring as typical for hosting companies
      recurringRevenue = totalRevenue * 0.8
      onetimeRevenue = totalRevenue * 0.2
    }

    const recurringPercentage = totalRevenue > 0 
      ? Math.round((recurringRevenue / totalRevenue) * 100) 
      : 0

    // Get current MRR from active services
    const { data: services, error: servicesError } = await supabase
      .from('whmcs_hosting')
      .select('amount, billingcycle')
      .in('instance_id', instanceIds)
      .eq('domainstatus', 'Active')

    if (servicesError) {
      throw new Error('Failed to fetch services')
    }

    // Calculate MRR
    let mrr = 0
    services?.forEach(service => {
      const amount = Number(service.amount) || 0
      const monthly = normalizeToMonthly(amount, service.billingcycle)
      mrr += monthly
    })

    const arr = mrr * 12

    // Get previous period for comparison
    const prevStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000)
    const prevEndDate = new Date(startDate.getTime() - 1)

    const { data: prevInvoices } = await supabase
      .from('whmcs_invoices')
      .select('whmcs_id, total')
      .in('instance_id', instanceIds)
      .in('status', ['Paid', 'Unpaid', 'Payment Pending'])
      .gte('date', prevStartDate.toISOString())
      .lte('date', prevEndDate.toISOString())

    const prevTotalRevenue = prevInvoices?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0

    // Calculate prev period recurring/onetime breakdown
    let prevRecurringRevenue = 0
    let prevOnetimeRevenue = 0

    const prevInvoiceIds = prevInvoices?.map(i => i.whmcs_id) || []
    if (prevInvoiceIds.length > 0) {
      const BATCH_SIZE = 500
      const recurringTypes = ['Hosting', 'DomainRenew', 'Domain']
      const onetimeTypes = ['Setup', 'Addon', 'DomainRegister', 'PromoHosting', 'Item']

      for (let i = 0; i < prevInvoiceIds.length; i += BATCH_SIZE) {
        const batch = prevInvoiceIds.slice(i, i + BATCH_SIZE)
        const { data: batchItems } = await supabase
          .from('whmcs_invoice_items')
          .select('type, amount, description')
          .in('instance_id', instanceIds)
          .in('invoice_id', batch)

        batchItems?.forEach(item => {
          const amount = Number(item.amount) || 0
          const type = item.type || ''
          if (recurringTypes.includes(type)) {
            prevRecurringRevenue += amount
          } else if (onetimeTypes.includes(type)) {
            prevOnetimeRevenue += amount
          } else {
            const desc = (item.description || '').toLowerCase()
            if (desc.includes('renew') || desc.includes('hosting') || desc.includes('monthly') || desc.includes('annual')) {
              prevRecurringRevenue += amount
            } else {
              prevOnetimeRevenue += amount
            }
          }
        })
      }

      // Fallback estimate if no items found
      if (prevRecurringRevenue === 0 && prevOnetimeRevenue === 0 && prevTotalRevenue > 0) {
        prevRecurringRevenue = prevTotalRevenue * 0.8
        prevOnetimeRevenue = prevTotalRevenue * 0.2
      }
    }

    const prevRecurringPercentage = prevTotalRevenue > 0
      ? Math.round((prevRecurringRevenue / prevTotalRevenue) * 100)
      : 0

    const calcChange = (current: number, prev: number) =>
      prev > 0 ? Math.round(((current - prev) / prev) * 10000) / 100 : 0

    const revenueChange   = calcChange(totalRevenue, prevTotalRevenue)
    const recurringChange = calcChange(recurringRevenue, prevRecurringRevenue)
    const onetimeChange   = calcChange(onetimeRevenue, prevOnetimeRevenue)
    // For recurring %, report absolute point difference (e.g. 72% → 75% = +3)
    const recurringPctChange = Math.round((recurringPercentage - prevRecurringPercentage) * 100) / 100

    // Calculate average invoice amount
    const invoicesCount = invoices?.length || 0
    const avgInvoiceAmount = invoicesCount > 0 ? totalRevenue / invoicesCount : 0

    // Paid vs Unpaid breakdown
    const paidInvoices = invoices?.filter(i => i.status === 'Paid') || []
    const unpaidInvoices = invoices?.filter(i => i.status !== 'Paid') || []
    const paidTotal = paidInvoices.reduce((sum, inv) => sum + Number(inv.total), 0)
    const unpaidTotal = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.total), 0)

    // Next period projection: MRR + average one-time from last 3 periods
    const projectedNextPeriod = Math.round((mrr + (onetimeRevenue / Math.max(days / 30, 1))) * 100) / 100

    // Recent paid invoices (last 5)
    const { data: recentPaidRaw } = await supabase
      .from('whmcs_invoices')
      .select('whmcs_id, invoicenum, total, datepaid, client_id, instance_id')
      .in('instance_id', instanceIds)
      .eq('status', 'Paid')
      .not('datepaid', 'is', null)
      .order('datepaid', { ascending: false })
      .limit(5)

    // Get client names for recent invoices
    const recentClientIds = [...new Set(recentPaidRaw?.map(i => i.client_id) || [])]
    const { data: recentClients } = recentClientIds.length > 0
      ? await supabase
          .from('whmcs_clients')
          .select('whmcs_id, instance_id, firstname, lastname, companyname')
          .in('instance_id', instanceIds)
          .in('whmcs_id', recentClientIds)
      : { data: null }

    const clientNameMap = new Map<string, string>()
    recentClients?.forEach(c => {
      const key = `${c.instance_id}:${c.whmcs_id}`
      clientNameMap.set(key, c.companyname || `${c.firstname || ''} ${c.lastname || ''}`.trim() || 'Unknown')
    })

    const recentPaid = (recentPaidRaw || []).map(inv => ({
      invoice_num: inv.invoicenum,
      amount: Number(inv.total),
      date: inv.datepaid,
      client_name: clientNameMap.get(`${inv.instance_id}:${inv.client_id}`) || 'Unknown',
    }))

    // Find top product by revenue (from invoice items already loaded)
    const productRevenue = new Map<string, number>()
    if (invoiceWhmcsIds.length > 0) {
      const BATCH_SIZE2 = 500
      for (let i = 0; i < invoiceWhmcsIds.length; i += BATCH_SIZE2) {
        const batch = invoiceWhmcsIds.slice(i, i + BATCH_SIZE2)
        const { data: batchItems } = await supabase
          .from('whmcs_invoice_items')
          .select('description, amount')
          .in('instance_id', instanceIds)
          .in('invoice_id', batch)

        batchItems?.forEach(item => {
          const desc = item.description || 'Other'
          const amount = Number(item.amount) || 0
          productRevenue.set(desc, (productRevenue.get(desc) || 0) + amount)
        })
      }
    }

    // Get top product name
    let topProduct: { name: string; revenue: number } | null = null
    if (productRevenue.size > 0) {
      const sorted = Array.from(productRevenue.entries()).sort((a, b) => b[1] - a[1])
      topProduct = { name: sorted[0][0], revenue: sorted[0][1] }
    }

    return success({
      total_revenue: Math.round(totalRevenue * 100) / 100,
      recurring_revenue: Math.round(recurringRevenue * 100) / 100,
      onetime_revenue: Math.round(onetimeRevenue * 100) / 100,
      recurring_percentage: recurringPercentage,
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(arr * 100) / 100,
      revenue_change: revenueChange,
      recurring_change: recurringChange,
      onetime_change: onetimeChange,
      recurring_pct_change: recurringPctChange,
      invoices_count: invoicesCount,
      avg_invoice_amount: Math.round(avgInvoiceAmount * 100) / 100,
      paid_total: Math.round(paidTotal * 100) / 100,
      paid_count: paidInvoices.length,
      unpaid_total: Math.round(unpaidTotal * 100) / 100,
      unpaid_count: unpaidInvoices.length,
      projected_next_period: projectedNextPeriod,
      recent_paid: recentPaid,
      top_product: topProduct,
      period: {
        type: period,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        days,
      },
    }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/revenue/stats:', err)
    return error(err instanceof Error ? err : new Error('Failed to get revenue stats'))
  }
}

/**
 * Normalize billing amount to monthly
 */
function normalizeToMonthly(amount: number, cycle: string): number {
  const cycleMap: Record<string, number> = {
    'Monthly': 1,
    'Quarterly': 3,
    'Semi-Annually': 6,
    'Annually': 12,
    'Biennially': 24,
    'Triennially': 36,
  }
  const divisor = cycleMap[cycle] || 1
  return amount / divisor
}
