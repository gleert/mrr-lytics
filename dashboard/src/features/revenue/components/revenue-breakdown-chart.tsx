import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/ui/icon'
import { cn } from '@/shared/lib/utils'
import { useCurrency } from '@/shared/hooks/use-currency'
import { useRevenueBreakdown, type BreakdownGroupBy } from '../hooks/use-revenue-stats'

const CHART_COLORS = [
  '#7C3AED', // Purple (primary)
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#8B5CF6', // Violet
  '#F97316', // Orange
  '#14B8A6', // Teal
]

interface GroupByOption {
  value: BreakdownGroupBy
  labelKey: string
  icon: string
}

const GROUP_BY_OPTIONS: GroupByOption[] = [
  { value: 'category', labelKey: 'revenue.byCategory', icon: 'category' },
  { value: 'source', labelKey: 'revenue.bySource', icon: 'source' },
  { value: 'type', labelKey: 'revenue.byType', icon: 'donut_large' },
]

export function RevenueBreakdownChart() {
  const { t } = useTranslation()
  const { formatCurrency, formatCurrencyCompact } = useCurrency()
  const [groupBy, setGroupBy] = React.useState<BreakdownGroupBy>('category')
  const { data, isLoading } = useRevenueBreakdown(groupBy)

  const chartData = React.useMemo(() => {
    if (!data?.breakdown) return []
    return data.breakdown.map((item, index) => ({
      ...item,
      // Use API-provided color (from custom categories) or fallback to preset colors
      color: item.color || CHART_COLORS[index % CHART_COLORS.length],
    }))
  }, [data])

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-surface-elevated border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="font-medium text-foreground">{data.name}</p>
          <p className="text-primary-400">{formatCurrency(data.value)}</p>
        </div>
      )
    }
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Icon name="bar_chart" size="lg" />
            {t('revenue.revenueBreakdown')}
          </CardTitle>
          
          {/* Group By Selector */}
          <div className="flex gap-1 p-1 bg-surface rounded-lg border border-border">
            {GROUP_BY_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setGroupBy(option.value)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  groupBy === option.value
                    ? 'bg-primary-500 text-white'
                    : 'text-muted hover:text-foreground hover:bg-surface-hover'
                )}
              >
                <Icon name={option.icon} size="sm" />
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-80">
            <Icon name="sync" size="xl" className="animate-spin text-muted" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 text-muted">
            <Icon name="bar_chart" size="xl" className="mb-2 opacity-50" />
            <p>{t('revenue.noData')}</p>
          </div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis
                  tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickFormatter={(value) => formatCurrencyCompact(value)}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-surface-hover)' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
