import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { assertInstancesOwned } from '@/lib/auth/instance-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { toMonthlyAmount } from '@/lib/metrics/mrr-live'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

/**
 * GET /api/metrics/mrr-ledger
 *
 * Ledger ("libro contable") of every item that contributes to the current
 * MRR: each active hosting service, recurring billable item and active
 * domain, enriched with client name, description and the date it started
 * contributing (regdate / registrationdate / computed billable start).
 *
 * The item set and per-item monthly amounts mirror calculateMrrLive exactly
 * (hosting domainstatus=Active; billable invoice_action=4 + invoicecount>0 +
 * still recurring; domain status=Active with a positive recurring amount).
 * `monthly_amount` is kept at FULL precision (display layers round to cents);
 * `total`/`by_category` are summed from those raw values and rounded ONCE at
 * the end, so the total reconciles to the cent with the MRR KPI — which also
 * sums raw and rounds once. Rounding each line first inflated the total by the
 * accumulated per-line bias. Entries are returned sorted by start date
 * ascending (unknown dates last); the running balance is the caller's concern
 * (cumulative sum reaches `total`).
 */
interface LedgerEntry {
  type: 'hosting' | 'billable' | 'domain'
  whmcs_id: number
  client_id: number | null
  client_name: string
  description: string
  billing_cycle: string
  monthly_amount: number
  start_date: string | null
  instance_id: string
}

const validDate = (d: string | null): string | null =>
  d && d > '0001-01-01' && d !== '0000-00-00' ? d : null

