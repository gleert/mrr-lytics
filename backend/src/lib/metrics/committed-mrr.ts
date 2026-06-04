/**
 * Historical committed-MRR reconstruction from raw WHMCS tables.
 *
 * Single source of truth for "what was the committed MRR at the end of a given
 * month" — the smooth run-rate line used by both the dashboard MRR-trend chart
 * (/api/metrics/mrr-trend) and the forecasting historical line (/api/forecasting).
 *
 * Committed MRR = every active recurring service (hosting + recurring billable
 * items + domains) normalized to a monthly amount, reconstructed for a past month
 * from registration / termination / cancellation dates. This is NOT invoiced
 * revenue — it is the recurring run-rate.
 *
 * NOTE: not re-exported from ./index on purpose — names overlap with mrr-live.ts.
 * Import from '@/lib/metrics/committed-mrr' directly.
 */

const CYCLE_DIVISOR: Record<string, number> = {
  monthly: 1, months: 1, month: 1,
  quarterly: 3,
  'semi-annually': 6, semiannually: 6,
  annually: 12, yearly: 12, years: 12, year: 12,
  biennially: 24, triennially: 36,
}

/** Normalize a billing-cycle amount to its monthly equivalent. Unknown cycle → 0. */
export function toMonthlyAmount(amount: number, cycle: string): number {
  const divisor = CYCLE_DIVISOR[(cycle || '').toLowerCase()]
  if (!divisor) return 0
  return amount / divisor
}

/** Estimate a recurring billable item's cycle length in months. */
export function getCycleMonths(recurcycle: string, recur: number): number {
  const base = (recurcycle || '').toLowerCase().startsWith('year') ? 12 : 1
  return base * (recur || 1)
}

export interface HostingHistRow {
  amount: number | string | null
  billingcycle: string | null
  domainstatus: string | null
  regdate: string | null
  terminationdate: string | null
}

export interface BillableHistRow {
  amount: number | string | null
  recurcycle: string | null
  recur: number | null
  invoicecount: number | null
  recurfor: number | null
  duedate: string | null
  invoice_action: number | null
  cancelled_at: string | null
}

export interface DomainHistRow {
  recurringamount: number | string | null
  registrationperiod: number | string | null
  registrationdate: string | null
  expirydate: string | null
}

export interface BillableWithStart {
  startDate: Date
  cycleMonths: number
  recurfor: number
  invoiceAction: number
  cancelledAt: Date | null
  dueDate: Date
  monthlyMrr: number
}

/**
 * Pre-compute each recurring billable item's inferred start date and monthly MRR.
 * Items without a due date, zero monthly MRR or zero cycle length are dropped.
 */
export function buildBillableWithStart(items: BillableHistRow[]): BillableWithStart[] {
  return (items || []).flatMap(item => {
    if (!item.duedate) return []
    const cycleMonths = getCycleMonths(item.recurcycle || 'Months', item.recur || 1)
    const monthlyMrr = toMonthlyAmount(Number(item.amount) || 0, item.recurcycle || '')
    if (monthlyMrr === 0 || cycleMonths === 0) return []
    const dueDate = new Date(item.duedate)
    const startDate = new Date(dueDate)
    startDate.setMonth(startDate.getMonth() - (item.invoicecount || 0) * cycleMonths)
    return [{
      startDate,
      cycleMonths,
      recurfor: item.recurfor ?? 0,
      invoiceAction: item.invoice_action ?? 0,
      cancelledAt: item.cancelled_at ? new Date(item.cancelled_at) : null,
      dueDate,
      monthlyMrr,
    }]
  })
}

/**
 * Was a recurring billable item active at a given date?
 *
 * Asymmetric like calculate_churn / mrr-movement: strict at "now" so a
 * currently-cancelled item drops off the trend line on the relevant month;
 * permissive in the past so historical months still show its MRR.
 */
export function billableActiveAt(item: BillableWithStart, date: Date, nowTs: number): boolean {
  if (item.startDate > date) return false
  if (item.recurfor > 0) {
    const monthsDiff =
      (date.getFullYear() - item.startDate.getFullYear()) * 12 +
      (date.getMonth() - item.startDate.getMonth())
    if (Math.floor(monthsDiff / item.cycleMonths) >= item.recurfor) return false
  }
  if (item.invoiceAction === 4) return true
  // Strict near present
  if (date.getTime() >= nowTs - 1000) return false
  // Non-committed item (won't auto-renew): count it historically only up to a REAL
  // past lapse date — cancelled_at if known, else the duedate paid-through proxy.
  // A lapse date at/after "now" means it never lapsed within the window, so the
  // permissive proxy would draw it active in every past month and the strict rule
  // above would drop it only in the current one → an artificial cliff (e.g. a
  // cancelled Magento retainer with invoice_action=0 and a future duedate inflating
  // every prior month). Exclude it, consistent with today's committed value.
  const lapseTs = (item.cancelledAt ?? item.dueDate).getTime()
  if (lapseTs >= nowTs) return false
  if (item.cancelledAt) return item.cancelledAt > date
  return item.dueDate >= date
}

/**
 * Was a hosting service active during the month [monthStart, monthEnd]?
 * Only 'Active' services count (Suspended excluded to match mv_mrr_current).
 */
export function hostingActiveInMonth(service: HostingHistRow, monthStart: Date, monthEnd: Date): boolean {
  if (service.domainstatus !== 'Active') return false
  const regDate = service.regdate ? new Date(service.regdate) : null
  const termDate = service.terminationdate ? new Date(service.terminationdate) : null
  if (regDate && regDate > monthEnd) return false
  if (termDate && termDate < monthStart) return false
  return true
}

/** Monthly MRR for a domain (annual recurringamount normalized over its registration period). */
export function domainMonthlyMrr(domain: DomainHistRow): number {
  const annual = Number(domain.recurringamount) || 0
  const period = Number(domain.registrationperiod) || 1
  return annual > 0 && period > 0 ? annual / (period * 12) : 0
}

/** Was a domain active during the month [monthStart, monthEnd]? */
export function domainActiveInMonth(domain: DomainHistRow, monthStart: Date, monthEnd: Date): boolean {
  const regDate = domain.registrationdate ? new Date(domain.registrationdate) : null
  const expDate = domain.expirydate ? new Date(domain.expirydate) : null
  if (!regDate || regDate > monthEnd) return false
  if (expDate && expDate < monthStart) return false
  return true
}

export interface ReconstructionData {
  hosting: HostingHistRow[]
  billable: BillableWithStart[]
  domains: DomainHistRow[]
}

/**
 * Total committed MRR for the month [monthStart, monthEnd], summing active
 * hosting + recurring billable items + domains normalized to monthly amounts.
 */
export function committedMrrForMonth(
  data: ReconstructionData,
  monthStart: Date,
  monthEnd: Date,
  nowTs: number,
): number {
  let total = 0

  for (const service of data.hosting) {
    if (!hostingActiveInMonth(service, monthStart, monthEnd)) continue
    total += toMonthlyAmount(Number(service.amount) || 0, service.billingcycle || '')
  }

  for (const item of data.billable) {
    if (!billableActiveAt(item, monthEnd, nowTs)) continue
    total += item.monthlyMrr
  }

  for (const domain of data.domains) {
    if (!domainActiveInMonth(domain, monthStart, monthEnd)) continue
    total += domainMonthlyMrr(domain)
  }

  return total
}
