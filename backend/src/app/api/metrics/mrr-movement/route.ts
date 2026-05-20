import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'
import { getHistoryDaysLimit } from '@/lib/subscription/limits'

export const dynamic = 'force-dynamic'

interface MovementDataPoint {
  month: string
  starting_mrr: number
  new_mrr: number
  churned_mrr: number
  expansion_mrr: number
  contraction_mrr: number
  ending_mrr: number
  net_change: number
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
        .select('recurringamount, registrationperiod, status, registrationdate, expirydate')
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
    //   3. If no terminationdate: active only if current status is Active/Suspended
    const wasActiveAt = (service: typeof hostingServices[0], date: Date): boolean => {
      const regDate = service.regdate && service.regdate !== '0000-00-00'
        ? new Date(service.regdate) : null
      const termDate = service.terminationdate && service.terminationdate !== '0000-00-00'
        ? new Date(service.terminationdate) : null

      if (!regDate || regDate > date) return false
      if (termDate && termDate <= date) return false

      // Service has a termination date in the future → was active at this date
      if (termDate && termDate > date) return true

      // No termination date: use current status as proxy
      return ['Active', 'Suspended'].includes(service.domainstatus)
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
    const now = new Date()

    for (let i = 0; i < months; i++) {
      const monthDate = new Date(startDate)
      monthDate.setMonth(startDate.getMonth() + i)

      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
      const naturalMonthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999)
      // Cap at "now" for the current month so future-dated terminationdates
      // (pending cancellations scheduled later this month) don't get counted
      // as already churned and pull net_change negative mid-month.
      const monthEnd = naturalMonthEnd > now ? now : naturalMonthEnd
      const prevMonthEnd = new Date(monthStart.getTime() - 1)
      // Strict invoice_action check only at the most recent observation point
      // (current month). For older months we have no historical invoice_action
      // snapshot, so the cancelled_at + duedate proxy is the best we can do —
      // and applying strict there would back-date cancellations into past months.
      const isCurrentMonth = naturalMonthEnd > now

      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`

      let starting_mrr = 0
      let new_mrr = 0
      let churned_mrr = 0
      let ending_mrr = 0

      hostingServices?.forEach(service => {
        const wasActive = wasActiveAt(service, prevMonthEnd)
        const isActive  = wasActiveAt(service, monthEnd)
        const mrr = getMonthlyAmount(service)

        if (wasActive) starting_mrr += mrr
        if (isActive)  ending_mrr   += mrr

        if (!wasActive && isActive)   new_mrr     += mrr  // new this month
        if (wasActive  && !isActive)  churned_mrr += mrr  // churned this month
      })

      billableWithStart.forEach(item => {
        const wasActive = billableActiveAt(item, prevMonthEnd, false)
        const isActive  = billableActiveAt(item, monthEnd, isCurrentMonth)

        if (wasActive) starting_mrr += item.mrr
        if (isActive)  ending_mrr   += item.mrr

        if (!wasActive && isActive)  new_mrr     += item.mrr
        if (wasActive  && !isActive) churned_mrr += item.mrr
      })

      domainServices?.forEach(domain => {
        const mrr = domainMonthlyAmount(domain)
        if (mrr === 0) return
        const wasActive = domainActiveAt(domain, prevMonthEnd, false)
        const isActive  = domainActiveAt(domain, monthEnd, isCurrentMonth)

        if (wasActive) starting_mrr += mrr
        if (isActive)  ending_mrr   += mrr

        if (!wasActive && isActive)  new_mrr     += mrr  // new this month
        if (wasActive  && !isActive) churned_mrr += mrr  // churned this month
      })

      // Expansion/contraction require historical price data — not available
      const expansion_mrr  = 0
      const contraction_mrr = 0
      const net_change = new_mrr - churned_mrr

      movementData.push({
        month: monthKey,
        starting_mrr: Math.round(starting_mrr * 100) / 100,
        new_mrr: Math.round(new_mrr * 100) / 100,
        churned_mrr: Math.round(churned_mrr * 100) / 100,
        expansion_mrr: Math.round(expansion_mrr * 100) / 100,
        contraction_mrr: Math.round(contraction_mrr * 100) / 100,
        ending_mrr: Math.round(ending_mrr * 100) / 100,
        net_change: Math.round(net_change * 100) / 100,
      })
    }

    // Calculate totals
    const totals = movementData.reduce(
      (acc, m) => ({
        new_mrr: acc.new_mrr + m.new_mrr,
        churned_mrr: acc.churned_mrr + m.churned_mrr,
        expansion_mrr: acc.expansion_mrr + m.expansion_mrr,
        contraction_mrr: acc.contraction_mrr + m.contraction_mrr,
        net_change: acc.net_change + m.net_change,
      }),
      { new_mrr: 0, churned_mrr: 0, expansion_mrr: 0, contraction_mrr: 0, net_change: 0 }
    )

    return success({
      movement_data: movementData,
      totals: {
        new_mrr: Math.round(totals.new_mrr * 100) / 100,
        churned_mrr: Math.round(totals.churned_mrr * 100) / 100,
        expansion_mrr: Math.round(totals.expansion_mrr * 100) / 100,
        contraction_mrr: Math.round(totals.contraction_mrr * 100) / 100,
        net_change: Math.round(totals.net_change * 100) / 100,
      },
      months,
    }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/metrics/mrr-movement:', err)
    return error(err instanceof Error ? err : new Error('Failed to get MRR movement'))
  }
}
