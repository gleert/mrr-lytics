import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from 'recharts'
import { Icon } from '@/shared/components/ui/icon'
import { useMRRLedger, type MRRLedgerEntry } from '../hooks/use-metrics'
import { useCurrency } from '@/shared/hooks/use-currency'
import { ChartTooltip } from '@/shared/components/chart-tooltip'
import { ChartSkeleton } from '@/shared/components/ui/chart-skeleton'

const UNKNOWN_YEAR = '__unknown__'

interface VintagePoint {
  /** Signup year ('YYYY') or UNKNOWN_YEAR for items without a valid start date. */
  year: string
  /** MRR contributed by items acquired in this year. */
  mrr: number
  /** Cumulative share of the total charted MRR reached through this year (0–100). */
  cumulativePct: number
}

/**
 * Groups ledger entries by the year of their start date and computes, for each
 * year, the MRR acquired that year plus the running share of the total MRR.
 * Items with no valid start date fall into a trailing UNKNOWN_YEAR bucket so
 * the cumulative line still reaches 100%.
 */
function buildVintageData(entries: MRRLedgerEntry[]): VintagePoint[] {
  const byYear = new Map<string, number>()
  let unknown = 0
  for (const e of entries) {
    const amt = e.monthly_amount || 0
    if (amt <= 0) continue
    if (e.start_date) {
      const y = e.start_date.slice(0, 4)
      byYear.set(y, (byYear.get(y) ?? 0) + amt)
    } else {
      unknown += amt
    }
  }

  const total = [...byYear.values()].reduce((s, v) => s + v, 0) + unknown
  const denom = total > 0 ? total : 1
  const round2 = (n: number) => Math.round(n * 100) / 100
  const pct = (cum: number) => Math.round((cum / denom) * 1000) / 10

  let cum = 0
  const points: VintagePoint[] = [...byYear.keys()]
    .sort()
    .map(year => {
      cum += byYear.get(year) ?? 0
      return { year, mrr: round2(byYear.get(year) ?? 0), cumulativePct: pct(cum) }
    })

  if (unknown > 0) {
    cum += unknown
    points.push({ year: UNKNOWN_YEAR, mrr: round2(unknown), cumulativePct: pct(cum) })
  }

  return points
}

/**
 * MRR by signup year: bars show how much of the current MRR was acquired each
 * year (by item start date), and the line shows the cumulative share of the
 * total MRR, reading left to right to reveal how today's MRR built up over time.
 * Derived entirely from the MRR ledger, so it reconciles with the MRR KPI.
 */
export function MRRByVintageChart() {
  const { t } = useTranslation()
  const { data, isLoading } = useMRRLedger()
  const { formatCurrency, formatCurrencyCompact, formatPercent } = useCurrency()

  const chartData = useMemo(() => buildVintageData(data?.entries ?? []), [data?.entries])

  const yearLabel = (year: string) =>
    year === UNKNOWN_YEAR ? t('dashboard.mrrByVintage.unknownYear') : year

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-surface">
        <div className="p-4">
          <ChartSkeleton height={320} />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Icon name="calendar_month" size="lg" className="text-primary-400" />
        <div>
          <h2 className="text-lg font-medium">{t('dashboard.mrrByVintage.title')}</h2>
          <p className="text-sm text-muted">{t('dashboard.mrrByVintage.desc')}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        {!chartData.length ? (
          <div className="flex flex-col items-center justify-center h-80 text-muted">
            <Icon name="bar_chart" size="xl" className="mb-2 opacity-50" />
            <p>{t('dashboard.noData')}</p>
          </div>
        ) : (
          <div
            className="h-[280px] sm:h-[320px] lg:h-[350px]"
            role="img"
            aria-label={t('dashboard.mrrByVintage.aria')}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="year"
                  tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickFormatter={yearLabel}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickFormatter={(value) => formatCurrencyCompact(value)}
                  width={70}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickFormatter={(value) => `${value}%`}
                  width={48}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      labelFormatter={yearLabel}
                      valueFormatter={(value, key) =>
                        key === 'cumulativePct'
                          ? formatPercent(value)
                          : formatCurrency(value, { maximumFractionDigits: 0 })
                      }
                    />
                  }
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => (
                    <span className="text-sm">
                      {value === 'mrr'
                        ? t('dashboard.mrrByVintage.barLabel')
                        : t('dashboard.mrrByVintage.lineLabel')}
                    </span>
                  )}
                />
                <Bar
                  yAxisId="left"
                  dataKey="mrr"
                  name="mrr"
                  fill="var(--color-primary-500)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={64}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumulativePct"
                  name="cumulativePct"
                  stroke="var(--color-warning)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--color-warning)' }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
