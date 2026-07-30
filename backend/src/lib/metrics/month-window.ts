/**
 * Rolling calendar-month windows for the metrics endpoints.
 *
 * Why this exists: the obvious way to build a "last N months" window is
 *
 *   const start = new Date()
 *   start.setMonth(start.getMonth() - months + 1)
 *   start.setDate(1)
 *
 * which is WRONG, because setMonth runs while the day-of-month is still today's.
 * On 2026-07-30 with months=6 it asks for "2026-02-30", which JS normalizes to
 * 2026-03-02, and the later setDate(1) can no longer undo the overflow. The whole
 * window shifts forward one month and the endpoint reports NEXT month as the
 * current one (observed in prod on 2026-07-30: the MRR movement block showed
 * "agosto de 2026" with a start-after-end measurement interval).
 *
 * The fix is to never let a >28 day-of-month survive a month change: the
 * `new Date(year, monthIndex, 1)` constructor normalizes out-of-range month
 * indexes (negative or >11) correctly and pins the day to 1 from the start.
 *
 * Month keys are derived from LOCAL getFullYear/getMonth, never from
 * toISOString(), which would shift the key back a month for any local time whose
 * UTC equivalent falls on the previous day (e.g. 00:30 in UTC+2 on the 1st).
 */

/** 'YYYY-MM' for a date, using its local calendar month. */
export function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Local midnight on the first day of the month `offset` months after `from`. */
export function monthStartOf(from: Date, offset = 0): Date {
  return new Date(from.getFullYear(), from.getMonth() + offset, 1)
}

/** Local end-of-day on the last day of the month `offset` months after `from`. */
export function monthEndOf(from: Date, offset = 0): Date {
  return new Date(from.getFullYear(), from.getMonth() + offset + 1, 0, 23, 59, 59, 999)
}

export interface MonthWindow {
  /** Local midnight on day 1 of the earliest month in the window. */
  start: Date
  /** 'YYYY-MM' keys, oldest first. The last entry is always `now`'s month. */
  keys: string[]
}

/**
 * Build a window of `months` consecutive calendar months ending with the month
 * that contains `now`.
 */
export function buildMonthWindow(months: number, now: Date = new Date()): MonthWindow {
  const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
  const keys: string[] = []
  for (let i = 0; i < months; i++) {
    keys.push(monthKeyOf(monthStartOf(start, i)))
  }
  return { start, keys }
}
