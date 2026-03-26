/**
 * Date range helpers for metrics filtering
 */

export type PeriodPreset = 'today' | '7d' | '30d' | '90d' | '180d' | '365d' | '730d' | 'mtd' | 'ytd' | 'all'

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
    ytd: 'Year to date',
    all: 'All time',
  }
  return labels[period] || 'Last 30 days'
}
