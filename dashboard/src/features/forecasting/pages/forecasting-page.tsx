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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KPICard
            title={t('forecasting.currentMrr')}
            value={stats?.current_mrr ?? 0}
            format="currency"
            loading={isLoading}
            icon={<Icon name="payments" size="2xl" />}
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
            title={t('forecasting.projectedGrowth')}
            value={stats?.projected_growth ?? 0}
            format="percent"
            loading={isLoading}
            icon={<Icon name="show_chart" size="2xl" />}
            accentColor={(stats?.projected_growth ?? 0) >= 0 ? 'success' : 'error'}
          />
        </div>
      </div>

      {/* Annual Projections Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{t('forecasting.annualProjectionsTitle')}</h2>
          <p className="text-muted">{t('forecasting.annualProjectionsDesc')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>
      </div>

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
                <div className="flex items-center justify-center h-64">
                  <Icon name="sync" size="xl" className="animate-spin text-muted" />
                </div>
              ) : !stats?.revenue_trend?.length ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted">
                  <Icon name="bar_chart" size="xl" className="mb-2 opacity-50" />
                  <p>{t('forecasting.noData')}</p>
                </div>
              ) : (
                <div style={{ height: 280 }}>
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
                          // Format date based on bucket type
                          if (stats.bucket_type === 'monthly') {
                            const [year, month] = value.split('-')
                            return `${month}/${year.slice(2)}`
                          } else if (stats.bucket_type === 'weekly') {
                            const d = new Date(value)
                            return `${d.getDate()}/${d.getMonth() + 1}`
                          }
                          const d = new Date(value)
                          return `${d.getDate()}/${d.getMonth() + 1}`
                        }}
                      />
                      <YAxis
                        tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: 'var(--color-border)' }}
                        tickFormatter={(value) => `${symbol}${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--color-background)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: 'var(--color-foreground)' }}
                        formatter={(value) => [
                          formatCurrency(Number(value) || 0),
                          t('forecasting.revenue')
                        ]}
                      />
                      <Legend />
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
                              ? 'var(--color-primary-400)' 
                              : '#10B981'
                            }
                            opacity={index === stats.revenue_trend.length - 1 ? 0.6 : 1}
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
                <div className="flex items-center justify-center h-64">
                  <Icon name="sync" size="xl" className="animate-spin text-muted" />
                </div>
              ) : !stats?.billing_cycle_breakdown?.length ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted">
                  <Icon name="bar_chart" size="xl" className="mb-2 opacity-50" />
                  <p>{t('forecasting.noData')}</p>
                </div>
              ) : (
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.billing_cycle_breakdown}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
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
                        contentStyle={{
                          backgroundColor: 'var(--color-background)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: 'var(--color-foreground)' }}
                        formatter={(value, name) => {
                          if (name === 'mrr') {
                            return [
                              formatCurrency(Number(value) || 0),
                              t('forecasting.mrrLabel')
                            ]
                          }
                          return [value, name]
                        }}
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
            {/* Services count summary */}
            {stats?.billing_cycle_breakdown && stats.billing_cycle_breakdown.length > 0 && (
              <div className="px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {stats.billing_cycle_breakdown.map((item, index) => (
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
                    </div>
                  ))}
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
          <div className="flex items-center justify-center h-48">
            <Icon name="sync" size="xl" className="animate-spin text-muted" />
          </div>
        ) : !stats?.scenarios ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted">
            <Icon name="analytics" size="xl" className="mb-2 opacity-50" />
            <p>{t('forecasting.noData')}</p>
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
            <div className="rounded-xl border border-border bg-surface p-6 space-y-8">
              {/* Three columns: name + MRR + growth */}
              <div className="grid grid-cols-3">
                {scenarios.map(({ key, label, data, dotColor, growthColor }) => (
                  <div key={key} className="flex flex-col items-center gap-1 text-center">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                      <p className="text-xs text-muted uppercase tracking-wide">{label}</p>
                    </div>
                    <p className="text-2xl font-semibold tabular-nums">
                      {formatCurrency(data.mrr, { maximumFractionDigits: 0 })}
                    </p>
                    <p className={`text-sm font-medium tabular-nums ${growthColor}`}>
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
    </div>
    </NoInstancesGuard>
  )
}
