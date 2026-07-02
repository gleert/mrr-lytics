import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'
import { resolveMonthlyMovement } from '@/lib/metrics/movement-hybrid'
import { resolveDerivedTerminations, type UndatedCandidate } from '@/lib/metrics/derived-termination'

export const dynamic = 'force-dynamic'

type MovementType = 'new' | 'churned' | 'expansion' | 'contraction' | 'reactivation'

interface MovementItem {
  kind: 'hosting' | 'billable' | 'domain'
  whmcs_id: number
  client_id: number | null
  client_name: string
  description: string
  monthly_amount: number
  billing_cycle: string
  reference_date: string | null
  instance_id: string
  // Only set for expansion/contraction so the UI can show the price change.
  mrr_before?: number
  mrr_after?: number
}

/**
 * GET /api/metrics/mrr-movement/items
 *
 * Returns the individual hosting/billable items that contributed to the
 * "new" / "churned" / "expansion" / "contraction" / "reactivation" MRR pill
 * for a given month. new/churned use the same active/inactive logic as
 * /api/metrics/mrr-movement; expansion/contraction/reactivation only exist in
 * events mode (the proxy path can't observe per-service price changes nor
 * distinguish a returning service from a new one), so for those types only
 * events-mode instances contribute.
 *
 * Query params:
 *   - instance_ids: comma-separated
 *   - type: 'new' | 'churned' | 'expansion' | 'contraction' | 'reactivation' (required)
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
    const typeParam = (searchParams.get('type') || 'new') as MovementType
    const monthParam = searchParams.get('month') // YYYY-MM, optional

    const VALID_TYPES: MovementType[] = ['new', 'churned', 'expansion', 'contraction', 'reactivation']
    if (!VALID_TYPES.includes(typeParam)) {
      throw new Error('type must be "new", "churned", "expansion", "contraction" or "reactivation"')
    }
    // The proxy path can only resolve new/churned (it has no per-service price
    // history, and a returning service is indistinguishable from a new one).
    // expansion/contraction/reactivation come exclusively from observed events.
    const proxyEligible = typeParam === 'new' || typeParam === 'churned'

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

    const asOf = now.toISOString().slice(0, 10)
    const monthKeyStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
    const decisions = await resolveMonthlyMovement(instanceIds, monthKeyStr, asOf)
    const eventsById = new Map(decisions.filter(d => d.mode === 'events').map(d => [d.instance_id, d]))
    const proxySet = new Set(instanceIds.filter(id => !eventsById.has(id)))

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const [hostingRes, billableRes, clientsRes, productsRes, domainsRes] = await Promise.all([
      supabase
        .from('whmcs_hosting')
        .select('instance_id, whmcs_id, client_id, packageid, domain, amount, billingcycle, domainstatus, regdate, nextduedate, terminationdate')
        .in('instance_id', instanceIds)
        .limit(10000),
      supabase
        .from('whmcs_billable_items')
        .select('instance_id, whmcs_id, client_id, description, amount, recurcycle, recur, invoicecount, recurfor, duedate, invoice_action, cancelled_at')
        .in('instance_id', instanceIds)
        .gt('invoicecount', 0)
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
      supabase
        .from('whmcs_domains')
        .select('instance_id, whmcs_id, client_id, domain, recurringamount, registrationperiod, status, registrationdate, expirydate')
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

    // Recovered churn dates for undated cancellations (metrics_daily step match,
    // see lib/metrics/derived-termination.ts). Mirrors /api/metrics/mrr-movement
    // so the churned-items list dates the same entities in the same month.
    // Keyed `${instance_id}:${type}:${whmcs_id}`; populated below.
    const derivedTerm = new Map<string, Date>()

    // Mirrors wasActiveAt in /api/metrics/mrr-movement: a Cancelled service with
    // no terminationdate is dated to its nextduedate (cancellation proxy) at past
    // observation points, but never counts under `strict` (the current-time
    // point) so the breakdown total reconciles with the live MRR KPI.
    const hostingActiveAt = (
      s: { instance_id: string; whmcs_id: number; regdate: string | null; nextduedate: string | null; terminationdate: string | null; domainstatus: string },
      date: Date,
      strict: boolean,
    ): boolean => {
      const reg = s.regdate && s.regdate !== '0000-00-00' ? new Date(s.regdate) : null
      const term = s.terminationdate && s.terminationdate !== '0000-00-00' ? new Date(s.terminationdate) : null
      if (!reg || reg > date) return false
      if (term && term <= date) return false
      if (term && term > date) return true
      if (['Active', 'Suspended'].includes(s.domainstatus)) return true
      const dt = derivedTerm.get(`${s.instance_id}:hosting:${s.whmcs_id}`)
      if (dt) return dt > date
      if (strict) return false
      const nextDue = s.nextduedate && s.nextduedate !== '0000-00-00' ? new Date(s.nextduedate) : null
      if (!nextDue) return false
      return nextDue > date
    }

    // Mirrors the asymmetric logic from /api/metrics/mrr-movement and
    // calculate_churn: non-strict uses cancelled_at + duedate proxy
    // (permissive, suitable for past observation points); strict only
    // accepts invoice_action=4 (used at the current-time observation point
    // so cancelled items show up as churned in the current month).
    const billableActiveAt = (
      b: { instance_id: string; whmcs_id: number; duedate: string | null; invoicecount: number | null; recurcycle: string | null; recur: number | null; recurfor: number | null; cancelled_at: string | null; invoice_action?: number | null },
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
      const dt = derivedTerm.get(`${b.instance_id}:billable:${b.whmcs_id}`)
      if (dt) return dt > date
      if (strict) return false
      if (b.cancelled_at) return new Date(b.cancelled_at) > date
      return due >= date
    }

    // Default registrationperiod to 1 to mirror calculateMrrLive (the MRR KPI).
    const domainMonthlyAmount = (d: { recurringamount: number | string | null; registrationperiod: number | null }): number => {
      const annual = Number(d.recurringamount) || 0
      const period = Number(d.registrationperiod) || 1
      return annual > 0 && period > 0 ? annual / (period * 12) : 0
    }

    // Mirrors /api/metrics/mrr-movement and calculate_churn: active from
    // registrationdate; 'Active' today counts; otherwise churned at expirydate
    // proxy; strict (current month) accepts only 'Active'.
    const domainActiveAt = (
      d: { instance_id: string; whmcs_id: number; status: string | null; registrationdate: string | null; expirydate: string | null },
      date: Date,
      strict: boolean,
    ): boolean => {
      const regDate = d.registrationdate && d.registrationdate > '0001-01-01' ? new Date(d.registrationdate) : null
      if (!regDate || regDate > date) return false
      if (d.status === 'Active') return true
      const dt = derivedTerm.get(`${d.instance_id}:domain:${d.whmcs_id}`)
      if (dt) return dt > date
      if (strict) return false
      const expDate = d.expirydate && d.expirydate > '0001-01-01' ? new Date(d.expirydate) : null
      if (!expDate) return false
      return expDate > date
    }

    // Populate derived churn dates for undated cancellations in the proxy set
    // (same conditions as /api/metrics/mrr-movement), so a retainer that left on
    // an undated day surfaces in the right month's churned-items list.
    {
      const candidates: UndatedCandidate[] = []
      ;(billableRes.data ?? []).forEach(b => {
        if (!proxySet.has(b.instance_id)) return
        const mrr = toMonthlyAmount(Number(b.amount) || 0, b.recurcycle || '')
        const due = b.duedate ? new Date(b.duedate) : null
        // Broadened to include recently-lapsed duedates, not just future ones:
        // WHMCS advances the duedate past the real churn, so the coarse proxy
        // overshoots (see the EUR5125 Pig & Hen retainer note in
        // /api/metrics/mrr-movement). Resolver is correct-or-nothing, so past-due
        // undated cancellations are safe to feed. Mirrors that endpoint's gate.
        if (mrr > 0 && b.invoice_action !== 4 && !b.cancelled_at && due) {
          candidates.push({ instance_id: b.instance_id, key: `billable:${b.whmcs_id}`, mrr })
        }
      })
      ;(hostingRes.data ?? []).forEach(s => {
        if (!proxySet.has(s.instance_id)) return
        const mrr = toMonthlyAmount(Number(s.amount) || 0, s.billingcycle || '')
        const term = s.terminationdate && s.terminationdate !== '0000-00-00' ? new Date(s.terminationdate) : null
        const nextDue = s.nextduedate && s.nextduedate !== '0000-00-00' ? new Date(s.nextduedate) : null
        if (mrr > 0 && !['Active', 'Suspended'].includes(s.domainstatus) && !term && nextDue && nextDue > now) {
          candidates.push({ instance_id: s.instance_id, key: `hosting:${s.whmcs_id}`, mrr })
        }
      })
      ;(domainsRes.data ?? []).forEach(d => {
        if (!proxySet.has(d.instance_id)) return
        const mrr = domainMonthlyAmount(d)
        const exp = d.expirydate && d.expirydate > '0001-01-01' ? new Date(d.expirydate) : null
        if (mrr > 0 && d.status !== 'Active' && exp && exp > now) {
          candidates.push({ instance_id: d.instance_id, key: `domain:${d.whmcs_id}`, mrr })
        }
      })
      const resolved = await resolveDerivedTerminations(supabase, candidates, now)
      for (const [k, v] of resolved) derivedTerm.set(k, v)
    }

    // 'YYYY-MM-DD' of a recovered churn date, or null when none was matched.
    const derivedDateOf = (kind: string, instId: string, id: number): string | null => {
      const d = derivedTerm.get(`${instId}:${kind}:${id}`)
      return d ? d.toISOString().slice(0, 10) : null
    }

    const items: MovementItem[] = []
    // Accumulate the FULL-precision amount so the headline `total` is
    // sum-then-round (matching the waterfall pill exactly). Per-item
    // monthly_amount stays rounded for display only.
    let rawTotal = 0

    // Proxy path: only new/churned. For expansion/contraction these loops are
    // skipped entirely (proxy instances contribute nothing -- see proxyEligible).
    if (proxyEligible) {
    ;(hostingRes.data ?? []).forEach(s => {
      if (!proxySet.has(s.instance_id)) return
      const mrr = toMonthlyAmount(Number(s.amount) || 0, s.billingcycle || '')
      if (mrr === 0) return
      const wasActive = hostingActiveAt(s, prevMonthEnd, false)
      const isActive = hostingActiveAt(s, monthEnd, isCurrentMonth)
      const matches = typeParam === 'new' ? (!wasActive && isActive) : (wasActive && !isActive)
      if (!matches) return
      rawTotal += mrr
      const product = productName.get(`${s.instance_id}:${s.packageid}`)
      const description = [product, s.domain].filter(Boolean).join(' 2014 ') || `Service #${s.whmcs_id}`
      items.push({
        kind: 'hosting',
        whmcs_id: s.whmcs_id,
        client_id: s.client_id,
        client_name: clientName.get(`${s.instance_id}:${s.client_id}`) || `#${s.client_id}`,
        description,
        monthly_amount: Math.round(mrr * 100) / 100,
        billing_cycle: s.billingcycle || '',
        // Cancelled services often have no terminationdate; prefer the recovered
        // churn date, then fall back to nextduedate so the row still shows a date.
        reference_date: typeParam === 'new' ? s.regdate : (derivedDateOf('hosting', s.instance_id, s.whmcs_id) || s.terminationdate || s.nextduedate),
        instance_id: s.instance_id,
      })
    })

    ;(billableRes.data ?? []).forEach(b => {
      if (!proxySet.has(b.instance_id)) return
      const mrr = toMonthlyAmount(Number(b.amount) || 0, b.recurcycle || '')
      if (mrr === 0) return
      const wasActive = billableActiveAt(b, prevMonthEnd, false)
      const isActive = billableActiveAt(b, monthEnd, isCurrentMonth)
      const matches = typeParam === 'new' ? (!wasActive && isActive) : (wasActive && !isActive)
      if (!matches) return
      rawTotal += mrr
      items.push({
        kind: 'billable',
        whmcs_id: b.whmcs_id,
        client_id: b.client_id,
        client_name: clientName.get(`${b.instance_id}:${b.client_id}`) || `#${b.client_id}`,
        description: b.description || `Billable #${b.whmcs_id}`,
        monthly_amount: Math.round(mrr * 100) / 100,
        billing_cycle: b.recurcycle || '',
        reference_date: typeParam === 'new' ? b.duedate : (derivedDateOf('billable', b.instance_id, b.whmcs_id) || b.cancelled_at || b.duedate),
        instance_id: b.instance_id,
      })
    })

    ;(domainsRes.data ?? []).forEach(d => {
      if (!proxySet.has(d.instance_id)) return
      const mrr = domainMonthlyAmount(d)
      if (mrr === 0) return
      const wasActive = domainActiveAt(d, prevMonthEnd, false)
      const isActive = domainActiveAt(d, monthEnd, isCurrentMonth)
      const matches = typeParam === 'new' ? (!wasActive && isActive) : (wasActive && !isActive)
      if (!matches) return
      rawTotal += mrr
      items.push({
        kind: 'domain',
        whmcs_id: d.whmcs_id,
        client_id: d.client_id,
        client_name: clientName.get(`${d.instance_id}:${d.client_id}`) || `#${d.client_id}`,
        description: d.domain || `Domain #${d.whmcs_id}`,
        monthly_amount: Math.round(mrr * 100) / 100,
        billing_cycle: 'annually',
        reference_date: typeParam === 'new' ? d.registrationdate : (derivedDateOf('domain', d.instance_id, d.whmcs_id) || d.expirydate),
        instance_id: d.instance_id,
      })
    })
    } // end proxyEligible

    // Events-mode instances: source items from the observed events.
    // ?type=new          -> event_type 'new' ONLY (reactivation has its own pill)
    // ?type=churned      -> event_type 'churn'
    // ?type=expansion    -> event_type 'expansion'
    // ?type=contraction  -> event_type 'contraction'
    // ?type=reactivation -> event_type 'reactivation'
    const wantTypes =
      typeParam === 'new' ? ['new']
      : typeParam === 'churned' ? ['churn']
      : typeParam === 'expansion' ? ['expansion']
      : typeParam === 'contraction' ? ['contraction']
      : ['reactivation']
    for (const decision of eventsById.values()) {
      for (const ev of decision.events ?? []) {
        if (!wantTypes.includes(ev.event_type)) continue
        // Backfills (old domains the sync finally captured) are folded into
        // starting MRR by movement-hybrid, not counted as new -- keep them out
        // of the 'new' drilldown so the list reconciles with the pill.
        if (ev.event_type === 'new' && ev.is_backfill) continue
        const instId = decision.instance_id
        const kind = ev.entity_type
        let description: string
        let billing_cycle = ''
        let client_id: number | null = null

        if (kind === 'hosting') {
          const s = (hostingRes.data ?? []).find(h => h.instance_id === instId && h.whmcs_id === ev.entity_id)
          client_id = s?.client_id ?? null
          const product = s ? productName.get(`${instId}:${s.packageid}`) : undefined
          description = [product, s?.domain].filter(Boolean).join(' 2014 ') || `Service #${ev.entity_id}`
          billing_cycle = s?.billingcycle || ''
        } else if (kind === 'billable') {
          const b = (billableRes.data ?? []).find(x => x.instance_id === instId && x.whmcs_id === ev.entity_id)
          client_id = b?.client_id ?? null
          description = b?.description || `Billable #${ev.entity_id}`
          billing_cycle = b?.recurcycle || ''
        } else {
          const d = (domainsRes.data ?? []).find(x => x.instance_id === instId && x.whmcs_id === ev.entity_id)
          client_id = d?.client_id ?? null
          description = d?.domain || `Domain #${ev.entity_id}`
          billing_cycle = 'annually'
        }

        // new/reactivation -> full regained MRR; churn -> full lost MRR;
        // expansion/contraction -> the delta magnitude (so the list total
        // reconciles with the pill, which sums signed deltas).
        const monthly =
          typeParam === 'new' || typeParam === 'reactivation' ? ev.mrr_after
          : typeParam === 'churned' ? ev.mrr_before
          : Math.abs(ev.mrr_delta)
        rawTotal += monthly
        const isResize = typeParam === 'expansion' || typeParam === 'contraction'
        items.push({
          kind,
          whmcs_id: ev.entity_id,
          client_id,
          client_name: clientName.get(`${instId}:${client_id}`) || `#${client_id}`,
          description,
          monthly_amount: Math.round(monthly * 100) / 100,
          billing_cycle,
          reference_date: ev.effective_date ?? ev.observed_date,
          instance_id: instId,
          ...(isResize ? {
            mrr_before: Math.round(ev.mrr_before * 100) / 100,
            mrr_after: Math.round(ev.mrr_after * 100) / 100,
          } : {}),
        })
      }
    }

    items.sort((a, b) => b.monthly_amount - a.monthly_amount)

    const sourceMode = eventsById.size === 0 ? 'proxy' : proxySet.size === 0 ? 'events' : 'mixed'
    return success({
      items,
      total: Math.round(rawTotal * 100) / 100,
      count: items.length,
      type: typeParam,
      month: monthKeyStr,
      source: { mode: sourceMode },
    }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/metrics/mrr-movement/items:', err)
    return error(err instanceof Error ? err : new Error('Failed to get movement items'))
  }
}