export async function GET(request: NextRequest) {
  try {
    const headersList = await headers()
    const auth = getAuthContext(headersList)
    if (!auth) throw new UnauthorizedError('Authentication required')

    const { searchParams } = new URL(request.url)
    const instanceIdsParam = searchParams.get('instance_ids')
    const instanceIdParam = searchParams.get('instance_id')

    let instanceIds: string[] = []
    if (instanceIdsParam) instanceIds = instanceIdsParam.split(',').filter(id => id.trim())
    else if (instanceIdParam) instanceIds = [instanceIdParam]

    // Reject instance ids this tenant does not own (see lib/auth/instance-access).
    await assertInstancesOwned(auth.tenant_id, instanceIds)
    if (instanceIds.length === 0) throw new Error('No instance specified')

    const supabase = createAdminClient()

    const [hostingRes, billableRes, domainsRes, clientsRes, productsRes] = await Promise.all([
      supabase
        .from('whmcs_hosting')
        .select('instance_id, whmcs_id, client_id, packageid, domain, amount, billingcycle, regdate')
        .in('instance_id', instanceIds)
        .eq('domainstatus', 'Active')
        .limit(10000),
      supabase
        .from('whmcs_billable_items')
        .select('instance_id, whmcs_id, client_id, description, amount, recurcycle, recur, recurfor, invoicecount, duedate')
        .in('instance_id', instanceIds)
        .eq('invoice_action', 4)
        .gt('invoicecount', 0)
        .limit(10000),
      supabase
        .from('whmcs_domains')
        .select('instance_id, whmcs_id, client_id, domain, recurringamount, registrationperiod, registrationdate')
        .in('instance_id', instanceIds)
        .eq('status', 'Active')
        .limit(10000),
      supabase
        .from('whmcs_clients')
        .select('instance_id, whmcs_id, firstname, lastname, companyname')
        .in('instance_id', instanceIds)
        .limit(10000),
      supabase
        .from('whmcs_products')
        .select('instance_id, whmcs_id, name')
        .in('instance_id', instanceIds)
        .limit(10000),
    ])

    if (hostingRes.error) throw new Error(`Failed to load hosting: ${hostingRes.error.message}`)
    if (billableRes.error) throw new Error(`Failed to load billable items: ${billableRes.error.message}`)
    if (domainsRes.error) throw new Error(`Failed to load domains: ${domainsRes.error.message}`)

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

    const nameFor = (instanceId: string, clientId: number | null): string =>
      clientId != null ? (clientName.get(`${instanceId}:${clientId}`) || `#${clientId}`) : '—'

    const entries: LedgerEntry[] = []

    ;(hostingRes.data ?? []).forEach(h => {
      const mrr = toMonthlyAmount(Number(h.amount) || 0, h.billingcycle || '')
      if (mrr <= 0) return
      const product = productName.get(`${h.instance_id}:${h.packageid}`)
      const description = [product, h.domain].filter(Boolean).join(' — ') || `Service #${h.whmcs_id}`
      entries.push({
        type: 'hosting',
        whmcs_id: h.whmcs_id,
        client_id: h.client_id,
        client_name: nameFor(h.instance_id, h.client_id),
        description,
        billing_cycle: h.billingcycle || '',
        monthly_amount: mrr,
        start_date: validDate(h.regdate),
        instance_id: h.instance_id,
      })
    })

    ;(billableRes.data ?? []).forEach(b => {
      // Match calculateMrrLive: drop items that have completed their recurfor schedule.
      const recurfor = b.recurfor ?? 0
      const invoicecount = b.invoicecount ?? 0
      if (recurfor !== 0 && invoicecount >= recurfor) return
      const mrr = toMonthlyAmount(Number(b.amount) || 0, b.recurcycle || '')
      if (mrr <= 0) return
      // Start = first due date, walked back invoicecount cycles.
      let startDate: string | null = null
      const due = validDate(b.duedate)
      if (due) {
        const cycleMonths = ((b.recurcycle || '').toLowerCase().startsWith('year') ? 12 : 1) * (b.recur || 1)
        const d = new Date(due)
        d.setMonth(d.getMonth() - invoicecount * cycleMonths)
        startDate = d.toISOString().split('T')[0]
      }
      entries.push({
        type: 'billable',
        whmcs_id: b.whmcs_id,
        client_id: b.client_id,
        client_name: nameFor(b.instance_id, b.client_id),
        description: b.description || `Billable #${b.whmcs_id}`,
        billing_cycle: b.recurcycle || '',
        monthly_amount: mrr,
        start_date: startDate,
        instance_id: b.instance_id,
      })
    })

    ;(domainsRes.data ?? []).forEach(d => {
      const annual = Number(d.recurringamount) || 0
      const period = Number(d.registrationperiod) || 1
      const mrr = annual > 0 && period > 0 ? annual / (period * 12) : 0
      if (mrr <= 0) return
      entries.push({
        type: 'domain',
        whmcs_id: d.whmcs_id,
        client_id: d.client_id,
        client_name: nameFor(d.instance_id, d.client_id),
        description: d.domain || `Domain #${d.whmcs_id}`,
        billing_cycle: 'annually',
        monthly_amount: mrr,
        start_date: validDate(d.registrationdate),
        instance_id: d.instance_id,
      })
    })

    // Chronological ascending; entries with no known start date go last.
    entries.sort((a, b) => {
      if (a.start_date && b.start_date) return a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0
      if (a.start_date) return -1
      if (b.start_date) return 1
      return 0
    })

    const by_category = entries.reduce(
      (acc, e) => {
        acc[e.type === 'domain' ? 'domains' : e.type] += e.monthly_amount
        return acc
      },
      { hosting: 0, billable: 0, domains: 0 }
    )
    const round = (n: number) => Math.round(n * 100) / 100
    const total = round(by_category.hosting + by_category.billable + by_category.domains)

    return success({
      entries,
      total,
      count: entries.length,
      by_category: {
        hosting: round(by_category.hosting),
        billable: round(by_category.billable),
        domains: round(by_category.domains),
      },
    }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/metrics/mrr-ledger:', err)
    return error(err instanceof Error ? err : new Error('Failed to get MRR ledger'))
  }
}
