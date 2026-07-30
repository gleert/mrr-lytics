import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildMonthWindow, monthKeyOf, monthStartOf, monthEndOf } from './month-window.ts'

/** Every day from 2024-01-01 to 2028-12-31, at a few times of day. */
function* everyDay(): Generator<Date> {
  for (let year = 2024; year <= 2028; year++) {
    for (let month = 0; month < 12; month++) {
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      for (let day = 1; day <= daysInMonth; day++) {
        for (const hour of [0, 12, 23]) {
          yield new Date(year, month, day, hour, 30, 0, 0)
        }
      }
    }
  }
}

test('the last month of the window is always the current month', () => {
  for (const months of [3, 6, 12]) {
    for (const now of everyDay()) {
      const { keys } = buildMonthWindow(months, now)
      assert.equal(
        keys[keys.length - 1],
        monthKeyOf(now),
        `months=${months} now=${now.toString()} produced window ending at ${keys[keys.length - 1]}`,
      )
    }
  }
})

test('the window has exactly `months` strictly consecutive keys', () => {
  for (const months of [3, 6, 12]) {
    for (const now of everyDay()) {
      const { keys } = buildMonthWindow(months, now)
      assert.equal(keys.length, months)
      for (let i = 1; i < keys.length; i++) {
        const [prevYear, prevMonth] = keys[i - 1].split('-').map(Number)
        const expected = monthKeyOf(new Date(prevYear, prevMonth, 1))
        assert.equal(keys[i], expected, `gap between ${keys[i - 1]} and ${keys[i]}`)
      }
    }
  }
})

test('window start is local midnight on day 1 of the earliest month', () => {
  for (const now of everyDay()) {
    const { start, keys } = buildMonthWindow(6, now)
    assert.equal(monthKeyOf(start), keys[0])
    assert.equal(start.getDate(), 1)
    assert.equal(start.getHours(), 0)
    assert.equal(start.getMinutes(), 0)
    assert.equal(start.getSeconds(), 0)
    assert.equal(start.getMilliseconds(), 0)
  }
})

test('regression: day-of-month overflow no longer shifts the window forward', () => {
  // 2026-07-30 minus 5 months is February, which has no 30th. The old
  // setMonth-then-setDate(1) code produced March..August here.
  const { keys } = buildMonthWindow(6, new Date(2026, 6, 30, 19, 24))
  assert.deepEqual(keys, ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'])
})

test('regression: 12-month window on a 31st does not skip a month', () => {
  // 2026-05-31 minus 11 months is June 2025, which has no 31st.
  const { keys } = buildMonthWindow(12, new Date(2026, 4, 31, 8, 0))
  assert.equal(keys[0], '2025-06')
  assert.equal(keys[keys.length - 1], '2026-05')
})

test('window crosses the year boundary correctly', () => {
  const { keys } = buildMonthWindow(6, new Date(2026, 0, 15, 12, 0))
  assert.deepEqual(keys, ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01'])
})

test('leap day is handled', () => {
  const { keys } = buildMonthWindow(12, new Date(2028, 1, 29, 12, 0))
  assert.equal(keys[keys.length - 1], '2028-02')
  assert.equal(keys[0], '2027-03')
})

test('monthStartOf and monthEndOf bracket the whole month', () => {
  const march = monthStartOf(new Date(2026, 2, 17, 9, 0))
  assert.equal(march.getTime(), new Date(2026, 2, 1, 0, 0, 0, 0).getTime())

  const endOfFeb = monthEndOf(new Date(2026, 1, 3, 9, 0))
  assert.equal(endOfFeb.getTime(), new Date(2026, 1, 28, 23, 59, 59, 999).getTime())

  const endOfLeapFeb = monthEndOf(new Date(2028, 1, 3, 9, 0))
  assert.equal(endOfLeapFeb.getTime(), new Date(2028, 1, 29, 23, 59, 59, 999).getTime())
})
