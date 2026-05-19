import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

interface MovementItem {
  kind: 'hosting' | 'billable'
  whmcs_id: number
  client_id: number | null
  client_name: string
  description: string
  monthly_amount: number
  billing_cycle: string
  reference_date: string | null
  instance_id: string
}

/**
 * GET /api/metrics/mrr-movement/items
 *
 * Returns the individual hosting/billable items that contributed to the
 * "new" or "churned" MRR pill for a given month. Same active/inactive
 * logic as /api/metrics/mrr-movement.
 *
 * Query params:
 *   - instance_ids: comma-separated
 *   - type: 'new' | 'churned' (required)
 *   - month: 'YYYY-MM' (default: current month)
 */
export async function GET(request: NextRequest) {
  try {
    const headersList = await headers()
    const auth = getAuthContext(headersList)
    if (!auth) throw new UnauthorizedError('Authentication required')

    const { searchParams } = new URL(request.url)
    const instanceIdsParam = searchParams.get('instance_ids')
    const instanceIdParam = searchParams.get('instance_id')
    const typeParam = (searchParams.get('type') || 'new') as 'new' | 'churned'
    const monthParam = searchParams.get('month') // YYYY-MM, optional

    if (typeParam !== 'new' && typeParam !== 'churned') {
      throw new Error('type must be "new" or "churned"')
    }

    let instanceIds: string[] = []
    if (instanceIdsParam) instanceIds = instanceIdsParam.split(',').filter(id => id.trim())
    else if (instanceIdParam) instanceIds = [instanceIdParam]
    if (instanceIds.length === 0) throw new Error('No instance specified')

    // Resolve target month boundaries
    const now = new Date()
    let monthDate: Date
    if (monthParam) {
      const [y, m] = monthParam.split('-').map(Number)
      monthDate = new Date(y, (m || 1) - 1, 1)
    } else {
      monthDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
    const naturalMonthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999)
    const monthEnd = naturalMonthEnd > now ? now : naturalMonthEnd
    const prevMonthEnd = new Date(monthStart.getTime() - 1)
    const isCurrentMonth = naturalMonthEnd > now

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const [hostingRes, billableRes, clientsRes, productsRes] = await Promise.all([
      supabase
        .from('whmcs_hosting')
        .select('instance_id, whmcs_id, client_id, packageid, domain, amount, billingcycle, domainstatus, regdate, terminationdate')
        .in('instance_id', instanceIds),
      supabase
        .from('whmcs_billable_items')
        .select('instance_id, whmcs_id, client_id, description, amount, recurcycle, recur, invoicecount, recurfor, duedate, invoice_action, cancelled_at')
        .in('instance_id', instanceIds)
        .gt('invoicecount', 0)
        .limit(10000),
      supabase
        .from('whmcs_clients')
        .select('instance_id, whmcs_id, firstname, lastname, companyname')
        .in('instance_id', instanceIds),
      supabase
        .from('whmcs_products')
        .select('instance_id, whmcs_id, name')
        .in('instance_id', instanceIds),
    ])

    if (hostingRes.error) throw new Error(`Failed to load hosting: ${hostingRes.error.message}`)
    if (billableRes.error) throw new Error(`Failed to load billable items: ${billableRes.error.message}`)

    const clientName = new Map<string, string>()
    ;(clientsRes.data ?? []).forEach(c => {
      const display = (c.companyname && c.companyname.trim())
        ? c.companyname
        : [c.firstname, c.lastname].filter(Boolean).join(' ').trim() || `#${c.whmcs_id}`
      clientName.set(`${c.instance_id}:${c.whmcs_id}`, display)
    })

    const productName = new Map<string, string>()
    ;(productsRes.data ?? []).forEach(p => {
      productName.set(`${p.instance_id}:${p.whmcs_id}`, p.name)
    })

    const toMonthlyAmount = (amount: number, cycle: string): number => {
      const map: Record<string, number> = {
        monthly: 1, months: 1, month: 1,
        quarterly: 3,
        'semi-annually': 6, semiannually: 6,
        annually: 12, yearly: 12, years: 12, year: 12,
        biennially: 24, triennially: 36,
      }
      const divisor = map[(cycle || '').toLowerCase()]
      if (!divisor) return 0
      return amount / divisor
    }

    const hostingActiveAt = (s: { regdate: string | null; terminationdate: string | null; domainstatus: string }, date: Date): boolean => {
      const reg = s.regdate && s.regdate !== '0000-00-00' ? new Date(s.regdate) : null
      const term = s.terminationdate && s.terminationdate !== '0000-00-00' ? new Date(s.terminationdate) : null
      if (!reg || reg > date) return false
      if (term && term <= date) return false
      if (term && term > date) return true
      return ['Active', 'Suspended'].includes(s.domainstatus)
    }

    // Mirrors the asymmetric logic from /api/metrics/mrr-movement and
    // calculate_churn: non-strict uses cancelled_at + duedate proxy
    // (permissive, suitable for past observation points); strict only
    // accepts invoice_action=4 (used at the current-time observation point
    // so cancelled items show up as churned in the current month).
    const billableActiveAt = (
      b: { duedate: string | null; invoicecount: number | null; recurcycle: string | null; recur: number | null; recurfor: number | null; cancelled_at: string | null; invoice_action?: number | null },
      date: Date,
      strict: boolean,
    ): boolean => {
      if (!b.duedate) return false
      const cycleMonths = ((b.recurcycle || '').toLowerCase().startsWith('year') ? 12 : 1) * (b.recur || 1)
      if (cycleMonths === 0) return false
      const due = new Date(b.duedate)
      const start = new Date(due)
      start.setMonth(start.getMonth() - (b.invoicecount || 0) * cycleMonths)
      if (start > date) return false
      const recurfor = b.recurfor || 0
      if (recurfor > 0) {
        const monthsDiff = (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth())
        if (Math.floor(monthsDiff / cycleMonths) >= recurfor) return false
      }
      if (b.invoice_action === 4) return true
      if (strict) return false
      if (b.cancelled_at) return new Date(b.cancelled_at) > date
      return due >= date
    }

    const items: MovementItem[] = []

    ;(hostingRes.data ?? []).forEach(s => {
      const mrr = toMonthlyAmount(Number(s.amount) || 0, s.billingcycle || '')
      if (mrr === 0) return
      const wasActive = hostingActiveAt(s, prevMonthEnd)
      const isActive = hostingActiveAt(s, monthEnd)
      const matches = typeParam === 'new' ? (!wasActive && isActive) : (wasActive && !isActive)
      if (!matches) return
      const product = productName.get(`${s.instance_id}:${s.packageid}`)
      const description = [product, s.domain].filter(Boolean).join(' — ') || `Service #${s.whmcs_id}`
      items.push({
        kind: 'hosting',
        whmcs_id: s.whmcs_id,
        client_id: s.client_id,
        client_name: clientName.get(`${s.instance_id}:${s.client_id}`) || `#${s.client_id}`,
        description,
        monthly_amount: Math.round(mrr * 100) / 100,
        billing_cycle: s.billingcycle || '',
        reference_date: typeParam === 'new' ? s.regdate : s.terminationdate,
        instance_id: s.instance_id,
      })
    })

    ;(billableRes.data ?? []).forEach(b => {
      const mrr = toMonthlyAmount(Number(b.amount) || 0, b.recurcycle || '')
      if (mrr === 0) return
      const wasActive = billableActiveAt(b, prevMonthEnd, false)
      const isActive = billableActiveAt(b, monthEnd, isCurrentMonth)
      const matches = typeParam === 'new' ? (!wasActive && isActive) : (wasActive && !isActive)
      if (!matches) return
      items.push({
        kind: 'billable',
        whmcs_id: b.whmcs_id,
        client_id: b.client_id,
        client_name: clientName.get(`${b.instance_id}:${b.client_id}`) || `#${b.client_id}`,
        description: b.description || `Billable #${b.whmcs_id}`,
        monthly_amount: Math.round(mrr * 100) / 100,
        billing_cycle: b.recurcycle || '',
        reference_date: typeParam === 'new' ? b.duedate : (b.cancelled_at || b.duedate),
        instance_id: b.instance_id,
      })
    })

    items.sort((a, b) => b.monthly_amount - a.monthly_amount)
    const total = items.reduce((sum, it) => sum + it.monthly_amount, 0)

    return success({
      items,
      total: Math.round(total * 100) / 100,
      count: items.length,
      type: typeParam,
      month: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`,
    }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/metrics/mrr-movement/items:', err)
    return error(err instanceof Error ? err : new Error('Failed to get movement items'))
  }
}
