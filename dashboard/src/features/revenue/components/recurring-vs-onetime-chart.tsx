import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Icon } from '@/shared/components/ui/icon'
import { useCurrency } from '@/shared/hooks/use-currency'
import { useRevenueTrend } from '../hooks/use-revenue-stats'
import { ChartTooltip } from '@/shared/components/chart-tooltip'
import { ChartSkeleton } from '@/shared/components/ui/chart-skeleton'

export function RecurringVsOnetimeChart() {
  const { t } = useTranslation()
  const { formatCurrencyCompact, symbol } = useCurrency()
  const { data, isLoading } = useRevenueTrend()

  // Sum totals across the whole period
  const { recurring, onetime, total } = useMemo(() => {
    const trend = data?.trend ?? []
    const recurring = trend.reduce((s, p) => s + (p.recurring || 0), 0)
    const onetime   = trend.reduce((s, p) => s + (p.onetime  || 0), 0)
    return { recurring, onetime, total: recurring + onetime }
  }, [data?.trend])

  const recurringPct = total > 0 ? (recurring / total) * 100 : 0
  const onetimePct   = total > 0 ? (onetime  / total) * 100 : 0

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Icon name="stacked_line_chart" size="lg" className="text-primary-400" />
        <div>
          <h2 className="text-lg font-medium">{t('revenue.revenueComparisonTitle')}</h2>
          <p className="text-sm text-muted">{t('revenue.revenueComparisonDesc')}</p>
        </div>
      </div>

      <div className="p-4">
        {isLoading ? (
          <ChartSkeleton height={260} />
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-muted gap-1">
            <Icon name="stacked_line_chart" size="xl" className="mb-1 opacity-50" />
            <p className="font-medium">{t('revenue.noData')}</p>
            <p className="text-xs">{t('revenue.noDataHint')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-xs text-muted mb-0.5">{t('revenue.recurringRevenue')}</p>
                <p className="text-xl font-semibold text-foreground tabular-nums">
                  {formatCurrencyCompact(recurring)}
                </p>
                <p className="text-sm text-primary-400 font-medium">
                  {recurringPct.toFixed(1)}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted mb-0.5">{t('revenue.total')}</p>
                <p className="text-base font-medium text-foreground tabular-nums">
                  {formatCurrencyCompact(total)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted mb-0.5">{t('revenue.onetimeRevenue')}</p>
                <p className="text-xl font-semibold text-foreground tabular-nums">
                  {formatCurrencyCompact(onetime)}
                </p>
                <p className="text-sm font-medium text-emerald-400">
                  {onetimePct.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Horizontal bar */}
            <div className="flex h-5 w-full overflow-hidden rounded-full bg-surface-elevated">
              {recurringPct > 0 && (
                <div
                  className="h-full bg-primary-500 transition-all duration-500"
                  style={{ width: `${recurringPct}%` }}
                />
              )}
              {onetimePct > 0 && (
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${onetimePct}%` }}
                />
              )}
            </div>

            {/* Temporal trend chart */}
            {data?.trend && data.trend.length > 1 && (
              <div className="h-[180px] sm:h-[220px] mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.trend}
                    margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
                  >
                    <defs>
                      <linearGradient id="rev-recurring-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#7C3AED" stopOpacity={0.1} />
                      </linearGradient>
                      <linearGradient id="rev-onetime-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--color-border)' }}
                      tickFormatter={formatDateLabel}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--color-border)' }}
                      tickFormatter={(v) => `${symbol}${(v / 1000).toFixed(0)}k`}
                      width={48}
                    />
                    <Tooltip
                      content={
                        <ChartTooltip
                          labelFormatter={(label) => formatDateLabel(String(label))}
                          valueFormatter={(v) => formatCurrencyCompact(v)}
                          showTotal
                        />
                      }
                    />
                    <Legend
                      formatter={(value) => (
                        <span className="text-xs">
                          {value === 'recurring' ? t('revenue.recurringRevenue') : t('revenue.onetimeRevenue')}
                        </span>
                      )}
                    />
                    <Area
                      type="monotone"
                      dataKey="recurring"
                      stackId="1"
                      stroke="#7C3AED"
                      fill="url(#rev-recurring-grad)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="onetime"
                      stackId="1"
                      stroke="#10B981"
                      fill="url(#rev-onetime-grad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
