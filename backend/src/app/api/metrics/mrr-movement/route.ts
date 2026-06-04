import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'
import { getHistoryDaysLimit } from '@/lib/subscription/limits'
import { resolveMonthlyMovement, round2 } from '@/lib/metrics/movement-hybrid'

export const dynamic = 'force-dynamic'

interface MovementDataPoint {
  month: string
  starting_mrr: number
  new_mrr: number
  reactivation_mrr: number
  churned_mrr: number
  expansion_mrr: number
  contraction_mrr: number
  ending_mrr: number
  net_change: number
}

type MonthMode = 'events' | 'proxy' | 'mixed'
interface MonthSource {
  mode: MonthMode
  reason: string
  per_instance?: Record<string, 'events' | 'proxy'>
}

/**
 * GET /api/metrics/mrr-movement - Get monthly MRR movement breakdown
 *
 * Returns Starting MRR, New, Expansion, Contraction, Churn, Ending MRR for each month
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
    const monthsParam = searchParams.get('months') || '6'

    let instanceIds: string[] = []
    if (instanceIdsParam) {
      instanceIds = instanceIdsParam.split(',').filter(id => id.trim())
    } else if (instanceIdParam) {
      instanceIds = [instanceIdParam]
    }

    if (instanceIds.length === 0) {
      throw new Error('No instance specified')
    }

    const historyLimit = await getHistoryDaysLimit(auth.tenant_id)
    const maxMonths = historyLimit === -1 ? 12 : Math.min(12, Math.floor(historyLimit / 30))
    const months = Math.min(maxMonths, Math.max(parseInt(monthsParam, 10) || 6, 3))

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get date range — start (months-1) months ago so the last iteration is the current month
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months + 1)
    startDate.setDate(1) // Start of month

    // Get hosting services + billable items + domains in parallel
    const [
      { data: hostingServices, error: hostingError },
      { data: billableItems },
      { data: domainServices },
    ] = await Promise.all([
      supabase
        .from('whmcs_hosting')
        .select('id, instance_id, amount, billingcycle, domainstatus, regdate, nextduedate, terminationdate')
        .in('instance_id', instanceIds),
      supabase
        .from('whmcs_billable_items')
        .select('instance_id, whmcs_id, amount, recurcycle, recur, invoicecount, recurfor, duedate, invoice_action, cancelled_at')
        .in('instance_id', instanceIds)
        .gt('invoicecount', 0)
        .limit(10000),
      supabase
        .from('whmcs_domains')
        .select('instance_id, recurringamount, registrationperiod, status, registrationdate, expirydate')
        .in('instance_id', instanceIds)
        .limit(10000),
    ])

    if (hostingError) {
      console.error('Hosting query error:', hostingError)
      throw new Error('Failed to fetch hosting data')
    }

    // Monthly amount — same formula as mv_mrr_current view (no monthly_amount shortcut)
    const toMonthlyAmount = (amount: number, cycle: string): number => {
      const map: Record<string, number> = {
        monthly: 1, months: 1, month: 1,
        quarterly: 3,
        'semi-annually': 6, semiannually: 6,
        annually: 12, yearly: 12, years: 12, year: 12,
        biennially: 24, triennially: 36,
      }
      const divisor = map[cycle?.toLowerCase()]
      if (!divisor) return 0
      return amount / divisor
    }

    const getCycleMonths = (recurcycle: string, recur: number): number => {
      const base = (recurcycle || '').toLowerCase().startsWith('year') ? 12 : 1
      return base * (recur || 1)
    }

    // Lifecycle check: did the item exist and not yet complete its recurfor schedule?
    const billableLifecycleActiveAt = (
      startDate: Date,
      recurfor: number,
      cycleMonths: number,
      date: Date,
    ): boolean => {
      if (startDate > date) return false
      if (recurfor === 0) return true
      const monthsDiff =
        (date.getFullYear() - startDate.getFullYear()) * 12 +
        (date.getMonth() - startDate.getMonth())
      return Math.floor(monthsDiff / cycleMonths) < recurfor
    }

    /**
     * Was a billable item active at a given date?
     *
     * `strict` mode = check at the "right now" observation point. Only items
     * with invoice_action=4 count as active. Used for the current month's
     * monthEnd so that a cancelled item (Magento retainer with invoice_action=0,
     * cancelled_at=NULL, future duedate) is correctly detected as having
     * churned in the current month.
     *
     * Non-strict mode = check at a past date. Uses cancelled_at when known,
     * falls back to the duedate proxy for legacy cancellations whose timestamp
     * we never captured.
     */
    const billableActiveAt = (
      item: { startDate: Date; cycleMonths: number; recurfor: number; invoiceAction: number; cancelledAt: Date | null; dueDate: Date },
      date: Date,
      strict: boolean,
    ): boolean => {
      if (!billableLifecycleActiveAt(item.startDate, item.recurfor, item.cycleMonths, date)) return false
      if (item.invoiceAction === 4) return true
      if (strict) return false
      if (item.cancelledAt) return item.cancelledAt > date
      return item.dueDate >= date
    }

    type BillableItemMovement = {
      instance_id: string
      startDate: Date
      cycleMonths: number
      recurfor: number
      mrr: number
      invoiceAction: number
      cancelledAt: Date | null
      dueDate: Date
    }
    const billableWithStart: BillableItemMovement[] = (billableItems || []).flatMap(item => {
      if (!item.duedate) return []
      const cycleMonths = getCycleMonths(item.recurcycle || 'Months', item.recur || 1)
      const mrr = toMonthlyAmount(Number(item.amount) || 0, item.recurcycle || '')
      if (mrr === 0 || cycleMonths === 0) return []
      const dueDate = new Date(item.duedate)
      const startDate = new Date(dueDate)
      startDate.setMonth(startDate.getMonth() - (item.invoicecount || 0) * cycleMonths)
      return [{
        instance_id: item.instance_id,
        startDate,
        cycleMonths,
        recurfor: item.recurfor ?? 0,
        mrr,
        invoiceAction: item.invoice_action ?? 0,
        cancelledAt: item.cancelled_at ? new Date(item.cancelled_at) : null,
        dueDate,
      }]
    })

    const getMonthlyAmount = (service: typeof hostingServices[0]): number =>
      toMonthlyAmount(Number(service.amount) || 0, service.billingcycle || '')

    // Was service active at end of a given date?
    // Rules (date-driven, NOT relying on current domainstatus for historical dates):
    //   1. regdate must exist and be <= date
    //   2. terminationdate, if set, must be > date (not yet terminated)
    //   3. No terminationdate + Active/Suspended → active
    //   4. No terminationdate + Cancelled: dated to nextduedate (cancellation
    //      proxy) at past observation points; never active under `strict`.
    //
    // `strict` = the "right now" observation point (current month's monthEnd).
    // A Cancelled service without a terminationdate counts as inactive there so
    // ending_mrr reconciles with the live MRR KPI (which only sums Active).
    // Non-strict = a past observation point: such a service was active until its
    // nextduedate, mirroring how billable items use duedate and domains use
    // expirydate. WHMCS leaves terminationdate NULL for cancellation requests
    // that never ran an actual termination, so without this proxy that churn is
    // invisible (the service evaluates as never-active and silently drops out).
    const wasActiveAt = (service: typeof hostingServices[0], date: Date, strict: boolean): boolean => {
      const regDate = service.regdate && service.regdate !== '0000-00-00'
        ? new Date(service.regdate) : null
      const termDate = service.terminationdate && service.terminationdate !== '0000-00-00'
        ? new Date(service.terminationdate) : null

      if (!regDate || regDate > date) return false
      if (termDate && termDate <= date) return false

      // Service has a termination date in the future → was active at this date
      if (termDate && termDate > date) return true

      // No termination date: current Active/Suspended services were active.
      if (['Active', 'Suspended'].includes(service.domainstatus)) return true

      // Cancelled (or otherwise inactive) without a terminationdate.
      // At "now" it never counts (matches the live MRR KPI's Active-only rule).
      if (strict) return false

      // Past observation: active until nextduedate (cancellation date proxy).
      const nextDue = service.nextduedate && service.nextduedate !== '0000-00-00'
        ? new Date(service.nextduedate) : null
      if (!nextDue) return false
      return nextDue > date
    }

    // Default registrationperiod to 1 to mirror calculateMrrLive (the MRR KPI),
    // so the chart's ending_mrr reconciles exactly with the MRR card.
    const domainMonthlyAmount = (domain: { recurringamount: number | string | null; registrationperiod: number | null }): number => {
      const annual = Number(domain.recurringamount) || 0
      const period = Number(domain.registrationperiod) || 1
      return annual > 0 && period > 0 ? annual / (period * 12) : 0
    }

    // Was a domain active at a given date? Mirrors calculate_churn's domain logic:
    //   - active from registrationdate
    //   - status 'Active' today → counts (it was registered before this date)
    //   - otherwise it churned at expirydate (proxy). Cancelled domains without
    //     an expiry date can't be dated, so they never surface as a month's churn
    //     (but they're already excluded from the current total either way).
    //   - strict (current-time observation) only accepts 'Active', so the
    //     current month's ending total reconciles with the live MRR KPI.
    const domainActiveAt = (
      domain: { status: string | null; registrationdate: string | null; expirydate: string | null },
      date: Date,
      strict: boolean,
    ): boolean => {
      const regDate = domain.registrationdate && domain.registrationdate > '0001-01-01'
        ? new Date(domain.registrationdate) : null
      if (!regDate || regDate > date) return false
      if (domain.status === 'Active') return true
      if (strict) return false
      const expDate = domain.expirydate && domain.expirydate > '0001-01-01'
        ? new Date(domain.expirydate) : null
      if (!expDate) return false
      return expDate > date
    }

    // Generate monthly movement data
    const movementData: MovementDataPoint[] = []
    const monthSources: Record<string, MonthSource> = {}
    const now = new Date()
    const asOf = now.toISOString().slice(0, 10)

    // Resolve every month's per-instance events-vs-proxy decision up front and in
    // parallel (each call already fans out per instance internally), instead of
    // awaiting one month at a time inside the loop.
    const monthKeys: string[] = []
    for (let i = 0; i < months; i++) {
      const d = new Date(startDate)
      d.setMonth(startDate.getMonth() + i)
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    const decisionsByMonth = new Map(
      (await Promise.all(monthKeys.map((k) => resolveMonthlyMovement(instanceIds, k, asOf))))
        .map((decisions, idx) => [monthKeys[idx], decisions] as const)
    )

    for (let i = 0; i < months; i++) {
      const monthDate = new Date(startDate)
      monthDate.setMonth(startDate.getMonth() + i)

      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
      const naturalMonthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999)
      // Cap at "now" for the current month so future-dated terminationdates
      // (pending cancellations scheduled later this month) aren't counted as
      // already churned and pull net_change negative mid-month.
      const monthEnd = naturalMonthEnd > now ? now : naturalMonthEnd
      const prevMonthEnd = new Date(monthStart.getTime() - 1)
      // strict invoice_action / cancelled-status check only at the most recent
      // observation point (current month). Past months have no historical
      // invoice_action snapshot, so they use the cancelled_at + duedate proxy.
      const isCurrentMonth = naturalMonthEnd > now

      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`

      // Per-instance events-vs-proxy decision for this month (resolved above).
      const decisions = decisionsByMonth.get(monthKey) ?? []
      const eventsDecisions = decisions.filter((d) => d.mode === 'events')
      const eventsSet = new Set(eventsDecisions.map((d) => d.instance_id))
      const proxySet = new Set(instanceIds.filter((id) => !eventsSet.has(id)))

      let starting_mrr = 0
      let new_mrr = 0
      let reactivation_mrr = 0
      let churned_mrr = 0
      let expansion_mrr = 0
      let contraction_mrr = 0
      let ending_mrr = 0

      // 1. Events-mode instances: anchored figures from the resolver.
      for (const d of eventsDecisions) {
        const b = d.breakdown!
        starting_mrr += b.starting_mrr
        new_mrr += b.new_mrr
        reactivation_mrr += b.reactivation_mrr
        churned_mrr += b.churned_mrr
        expansion_mrr += b.expansion_mrr
        contraction_mrr += b.contraction_mrr
        ending_mrr += b.ending_mrr
      }

      // 2. Proxy-mode instances: existing date-proxy accumulation, filtered to
      // proxySet. wasActiveAt/billableActiveAt/domainActiveAt use the asymmetric
      // strict (current-month "now") vs non-strict (past observation) rule — see
      // their definitions and isCurrentMonth above.
      if (proxySet.size > 0) {
        hostingServices?.forEach(service => {
          if (!proxySet.has(service.instance_id)) return
          const wasActive = wasActiveAt(service, prevMonthEnd, false)
          const isActive = wasActiveAt(service, monthEnd, isCurrentMonth)
          const mrr = getMonthlyAmount(service)
          if (wasActive) starting_mrr += mrr
          if (isActive) ending_mrr += mrr
          if (!wasActive && isActive) new_mrr += mrr
          if (wasActive && !isActive) churned_mrr += mrr
        })

        billableWithStart.forEach(item => {
          if (!proxySet.has(item.instance_id)) return
          const wasActive = billableActiveAt(item, prevMonthEnd, false)
          const isActive = billableActiveAt(item, monthEnd, isCurrentMonth)
          if (wasActive) starting_mrr += item.mrr
          if (isActive) ending_mrr += item.mrr
          if (!wasActive && isActive) new_mrr += item.mrr
          if (wasActive && !isActive) churned_mrr += item.mrr
        })

        domainServices?.forEach(domain => {
          if (!proxySet.has(domain.instance_id)) return
          const mrr = domainMonthlyAmount(domain)
          if (mrr === 0) return
          const wasActive = domainActiveAt(domain, prevMonthEnd, false)
          const isActive = domainActiveAt(domain, monthEnd, isCurrentMonth)
          if (wasActive) starting_mrr += mrr
          if (isActive) ending_mrr += mrr
          if (!wasActive && isActive) new_mrr += mrr
          if (wasActive && !isActive) churned_mrr += mrr
        })
      }

      const net_change = new_mrr + reactivation_mrr + expansion_mrr + contraction_mrr - churned_mrr

      movementData.push({
        month: monthKey,
        starting_mrr: round2(starting_mrr),
        new_mrr: round2(new_mrr),
        reactivation_mrr: round2(reactivation_mrr),
        churned_mrr: round2(churned_mrr),
        expansion_mrr: round2(expansion_mrr),
        contraction_mrr: round2(contraction_mrr),
        ending_mrr: round2(ending_mrr),
        net_change: round2(net_change),
      })

      // Source diagnostics for this month.
      const mode: MonthMode =
        eventsSet.size === 0 ? 'proxy' : proxySet.size === 0 ? 'events' : 'mixed'
      // Distinct proxy reasons across instances (e.g. 'immature', 'guard_failed').
      const proxyReasons = Array.from(
        new Set(decisions.filter((d) => d.mode === 'proxy').map((d) => d.reason))
      )
      const source: MonthSource = {
        mode,
        reason: mode === 'events' ? 'ok' : (proxyReasons.join(',') || 'immature'),
      }
      if (mode === 'mixed') {
        source.per_instance = {}
        for (const id of instanceIds) source.per_instance[id] = eventsSet.has(id) ? 'events' : 'proxy'
      }
      monthSources[monthKey] = source
    }

    // Calculate totals
    const totals = movementData.reduce(
      (acc, m) => ({
        new_mrr: acc.new_mrr + m.new_mrr,
        reactivation_mrr: acc.reactivation_mrr + m.reactivation_mrr,
        churned_mrr: acc.churned_mrr + m.churned_mrr,
        expansion_mrr: acc.expansion_mrr + m.expansion_mrr,
        contraction_mrr: acc.contraction_mrr + m.contraction_mrr,
        net_change: acc.net_change + m.net_change,
      }),
      { new_mrr: 0, reactivation_mrr: 0, churned_mrr: 0, expansion_mrr: 0, contraction_mrr: 0, net_change: 0 }
    )

    return success({
      movement_data: movementData,
      totals: {
        new_mrr: round2(totals.new_mrr),
        reactivation_mrr: round2(totals.reactivation_mrr),
        churned_mrr: round2(totals.churned_mrr),
        expansion_mrr: round2(totals.expansion_mrr),
        contraction_mrr: round2(totals.contraction_mrr),
        net_change: round2(totals.net_change),
      },
      months,
      source: { per_month: monthSources },
    }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/metrics/mrr-movement:', err)
    return error(err instanceof Error ? err : new Error('Failed to get MRR movement'))
  }
}
