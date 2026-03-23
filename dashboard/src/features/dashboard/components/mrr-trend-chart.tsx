import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart,
} from 'recharts'
import { Icon } from '@/shared/components/ui/icon'
import { useMRRTrend } from '../hooks/use-metrics'
import { useCurrency } from '@/shared/hooks/use-currency'
import { ChartTooltip } from '@/shared/components/chart-tooltip'
import { ChartSkeleton } from '@/shared/components/ui/chart-skeleton'

export function MRRTrendChart() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data, isLoading } = useMRRTrend()
  const { formatCurrency, symbol } = useCurrency()
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Initialize with default groups when data loads
  useEffect(() => {
    if (data?.default_groups && selectedGroups.length === 0) {
      setSelectedGroups(data.default_groups)
    }
  }, [data?.default_groups])

  // Build color map from all groups
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {}
    data?.all_groups?.forEach(group => {
      map[group.name] = group.color
    })
    return map
  }, [data?.all_groups])

  // Transform data for chart
  const chartData = useMemo(() => {
    if (!data?.monthly_data) return []

    return data.monthly_data.map(point => {
      const transformed: Record<string, string | number> = {
        month: point.month,
        total: point.total,
      }

      // Add selected groups
      selectedGroups.forEach(groupName => {
        transformed[groupName] = point.groups[groupName] || 0
      })

      return transformed
    })
  }, [data, selectedGroups])

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
  }

  const toggleGroup = (groupName: string) => {
    setSelectedGroups(prev => {
      if (prev.includes(groupName)) {
        return prev.filter(g => g !== groupName)
      } else {
        return [...prev, groupName]
      }
    })
  }

  const selectAll = () => {
    setSelectedGroups(data?.all_groups?.map(g => g.name) || [])
  }

  const selectTop5 = () => {
    setSelectedGroups(data?.default_groups || [])
  }

  const clearAll = () => {
    setSelectedGroups([])
  }

  const usingCategories = data?.using_categories ?? false
  const uncategorizedPct = data?.uncategorized_mrr_pct ?? 0

  return (
    <div className="rounded-xl border border-border bg-surface">
      {/* Header */}
      <div className="flex flex-col gap-4 p-4 border-b border-border sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Icon name="trending_up" size="lg" className="text-primary-400" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-medium">{t('dashboard.mrrTrendTitle')}</h2>
              {data && (
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    usingCategories
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {usingCategories
                    ? t('dashboard.mrrTrendBadgeCategories')
                    : t('dashboard.mrrTrendBadgeGroups')}
                </span>
              )}
            </div>
            <p className="text-sm text-muted">
              {data
                ? usingCategories
                  ? t('dashboard.mrrTrendDescCategories')
                  : t('dashboard.mrrTrendDescGroups')
                : t('dashboard.mrrTrendDesc')}
            </p>
          </div>
        </div>

        {/* Group selector dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border bg-surface-elevated hover:bg-surface"
          >
            <Icon name="filter_list" size="sm" />
            <span>{t('dashboard.selectGroups')}</span>
            <span className="px-1.5 py-0.5 text-xs rounded bg-primary/10 text-primary">
              {selectedGroups.length}
            </span>
            <Icon name={dropdownOpen ? 'expand_less' : 'expand_more'} size="sm" />
          </button>

          {dropdownOpen && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setDropdownOpen(false)}
              />
              
              {/* Dropdown */}
              <div className="absolute right-0 top-full mt-2 w-72 max-h-80 overflow-y-auto rounded-lg border border-border bg-background shadow-lg z-20">
                {/* Quick actions */}
                <div className="flex gap-2 p-2 border-b border-border">
                  <button
                    onClick={selectTop5}
                    className="px-2 py-1 text-xs rounded bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    Top 5
                  </button>
                  <button
                    onClick={selectAll}
                    className="px-2 py-1 text-xs rounded bg-surface hover:bg-surface-elevated border border-border"
                  >
                    {t('dashboard.selectAll')}
                  </button>
                  <button
                    onClick={clearAll}
                    className="px-2 py-1 text-xs rounded bg-surface hover:bg-surface-elevated border border-border"
                  >
                    {t('dashboard.clearAll')}
                  </button>
                </div>

                {/* Group list */}
                <div className="p-2 space-y-1">
                  {data?.all_groups?.map(group => (
                    <label
                      key={group.name}
                      className="flex items-center gap-3 px-2 py-1.5 rounded cursor-pointer hover:bg-surface"
                    >
                      <input
                        type="checkbox"
                        checked={selectedGroups.includes(group.name)}
                        onChange={() => toggleGroup(group.name)}
                        className="rounded border-border"
                      />
                      <span
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: group.color }}
                      />
                      <span className="flex-1 text-sm truncate">{group.name}</span>
                      <span className="text-xs text-muted">
                        {formatCurrency(group.total_mrr / 12)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Fallback warning */}
      {data && !usingCategories && (
        <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm">
          <div className="flex items-center gap-2 text-amber-400">
            <Icon name="warning" size="sm" />
            <span>
              {t('dashboard.mrrTrendFallbackWarning', { pct: uncategorizedPct.toFixed(0) })}
            </span>
          </div>
          <button
            onClick={() => navigate('/products')}
            className="flex-shrink-0 text-xs font-medium text-amber-400 underline underline-offset-2 hover:text-amber-300"
          >
            {t('dashboard.mrrTrendFallbackCta')}
          </button>
        </div>
      )}

      {/* Chart */}
      <div className="p-4">
        {isLoading ? (
          <ChartSkeleton height={320} />
        ) : !chartData.length || selectedGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 text-muted">
            <Icon name="bar_chart" size="xl" className="mb-2 opacity-50" />
            <p>{selectedGroups.length === 0 ? t('dashboard.selectGroupsHint') : t('dashboard.noData')}</p>
          </div>
        ) : (
          <div className="h-[280px] sm:h-[320px] lg:h-[350px]" role="img" aria-label={t('dashboard.mrrTrendChart')}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              >
                <defs>
                  {selectedGroups.map(name => (
                    <linearGradient key={name} id={`gradient-trend-${name.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colorMap[name]} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={colorMap[name]} stopOpacity={0.2} />
                    </linearGradient>
                  ))}
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickFormatter={formatMonth}
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
                      labelFormatter={formatMonth}
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
                      {value === 'total' ? t('dashboard.committedMrr') : value}
                    </span>
                  )}
                />

                {/* Stacked areas for each selected group */}
                {selectedGroups.map(name => (
                  <Area
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stackId="1"
                    stroke={colorMap[name]}
                    fill={`url(#gradient-trend-${name.replace(/\s+/g, '-')})`}
                    strokeWidth={2}
                  />
                ))}

                {/* Committed MRR line */}
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="var(--color-foreground)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="total"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
