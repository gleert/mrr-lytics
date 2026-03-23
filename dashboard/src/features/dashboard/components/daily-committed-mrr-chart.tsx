import { useState, useMemo } from 'react'
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
import { useDailyMRR } from '../hooks/use-metrics'
import { cn } from '@/shared/lib/utils'
import { useCurrency } from '@/shared/hooks/use-currency'
import { ChartTooltip } from '@/shared/components/chart-tooltip'
import { ChartSkeleton } from '@/shared/components/ui/chart-skeleton'

const PERIOD_OPTIONS = [30, 60, 90] as const
type PeriodDays = typeof PERIOD_OPTIONS[number]

// Default colors for categories if not specified
const DEFAULT_CATEGORY_COLORS = [
  '#7C3AED', // Purple
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#8B5CF6', // Violet
]

const CHURN_COLOR = '#EF4444' // Red for pending churn

export function DailyCommittedMRRChart() {
  const { t } = useTranslation()
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodDays>(30)
  const { data, isLoading } = useDailyMRR(selectedPeriod)
  const { formatCurrency, symbol } = useCurrency()

  // Transform data for stacked area chart
  const chartData = useMemo(() => {
    if (!data?.daily_data) return []

    return data.daily_data.map(point => {
      const transformed: Record<string, string | number> = {
        date: point.date,
        pending_churn: point.pending_churn,
      }

      // Add each category
      Object.entries(point.categories).forEach(([category, value]) => {
        transformed[category] = value
      })

      return transformed
    })
  }, [data])

  // Get category colors map
  const categoryColors = useMemo(() => {
    const colors: Record<string, string> = {}
    data?.categories?.forEach((cat, index) => {
      colors[cat.name] = cat.color || DEFAULT_CATEGORY_COLORS[index % DEFAULT_CATEGORY_COLORS.length]
    })
    return colors
  }, [data?.categories])

  // Get all category names (excluding pending_churn)
  const categoryNames = useMemo(() => {
    return data?.categories?.map(c => c.name) || []
  }, [data?.categories])

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      {/* Header with period filter */}
      <div className="flex flex-col gap-4 p-4 border-b border-border sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Icon name="stacked_line_chart" size="lg" className="text-primary-400" />
          <div>
            <h2 className="text-lg font-medium">{t('dashboard.dailyMrrTitle')}</h2>
            <p className="text-sm text-muted">{t('dashboard.dailyMrrDesc')}</p>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex gap-1 p-1 rounded-lg bg-surface-elevated">
          {PERIOD_OPTIONS.map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                selectedPeriod === period
                  ? 'bg-primary text-white'
                  : 'text-muted hover:text-foreground hover:bg-surface'
              )}
            >
              {period} {t('dashboard.days')}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        {isLoading ? (
          <ChartSkeleton height={320} />
        ) : !chartData.length ? (
          <div className="flex flex-col items-center justify-center h-80 text-muted">
            <Icon name="bar_chart" size="xl" className="mb-2 opacity-50" />
            <p>{t('dashboard.noData')}</p>
          </div>
        ) : (
          <div className="h-[280px] sm:h-[320px] lg:h-[350px]" role="img" aria-label={t('dashboard.dailyMRRChart')}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              >
                <defs>
                  {/* Gradients for each category */}
                  {categoryNames.map(name => (
                    <linearGradient key={name} id={`gradient-${name.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={categoryColors[name]} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={categoryColors[name]} stopOpacity={0.2} />
                    </linearGradient>
                  ))}
                  {/* Gradient for pending churn */}
                  <linearGradient id="gradient-pending-churn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHURN_COLOR} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={CHURN_COLOR} stopOpacity={0.1} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickFormatter={formatDateLabel}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickFormatter={(value) => `${symbol}${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      labelFormatter={(label) => formatDateLabel(String(label))}
                      valueFormatter={(v) => formatCurrency(v)}
                      showTotal
                    />
                  }
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => (
                    <span className="text-sm">
                      {value === 'pending_churn' ? t('dashboard.pendingChurn') : value}
                    </span>
                  )}
                />

                {/* Stacked areas for each category */}
                {categoryNames.map(name => (
                  <Area
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stackId="1"
                    stroke={categoryColors[name]}
                    fill={`url(#gradient-${name.replace(/\s+/g, '-')})`}
                    strokeWidth={2}
                  />
                ))}

                {/* Pending churn as separate line (not stacked) */}
                <Area
                  type="monotone"
                  dataKey="pending_churn"
                  stackId="2"
                  stroke={CHURN_COLOR}
                  fill="url(#gradient-pending-churn)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Legend explanation */}
      {data && data.categories.length > 0 && (
        <div className="px-4 pb-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-elevated text-sm">
            <Icon name="info" size="sm" className="text-muted mt-0.5" />
            <p className="text-muted">
              {t('dashboard.dailyMrrLegend')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
