/**
 * Date range helpers for metrics filtering
 */

export type PeriodPreset = 'today' | '7d' | '30d' | '90d' | '180d' | '365d' | '730d' | 'mtd' | 'last_month' | 'this_year' | 'last_year' | 'this_quarter' | 'last_quarter' | 'ytd' | 'all'

export interface DateRange {
  startDate: Date
  endDate: Date
  days: number
}

/**
 * Parse a period preset or custom date range
 */
export function parseDateRange(
  period: string | null,
  startDateStr: string | null,
  endDateStr: string | null
): DateRange {
  const now = new Date()
  const endDate = endDateStr ? new Date(endDateStr) : now

  // If custom dates provided, use them
  if (startDateStr && endDateStr) {
    const startDate = new Date(startDateStr)
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    return { startDate, endDate, days }
  }

  // Otherwise use preset
  let startDate: Date
  let days: number

  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      days = 1
      break
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      days = 7
      break
    case '30d':
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      days = 30
      break
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      days = 90
      break
    case '180d':
      startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
      days = 180
      break
    case '365d':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
      days = 365
      break
    case '730d':
      startDate = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000)
      days = 730
      break
    case 'mtd':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      days = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) || 1
      break
    case 'last_month': {
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
      startDate = firstOfLastMonth
      return { startDate, endDate: lastOfLastMonth, days: lastOfLastMonth.getDate() }
    }
    case 'this_quarter': {
      const q = Math.floor(now.getMonth() / 3)
      startDate = new Date(now.getFullYear(), q * 3, 1)
      days = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) || 1
      break
    }
    case 'last_quarter': {
      const q = Math.floor(now.getMonth() / 3)
      const lqStart = new Date(now.getFullYear(), (q - 1) * 3, 1)
      const lqEnd = new Date(now.getFullYear(), q * 3, 0, 23, 59, 59, 999)
      startDate = lqStart
      return { startDate, endDate: lqEnd, days: Math.ceil((lqEnd.getTime() - lqStart.getTime()) / (1000 * 60 * 60 * 24)) }
    }
    case 'this_year':
      startDate = new Date(now.getFullYear(), 0, 1)
      days = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) || 1
      break
    case 'last_year': {
      const lyStart = new Date(now.getFullYear() - 1, 0, 1)
      const lyEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999)
      startDate = lyStart
      return { startDate, endDate: lyEnd, days: 365 }
    }
    case 'ytd':
      startDate = new Date(now.getFullYear(), 0, 1)
      days = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      break
    case 'all':
      // Start from 10 years ago (essentially "all time")
      startDate = new Date(now.getFullYear() - 10, 0, 1)
      days = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      break
  }

  return { startDate, endDate, days }
}

/**
 * Format date for display
 */
export function formatDateForDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Get preset label for display
 */
export function getPeriodLabel(period: PeriodPreset): string {
  const labels: Record<PeriodPreset, string> = {
    today: 'Today',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
    '180d': 'Last 6 months',
    '365d': 'Last 12 months',
    '730d': 'Last 2 years',
    mtd: 'This month',
    last_month: 'Last month',
    this_quarter: 'This quarter',
    last_quarter: 'Last quarter',
    this_year: 'This year',
    last_year: 'Last year',
    ytd: 'Year to date',
    all: 'All time',
  }
  return labels[period] || 'Last 30 days'
}
