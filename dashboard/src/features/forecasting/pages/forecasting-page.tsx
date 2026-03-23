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
  ComposedChart,
  Line,
  Legend,
  ReferenceLine,
} from 'recharts'
import { NoInstancesGuard } from '@/shared/components/no-instances-guard'
import { Icon } from '@/shared/components/ui/icon'
import { KPICard } from '@/features/dashboard/components/kpi-card'
import { DashboardFilters } from '@/features/dashboard/components/dashboard-filters'
import { useForecastingStats } from '../hooks/use-forecasting-stats'
import { useCurrency } from '@/shared/hooks/use-currency'
import { ForecastCallout } from '../components/forecast-callout'
import { ChartTooltip } from '@/shared/components/chart-tooltip'
import { ChartSkeleton } from '@/shared/components/ui/chart-skeleton'

const BILLING_CYCLE_COLORS = [
  '#7C3AED', // Purple
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
]

export function ForecastingPage() {
  const { t } = useTranslation()
  const { data: stats, isLoading } = useForecastingStats()
  const { formatCurrency, symbol } = useCurrency()

  // Get bucket type label based on the analysis granularity
  const getBucketLabel = (bucketType: string | undefined) => {
    switch (bucketType) {
      case 'daily': return t('forecasting.bucketDaily')
      case 'weekly': return t('forecasting.bucketWeekly')
      case 'monthly': return t('forecasting.bucketMonthly')
      default: return ''
    }
  }

  // Calculate billing cycle percentages
  const totalCycleMrr = stats?.billing_cycle_breakdown?.reduce((sum, item) => sum + item.mrr, 0) || 0

  return (
    <NoInstancesGuard>
    <div className="space-y-6">
      {/* Page header with filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('forecasting.title')}</h1>
          <p className="text-muted">{t('forecasting.subtitle')}</p>
        </div>
        <DashboardFilters />
      </div>

      {/* Forecast callout banner */}
      {!isLoading && stats?.scenarios && (
        <ForecastCallout stats={stats} />
      )}

      {/* MRR Projections Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{t('forecasting.mrrProjectionsTitle')}</h2>
          <p className="text-muted">{t('forecasting.mrrProjectionsDesc')}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <KPICard
            title={t('forecasting.currentMrr')}
            value={stats?.current_mrr ?? 0}
            format="currency"
            loading={isLoading}
            icon={<Icon name="paid" size="2xl" />}
            accentColor="primary"
          />
          <KPICard
            title={t('forecasting.projectedMrr')}
            value={stats?.projected_mrr ?? 0}
            format="currency"
            loading={isLoading}
            icon={<Icon name="trending_up" size="2xl" />}
            accentColor="success"
          />
          <KPICard
            title={t('forecasting.mrrDelta')}
            value={stats?.mrr_delta ?? 0}
            format="currency"
            loading={isLoading}
            icon={<Icon name={(stats?.mrr_delta ?? 0) >= 0 ? 'arrow_upward' : 'arrow_downward'} size="2xl" />}
            accentColor={(stats?.mrr_delta ?? 0) >= 0 ? 'success' : 'error'}
          />
          <KPICard
            title={t('forecasting.projectedGrowth')}
            value={stats?.projected_growth ?? 0}
            format="percent"
            loading={isLoading}
            icon={<Icon name="show_chart" size="2xl" />}
            accentColor={(stats?.projected_growth ?? 0) >= 0 ? 'success' : 'error'}
          />
        </div>
      </div>

      {/* Annual Projections + ARPU Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{t('forecasting.annualProjectionsTitle')}</h2>
          <p className="text-muted">{t('forecasting.annualProjectionsDesc')}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <KPICard
            title={t('forecasting.projectedArr')}
            value={stats?.projected_arr ?? 0}
            format="currency"
            loading={isLoading}
            icon={<Icon name="calendar_month" size="2xl" />}
            accentColor="info"
          />
          <KPICard
            title={t('forecasting.confidenceLevel')}
            value={stats?.confidence_level ?? 0}
            format="percent"
            loading={isLoading}
            icon={<Icon name="verified" size="2xl" />}
            accentColor={(stats?.confidence_level ?? 0) >= 70 ? 'success' : (stats?.confidence_level ?? 0) >= 50 ? 'warning' : 'error'}
          />
          <KPICard
            title={t('forecasting.currentArpu')}
            value={stats?.current_arpu ?? 0}
            format="currency"
            loading={isLoading}
            icon={<Icon name="person" size="2xl" />}
            accentColor="primary"
          />
          <KPICard
            title={t('forecasting.projectedArpu')}
            value={stats?.projected_arpu ?? 0}
            format="currency"
            loading={isLoading}
            icon={<Icon name="person_add" size="2xl" />}
            accentColor="success"
          />
        </div>
      </div>

      {/* Growth Acceleration + Milestone */}
      {!isLoading && stats && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Growth Acceleration */}
          <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ${
                stats.growth_acceleration === 'accelerating' ? 'bg-emerald-500/10' :
                stats.growth_acceleration === 'decelerating' ? 'bg-red-500/10' : 'bg-blue-500/10'
              }`}>
                <Icon
                  name={
                    stats.growth_acceleration === 'accelerating' ? 'rocket_launch' :
                    stats.growth_acceleration === 'decelerating' ? 'trending_down' : 'trending_flat'
                  }
                  size="md"
                  className={
                    stats.growth_acceleration === 'accelerating' ? 'text-emerald-400' :
                    stats.growth_acceleration === 'decelerating' ? 'text-red-400' : 'text-blue-400'
                  }
                />
              </div>
              <div>
                <h3 className="text-sm font-medium">{t('forecasting.growthAcceleration')}</h3>
                <p className={`text-lg font-semibold ${
                  stats.growth_acceleration === 'accelerating' ? 'text-emerald-400' :
                  stats.growth_acceleration === 'decelerating' ? 'text-red-400' : 'text-blue-400'
                }`}>
                  {t(`forecasting.acceleration.${stats.growth_acceleration}`)}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted">
              {t(`forecasting.accelerationDesc.${stats.growth_acceleration}`)}
            </p>
          </div>

          {/* Milestone */}
          <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/10 shrink-0">
                <Icon name="flag" size="md" className="text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium">{t('forecasting.nextMilestone')}</h3>
                {stats.next_milestone && stats.months_to_milestone ? (
                  <p className="text-lg font-semibold">
                    {formatCurrency(stats.next_milestone, { maximumFractionDigits: 0 })}
                  </p>
                ) : (
                  <p className="text-lg font-semibold text-muted">—</p>
                )}
              </div>
            </div>
            {stats.next_milestone && stats.months_to_milestone ? (
              <div className="space-y-2">
                <p className="text-xs text-muted">
                  {t('forecasting.milestoneDesc', { months: stats.months_to_milestone })}
                </p>
                {/* Progress bar to milestone */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-surface-elevated overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${Math.min((stats.current_mrr / stats.next_milestone) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted font-medium">
                    {Math.round((stats.current_mrr / stats.next_milestone) * 100)}%
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted">
                {stats.projected_growth <= 0
                  ? t('forecasting.milestoneNegativeGrowth')
                  : t('forecasting.milestoneReached')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Forecast Breakdown Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{t('forecasting.breakdownTitle')}</h2>
          <p className="text-muted">{t('forecasting.breakdownDesc')}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Revenue Trend Chart */}
          <div className="rounded-xl border border-border bg-surface">
            <div className="flex items-center gap-3 p-4 border-b border-border">
              <Icon name="show_chart" size="lg" className="text-primary-400" />
              <div>
                <h3 className="text-lg font-medium">{t('forecasting.revenueTrendTitle')}</h3>
                <p className="text-sm text-muted">{t('forecasting.revenueTrendDesc')}</p>
              </div>
            </div>
            <div className="p-4">
              {isLoading ? (
                <ChartSkeleton height={260} />
              ) : !stats?.revenue_trend?.length ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted gap-1">
                  <Icon name="bar_chart" size="xl" className="mb-1 opacity-50" />
                  <p className="font-medium">{t('forecasting.noData')}</p>
                  <p className="text-xs">{t('forecasting.noDataHint')}</p>
                </div>
              ) : (
                <div className="h-[220px] sm:h-[260px] lg:h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={stats.revenue_trend}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
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
                        tickFormatter={(value) => {
                          if (stats.bucket_type === 'monthly') {
                            const [year, month] = value.split('-')
                            return `${month}/${year.slice(2)}`
                          }
                          const d = new Date(value)
                          return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
                        }}
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
                            valueFormatter={(v) => formatCurrency(v)}
                          />
                        }
                      />
                      <Legend
                        formatter={(value) => (
                          <span className="text-sm">
                            {value === 'projected' ? t('forecasting.projectionLabel') : value}
                          </span>
                        )}
                      />
                      {/* Reference line at the projection point */}
                      {stats.revenue_trend.length > 1 && (
                        <ReferenceLine
                          x={stats.revenue_trend[stats.revenue_trend.length - 2].date}
                          stroke="var(--color-muted)"
                          strokeDasharray="5 5"
                          label={{
                            value: t('forecasting.projectionLabel'),
                            position: 'top',
                            fill: 'var(--color-muted)',
                            fontSize: 10
                          }}
                        />
                      )}
                      <Bar
                        dataKey="revenue"
                        name={t('forecasting.revenue')}
                        radius={[4, 4, 0, 0]}
                      >
                        {stats.revenue_trend.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={index === stats.revenue_trend.length - 1
                              ? '#7C3AED'
                              : '#10B981'
                            }
                            opacity={index === stats.revenue_trend.length - 1 ? 0.5 : 1}
                            strokeWidth={index === stats.revenue_trend.length - 1 ? 2 : 0}
                            stroke={index === stats.revenue_trend.length - 1 ? '#7C3AED' : 'none'}
                            strokeDasharray={index === stats.revenue_trend.length - 1 ? '4 2' : ''}
                          />
                        ))}
                      </Bar>
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="var(--color-primary)"
                        strokeWidth={2}
                        dot={false}
                        name={t('forecasting.trend')}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* MRR by Billing Cycle Chart */}
          <div className="rounded-xl border border-border bg-surface">
            <div className="flex items-center gap-3 p-4 border-b border-border">
              <Icon name="pie_chart" size="lg" className="text-primary-400" />
              <div>
                <h3 className="text-lg font-medium">{t('forecasting.billingCycleTitle')}</h3>
                <p className="text-sm text-muted">{t('forecasting.billingCycleDesc')}</p>
              </div>
            </div>
            <div className="p-4">
              {isLoading ? (
                <ChartSkeleton height={260} />
              ) : !stats?.billing_cycle_breakdown?.length ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted gap-1">
                  <Icon name="bar_chart" size="xl" className="mb-1 opacity-50" />
                  <p className="font-medium">{t('forecasting.noData')}</p>
                  <p className="text-xs">{t('forecasting.noDataHint')}</p>
                </div>
              ) : (
                <div className="h-[220px] sm:h-[260px] lg:h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.billing_cycle_breakdown}
                      layout="vertical"
                      margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border)"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: 'var(--color-border)' }}
                        tickFormatter={(value) => `${symbol}${(value / 1000).toFixed(0)}k`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: 'var(--color-border)' }}
                        width={70}
                      />
                      <Tooltip
                        content={
                          <ChartTooltip
                            valueFormatter={(v, key) => key === 'mrr' ? formatCurrency(v) : String(v)}
                          />
                        }
                      />
                      <Bar
                        dataKey="mrr"
                        name={t('forecasting.mrrLabel')}
                        radius={[0, 4, 4, 0]}
                      >
                        {stats.billing_cycle_breakdown.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={BILLING_CYCLE_COLORS[index % BILLING_CYCLE_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            {/* Services count summary with percentages */}
            {stats?.billing_cycle_breakdown && stats.billing_cycle_breakdown.length > 0 && (
              <div className="px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {stats.billing_cycle_breakdown.map((item, index) => {
                    const pct = totalCycleMrr > 0 ? (item.mrr / totalCycleMrr) * 100 : 0
                    return (
                      <div
                        key={item.name}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-elevated text-xs"
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: BILLING_CYCLE_COLORS[index % BILLING_CYCLE_COLORS.length] }}
                        />
                        <span className="font-medium">{item.name}</span>
                        <span className="text-muted">{item.count} {t('forecasting.services')}</span>
                        <span className="text-muted">·</span>
                        <span className="font-medium">{pct.toFixed(1)}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scenario Comparison Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{t('forecasting.scenarioTitle')}</h2>
          <p className="text-muted">{t('forecasting.scenarioDesc')}</p>
        </div>

        {isLoading ? (
          <ChartSkeleton height={200} />
        ) : !stats?.scenarios ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted gap-1">
            <Icon name="analytics" size="xl" className="mb-1 opacity-50" />
            <p className="font-medium">{t('forecasting.noData')}</p>
            <p className="text-xs">{t('forecasting.noDataHint')}</p>
          </div>
        ) : (() => {
          const { pessimistic, baseline, optimistic } = stats.scenarios
          const minMRR = Math.min(pessimistic.mrr, baseline.mrr, optimistic.mrr)
          const maxMRR = Math.max(pessimistic.mrr, baseline.mrr, optimistic.mrr)
          const rangeMRR = maxMRR - minMRR || 1
          const toPos = (mrr: number) => ((mrr - minMRR) / rangeMRR) * 88 + 4 // 4–92% to keep dots inset

          const scenarios = [
            { key: 'pessimistic', label: t('forecasting.pessimistic'), data: pessimistic, dotColor: 'bg-muted', growthColor: pessimistic.growth >= 0 ? 'text-muted' : 'text-error' },
            { key: 'baseline',    label: t('forecasting.baseline'),    data: baseline,    dotColor: 'bg-primary', growthColor: baseline.growth >= 0 ? 'text-primary' : 'text-error' },
            { key: 'optimistic',  label: t('forecasting.optimistic'),  data: optimistic,  dotColor: 'bg-success', growthColor: optimistic.growth >= 0 ? 'text-success' : 'text-error' },
          ]

          return (
            <div className="rounded-xl border border-border bg-surface p-4 sm:p-6 space-y-6 sm:space-y-8">
              {/* Three columns: name + MRR + growth */}
              <div className="grid grid-cols-3 gap-2">
                {scenarios.map(({ key, label, data, dotColor, growthColor }) => (
                  <div key={key} className="flex flex-col items-center gap-0.5 sm:gap-1 text-center min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                      <p className="text-[10px] sm:text-xs text-muted uppercase tracking-wide truncate">{label}</p>
                    </div>
                    <p className="text-lg sm:text-2xl font-semibold tabular-nums truncate w-full">
                      {formatCurrency(data.mrr, { maximumFractionDigits: 0 })}
                    </p>
                    <p className={`text-xs sm:text-sm font-medium tabular-nums ${growthColor}`}>
                      {data.growth >= 0 ? '+' : ''}{data.growth.toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>

              {/* Range bar */}
              <div className="space-y-2">
                <div className="relative h-1.5 bg-surface-elevated rounded-full">
                  {/* Filled segment from pessimistic to optimistic */}
                  <div
                    className="absolute h-full rounded-full bg-border"
                    style={{ left: `${toPos(pessimistic.mrr)}%`, width: `${toPos(optimistic.mrr) - toPos(pessimistic.mrr)}%` }}
                  />
                  {/* Pessimistic dot */}
                  <div className="absolute w-3 h-3 rounded-full bg-muted border-2 border-surface -top-[3px] -translate-x-1/2" style={{ left: `${toPos(pessimistic.mrr)}%` }} />
                  {/* Baseline dot */}
                  <div className="absolute w-3 h-3 rounded-full bg-primary border-2 border-surface -top-[3px] -translate-x-1/2" style={{ left: `${toPos(baseline.mrr)}%` }} />
                  {/* Optimistic dot */}
                  <div className="absolute w-3 h-3 rounded-full bg-success border-2 border-surface -top-[3px] -translate-x-1/2" style={{ left: `${toPos(optimistic.mrr)}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted">
                  <span>{formatCurrency(minMRR, { maximumFractionDigits: 0 })}</span>
                  <span>{formatCurrency(maxMRR, { maximumFractionDigits: 0 })}</span>
                </div>
              </div>

              {/* Explanation */}
              <p className="text-xs text-muted">{t('forecasting.scenarioExplanationDesc')}</p>

              {/* Forecast meta — confidence + data points */}
              {stats && (
                <div className="pt-2 border-t border-border flex flex-wrap gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          stats.confidence_level >= 70 ? 'bg-success' : stats.confidence_level >= 50 ? 'bg-warning' : 'bg-error'
                        }`}
                        style={{ width: `${stats.confidence_level}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted">
                      {t('forecasting.confidenceLevel')}: <span className="text-foreground font-medium">{stats.confidence_level}%</span>
                    </span>
                  </div>
                  <span className="text-xs text-muted">
                    {t('forecasting.dataPointsUsed')}: <span className="text-foreground font-medium">{stats.data_points} {getBucketLabel(stats.bucket_type)}</span>
                  </span>
                  {stats.period_revenue > 0 && (
                    <span className="text-xs text-muted">
                      {t('forecasting.periodRevenue')}: <span className="text-foreground font-medium">{formatCurrency(stats.period_revenue)}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* How it works */}
      {!isLoading && stats && (
        <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-500/10 shrink-0">
              <Icon name="help" size="md" className="text-primary-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium mb-1">{t('forecasting.howItWorks')}</h3>
              <p className="text-xs text-muted leading-relaxed">
                {t('forecasting.howItWorksDescPeriod', { period: `${stats.period_days} ${t('forecasting.days')}` })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
    </NoInstancesGuard>
  )
}
