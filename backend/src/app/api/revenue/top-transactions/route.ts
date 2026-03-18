import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'
import { parseDateRange } from '@/utils/date-helpers'

export const dynamic = 'force-dynamic'

interface TopTransaction {
  id: string
  date: string
  invoice_num: string
  client_name: string
  product_name: string
  amount: number
}

/**
 * GET /api/revenue/top-transactions - Get top transactions by amount
 * 
 * Query params:
 * - instance_ids: Comma-separated list of WHMCS instance IDs
 * - limit: Number of transactions (default: 4)
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
    const limitParam = searchParams.get('limit') || '4'
    const period = searchParams.get('period') || '30d'

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
    const { startDate } = parseDateRange(period, null, null)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get top invoice items by amount
    const { data: items, error: itemsError } = await supabase
      .from('whmcs_invoice_items')
      .select('id, instance_id, invoice_id, client_id, description, amount, relid')
      .in('instance_id', instanceIds)
      .gt('amount', 0)
      .order('amount', { ascending: false })
      .limit(100) // Fetch more to filter by paid status

    if (itemsError) {
      console.error('Items query error:', itemsError)
      return success({
        transactions: [],
        total_amount: 0,
        period_days: 30,
      }, { instance_ids: instanceIds })
    }

    if (!items || items.length === 0) {
      return success({
        transactions: [],
        total_amount: 0,
        period_days: 30,
      }, { instance_ids: instanceIds })
    }

    // Get invoice IDs to check status
    const invoiceIds = [...new Set(items.map(i => i.invoice_id))]

    // Fetch invoices to filter by paid status and date
    const { data: invoices } = await supabase
      .from('whmcs_invoices')
      .select('whmcs_id, instance_id, invoicenum, datepaid, status')
      .in('instance_id', instanceIds)
      .in('whmcs_id', invoiceIds)
      .eq('status', 'Paid')
      .not('datepaid', 'is', null)
      .gte('datepaid', startDate.toISOString())

    if (!invoices || invoices.length === 0) {
      return success({
        transactions: [],
        total_amount: 0,
        period_days: 30,
      }, { instance_ids: instanceIds })
    }

    // Create invoice lookup
    const invoiceMap = new Map<string, { invoicenum: string; datepaid: string }>()
    invoices.forEach(inv => {
      const key = `${inv.instance_id}:${inv.whmcs_id}`
      invoiceMap.set(key, { invoicenum: inv.invoicenum, datepaid: inv.datepaid })
    })

    // Filter items by paid invoices
    const paidItems = items.filter(item => {
      const key = `${item.instance_id}:${item.invoice_id}`
      return invoiceMap.has(key)
    })

    // Get top N items
    const topItems = paidItems.slice(0, limit)

    // Get client and product info
    const clientIds = [...new Set(topItems.map(i => i.client_id))]
    const productIds = [...new Set(topItems.filter(i => i.relid).map(i => i.relid))]

    const { data: clients } = await supabase
      .from('whmcs_clients')
      .select('whmcs_id, instance_id, firstname, lastname, companyname')
      .in('instance_id', instanceIds)
      .in('whmcs_id', clientIds.length > 0 ? clientIds : [0])

    const { data: products } = await supabase
      .from('whmcs_products')
      .select('whmcs_id, instance_id, name')
      .in('instance_id', instanceIds)
      .in('whmcs_id', productIds.length > 0 ? productIds : [0])

    // Build lookup maps
    const clientMap = new Map<string, string>()
    clients?.forEach(client => {
      const key = `${client.instance_id}:${client.whmcs_id}`
      const name = client.companyname || `${client.firstname || ''} ${client.lastname || ''}`.trim() || 'Unknown'
      clientMap.set(key, name)
    })

    const productMap = new Map<string, string>()
    products?.forEach(product => {
      const key = `${product.instance_id}:${product.whmcs_id}`
      productMap.set(key, product.name || 'Unknown')
    })

    // Transform results
    const transactions: TopTransaction[] = topItems.map(item => {
      const invoiceKey = `${item.instance_id}:${item.invoice_id}`
      const clientKey = `${item.instance_id}:${item.client_id}`
      const productKey = `${item.instance_id}:${item.relid}`
      const invoice = invoiceMap.get(invoiceKey)

      return {
        id: item.id,
        date: invoice?.datepaid || '',
        invoice_num: invoice?.invoicenum || String(item.invoice_id),
        client_name: clientMap.get(clientKey) || 'Unknown Client',
        product_name: productMap.get(productKey) || item.description || 'Unknown',
        amount: Number(item.amount) || 0,
      }
    })

    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0)

    return success({
      transactions,
      total_amount: Math.round(totalAmount * 100) / 100,
      period_days: 30,
    }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/revenue/top-transactions:', err)
    return error(err instanceof Error ? err : new Error('Failed to get top transactions'))
  }
}
