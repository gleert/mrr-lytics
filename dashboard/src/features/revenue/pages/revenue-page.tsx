import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { NoInstancesGuard } from '@/shared/components/no-instances-guard'
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts'
import { Icon } from '@/shared/components/ui/icon'
import { KPICard } from '@/features/dashboard/components/kpi-card'
import { DashboardFilters } from '@/features/dashboard/components/dashboard-filters'
import { TopTransactionsBlock } from '../components/top-transactions-block'
import { RecurringVsOnetimeChart } from '../components/recurring-vs-onetime-chart'
import { RevenueTransactionsTable } from '../components/revenue-transactions-table'
import { useRevenueStats, useRevenueBreakdownTrend, type BreakdownGroupBy } from '../hooks/use-revenue-stats'
import { cn } from '@/shared/lib/utils'
import { useCurrency } from '@/shared/hooks/use-currency'

const ALL_BREAKDOWN_OPTIONS: { value: BreakdownGroupBy; labelKey: string; icon: string }[] = [
  { value: 'category', labelKey: 'revenue.byCategory', icon: 'category' },
  { value: 'source',   labelKey: 'revenue.bySource',   icon: 'source' },
  { value: 'type',     labelKey: 'revenue.byType',     icon: 'donut_large' },
]

export function RevenuePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { formatCurrencyCompact, symbol } = useCurrency()
  const { data: stats, isLoading } = useRevenueStats()

  // Default to 'source' — safe default that always has data.
  // 'category' is only added to the toggle when categories_available === true.
  const [selectedBreakdown, setSelectedBreakdown] = useState<BreakdownGroupBy>('source')
  const { data: trendData, isLoading: trendLoading } = useRevenueBreakdownTrend(selectedBreakdown)

  // categories_available is always returned by the backend regardless of group_by
  const categoriesAvailable = trendData?.categories_available ?? false

  // Only show the 'By Category' tab when categories cover ≥50% of revenue
  const breakdownOptions = useMemo(
    () => categoriesAvailable
      ? ALL_BREAKDOWN_OPTIONS
      : ALL_BREAKDOWN_OPTIONS.filter(o => o.value !== 'category'),
    [categoriesAvailable]
  )

  const groups = useMemo(() => trendData?.groups ?? [], [trendData?.groups])
  const chartData = trendData?.trend ?? []

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  }

  const formatDateFull = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: trendData?.aggregation === 'week' ? 'numeric' : undefined,
    })
  }

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean
    payload?: Array<{ dataKey: string; value: number; color: string }>
    label?: string
  }) => {
    if (!active || !payload?.length || !label) return null

    const total = payload.reduce((sum, p) => sum + (p.value || 0), 0)

    return (
      <div className="bg-surface-elevated border border-border rounded-lg px-4 py-3 shadow-lg min-w-[180px]">
        <p className="font-medium text-foreground mb-2 text-sm">
          {trendData?.aggregation === 'week'
            ? `${t('revenue.weekOf')} ${formatDateFull(label)}`
            : formatDateFull(label)}
        </p>
        <div className="space-y-1 text-sm">
          {payload.map(p => (
            <div key={p.dataKey} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-muted">{p.dataKey}</span>
              </span>
              <span className="font-medium text-foreground tabular-nums">
                {formatCurrencyCompact(p.value || 0)}
              </span>
            </div>
          ))}
          {payload.length > 1 && (
            <div className="flex items-center justify-between gap-4 pt-1 mt-1 border-t border-border">
              <span className="text-muted">{t('revenue.total')}</span>
              <span className="font-medium text-foreground tabular-nums">
                {formatCurrencyCompact(total)}
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  const CustomLegend = () => (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2">
      {groups.map(group => (
        <div key={group.name} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
          <span className="text-sm text-muted">{group.name}</span>
        </div>
      ))}
    </div>
  )

  return (
    <NoInstancesGuard>
    <div className="space-y-6">
      {/* Page header with filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('revenue.title')}</h1>
          <p className="text-muted">{t('revenue.subtitle')}</p>
        </div>
        <DashboardFilters />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard
          title={t('revenue.totalRevenue')}
          value={stats?.total_revenue ?? 0}
          format="currency"
          loading={isLoading}
          icon={<Icon name="payments" size="2xl" />}
          accentColor="primary"
          changePercent={stats?.revenue_change}
        />
        <KPICard
          title={t('revenue.recurringRevenue')}
          value={stats?.recurring_revenue ?? 0}
          format="currency"
          loading={isLoading}
          icon={<Icon name="autorenew" size="2xl" />}
          accentColor="success"
          changePercent={stats?.recurring_change}
        />
        <KPICard
          title={t('revenue.onetimeRevenue')}
          value={stats?.onetime_revenue ?? 0}
          format="currency"
          loading={isLoading}
          icon={<Icon name="receipt" size="2xl" />}
          accentColor="info"
          changePercent={stats?.onetime_change}
        />
        <KPICard
          title={t('revenue.recurringPercentage')}
          value={stats?.recurring_percentage ?? 0}
          format="percent"
          loading={isLoading}
          icon={<Icon name="pie_chart" size="2xl" />}
          accentColor="warning"
          changePercent={stats?.recurring_pct_change}
        />
        <KPICard
          title={t('revenue.invoicesCount')}
          value={stats?.invoices_count ?? 0}
          format="number"
          loading={isLoading}
          icon={<Icon name="receipt_long" size="2xl" />}
          accentColor="primary"
        />
      </div>

      {/* Section: Revenue Trends */}
      <div>
        <h2 className="text-base font-semibold text-foreground">{t('revenue.sectionTrendsTitle')}</h2>
        <p className="text-sm text-muted mt-0.5">{t('revenue.sectionTrendsDesc')}</p>
      </div>

      {/* Revenue Over Time — stacked area chart */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="flex flex-col gap-4 p-4 border-b border-border sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Icon name="show_chart" size="lg" className="text-primary-400" />
            <div>
              <h2 className="text-lg font-medium">{t('revenue.revenueOverTime')}</h2>
              <p className="text-sm text-muted">{t('revenue.revenueOverTimeDesc')}</p>
            </div>
          </div>

          {/* Breakdown selector — only shows 'Category' when categories are configured */}
          <div className="flex gap-1 p-1 bg-surface-elevated rounded-lg border border-border">
            {breakdownOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedBreakdown(option.value)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  selectedBreakdown === option.value
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

        {/* No-categories nudge — only when categories aren't set up yet */}
        {trendData && !categoriesAvailable && (
          <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm">
            <span className="text-muted">{t('revenue.noCategoriesHint')}</span>
            <button
              onClick={() => navigate('/products')}
              className="flex-shrink-0 text-xs font-medium text-primary-400 underline underline-offset-2 hover:text-primary-300"
            >
              {t('revenue.noCategoriesCta')}
            </button>
          </div>
        )}

        <div className="p-4">
          {trendLoading ? (
            <div className="flex items-center justify-center h-72">
              <Icon name="sync" size="xl" className="animate-spin text-muted" />
            </div>
          ) : chartData.length === 0 || groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-72 text-muted">
              <Icon name="show_chart" size="xl" className="mb-2 opacity-50" />
              <p>{t('revenue.noData')}</p>
            </div>
          ) : (
            <>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                >
                  <defs>
                    {groups.map(group => (
                      <linearGradient
                        key={group.name}
                        id={`rev-grad-${group.name.replace(/[^a-z0-9]/gi, '-')}`}
                        x1="0" y1="0" x2="0" y2="1"
                      >
                        <stop offset="5%"  stopColor={group.color} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={group.color} stopOpacity={0.2} />
                      </linearGradient>
                    ))}
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
                    tickFormatter={(v) => `${symbol}${(v / 1000).toFixed(0)}k`}
                    width={52}
                  />
                  <Tooltip content={<CustomTooltip />} />

                  {groups.map(group => (
                    <Area
                      key={group.name}
                      type="monotone"
                      dataKey={group.name}
                      stackId="1"
                      stroke={group.color}
                      fill={`url(#rev-grad-${group.name.replace(/[^a-z0-9]/gi, '-')})`}
                      strokeWidth={1.5}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <CustomLegend />
            </>
          )}
        </div>
      </div>

      {/* Section: Top Transactions */}
      <div>
        <h2 className="text-base font-semibold text-foreground">{t('revenue.sectionTopTitle')}</h2>
        <p className="text-sm text-muted mt-0.5">{t('revenue.sectionTopDesc')}</p>
      </div>

      <TopTransactionsBlock />

      {/* Section: Revenue Mix */}
      <div>
        <h2 className="text-base font-semibold text-foreground">{t('revenue.sectionMixTitle')}</h2>
        <p className="text-sm text-muted mt-0.5">{t('revenue.sectionMixDesc')}</p>
      </div>

      <RecurringVsOnetimeChart />

      {/* Section: All Transactions */}
      <div>
        <h2 className="text-base font-semibold text-foreground">{t('revenue.sectionAllTitle')}</h2>
        <p className="text-sm text-muted mt-0.5">{t('revenue.sectionAllDesc')}</p>
      </div>

      <RevenueTransactionsTable />
    </div>
    </NoInstancesGuard>
  )
}
