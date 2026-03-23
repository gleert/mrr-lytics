import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Icon } from '@/shared/components/ui/icon'
import { Button } from '@/shared/components/ui/button'
import { KPICard } from '../components/kpi-card'
import { RecentActivity } from '../components/recent-activity'
import { DailyCommittedMRRChart } from '../components/daily-committed-mrr-chart'
import { RevenueBreakdownBar } from '../components/revenue-breakdown-bar'
import { MRRTrendChart } from '../components/mrr-trend-chart'
import { MRRMovementChart } from '../components/mrr-movement-chart'
import { TopProductsTable } from '../components/top-products-table'
import { PendingCancellationsTable } from '../components/pending-cancellations-table'
import { DashboardFilters } from '../components/dashboard-filters'
import { ForecastCTA } from '../components/forecast-cta'
import { UncategorizedProductsBanner } from '../components/uncategorized-products-banner'
import { SyncErrorBanner } from '../components/sync-error-banner'
import { QuickInsights } from '../components/quick-insights'
import { HealthScore } from '../components/health-score'
import { QuickLinks } from '../components/quick-links'
import { useMetrics, usePendingCancellations } from '../hooks/use-metrics'
import { useSyncStatus } from '@/features/sync/hooks/use-sync'
import { useAuth, useFilters } from '@/app/providers'
import { useToast } from '@/shared/components/ui/toast'
import { NoInstancesGuard } from '@/shared/components/no-instances-guard'
import type { TFunction } from 'i18next'

function formatRelativeTime(timestamp: number, t: TFunction): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return t('dashboard.justNow')
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t('dashboard.minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  return t('dashboard.hoursAgo', { count: hours })
}

export function DashboardPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { getCurrentTenant } = useFilters()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: metrics, isLoading: metricsLoading, isFetching: metricsFetching, dataUpdatedAt } = useMetrics()
  const { data: syncStatus, isLoading: syncLoading } = useSyncStatus()
  const { data: cancellationsData, isLoading: cancellationsLoading } = usePendingCancellations(10)

  const isRefreshing = metricsFetching && !metricsLoading

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['metrics'] })
    queryClient.invalidateQueries({ queryKey: ['sync'] })
    queryClient.invalidateQueries({ queryKey: ['revenue'] })
    queryClient.invalidateQueries({ queryKey: ['cancellations'] })
    toast.info(t('dashboard.refreshing'))
  }

  const hasPendingCancellations = !cancellationsLoading && cancellationsData && cancellationsData.count > 0

  // Stale data warning (>30 min)
  const isDataStale = dataUpdatedAt > 0 && (Date.now() - dataUpdatedAt) > 30 * 60 * 1000

  // Get user's first name for greeting
  const userName = user?.user_metadata?.full_name?.split(' ')[0] ||
                   user?.user_metadata?.name?.split(' ')[0] ||
                   user?.email?.split('@')[0] ||
                   ''

  // Get company name if defined
  const currentTenant = getCurrentTenant()
  const companyName = currentTenant?.company_name || null

  // Get current hour to determine greeting
  const hour = new Date().getHours()
  const greetingKey = hour < 12 ? 'dashboard.goodMorning' :
                      hour < 18 ? 'dashboard.goodAfternoon' :
                      'dashboard.goodEvening'

  return (
    <NoInstancesGuard>
    <div className="space-y-6">
      {/* Page header with filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {t(greetingKey, { name: userName })}
          </h1>
          <p className="text-muted">
            {companyName
              ? t('dashboard.welcomeSubtitleCompany', { company: companyName })
              : t('dashboard.welcomeSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-muted hidden sm:inline">
              {t('dashboard.lastUpdated', { time: formatRelativeTime(dataUpdatedAt, t) })}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title={t('common.refresh')}
          >
            <Icon
              name="refresh"
              size="lg"
              className={isRefreshing ? 'animate-spin' : ''}
            />
          </Button>
          <DashboardFilters showPeriod={false} />
        </div>
      </div>

      {/* Stale data warning */}
      {isDataStale && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
          <Icon name="schedule" size="sm" className="text-amber-400 shrink-0" />
          <span className="text-sm text-amber-400">{t('dashboard.staleWarning')}</span>
          <button onClick={handleRefresh} className="text-sm font-medium text-amber-400 underline underline-offset-2 hover:text-amber-300 ml-auto shrink-0">
            {t('common.refresh')}
          </button>
        </div>
      )}

      {/* Sync error warning */}
      <SyncErrorBanner />

      {/* Uncategorized products warning */}
      <UncategorizedProductsBanner />

      {/* Quick Links */}
      <QuickLinks />

      {/* Main KPI Cards — Row 1: Core metrics */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KPICard
          title={t('dashboard.mrr')}
          value={metrics?.mrr.mrr ?? 0}
          changePercent={metrics?.mrr.mrr_change}
          format="currency"
          loading={metricsLoading}
          icon={<Icon name="paid" size="2xl" />}
          accentColor="primary"
        />
        <KPICard
          title={t('dashboard.arr')}
          value={metrics?.mrr.arr ?? 0}
          changePercent={metrics?.mrr.arr_change}
          format="currency"
          loading={metricsLoading}
          icon={<Icon name="trending_up" size="2xl" />}
          accentColor="success"
        />
        <KPICard
          title={t('dashboard.activeClients')}
          value={metrics?.clients.active ?? 0}
          changePercent={metrics?.clients.active_change}
          loading={metricsLoading}
          icon={<Icon name="group" size="2xl" />}
          accentColor="info"
        />
        <KPICard
          title={t('dashboard.churnRate')}
          value={metrics?.churn.churn_rate ?? 0}
          changePercent={metrics?.churn.churn_rate_change}
          format="percent"
          loading={metricsLoading}
          icon={<Icon name="trending_down" size="2xl" />}
          accentColor={(metrics?.churn.churn_rate ?? 0) > 5 ? 'error' : 'warning'}
        />
      </div>

      {/* KPI Cards — Row 2: Services, Domains, Invoices */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KPICard
          title={t('dashboard.activeServices')}
          value={metrics?.mrr.active_services ?? 0}
          loading={metricsLoading}
          icon={<Icon name="dns" size="2xl" />}
          accentColor="primary"
        />
        <KPICard
          title={t('dashboard.domains')}
          value={metrics?.domains?.total ?? 0}
          loading={metricsLoading}
          icon={<Icon name="language" size="2xl" />}
          accentColor="info"
        />
        <KPICard
          title={t('dashboard.unpaidInvoices')}
          value={metrics?.invoices.unpaid_count ?? 0}
          loading={metricsLoading}
          icon={<Icon name="receipt_long" size="2xl" />}
          accentColor={(metrics?.invoices.unpaid_count ?? 0) > 0 ? 'warning' : 'success'}
        />
        <KPICard
          title={t('dashboard.overdueInvoices')}
          value={metrics?.invoices.overdue_count ?? 0}
          loading={metricsLoading}
          icon={<Icon name="warning" size="2xl" />}
          accentColor={(metrics?.invoices.overdue_count ?? 0) > 0 ? 'error' : 'success'}
        />
      </div>

      {/* Health Score + Quick Insights */}
      {!metricsLoading && metrics && (
        <div className="grid gap-4 lg:grid-cols-2">
          <HealthScore metrics={metrics} />
          <QuickInsights metrics={metrics} />
        </div>
      )}

      {/* Forecast CTA */}
      <ForecastCTA />

      {/* Revenue Analytics Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{t('dashboard.revenueAnalyticsTitle')}</h2>
          <p className="text-muted">{t('dashboard.revenueAnalyticsDesc')}</p>
        </div>

        {/* Revenue Breakdown */}
        <RevenueBreakdownBar />

        {/* MRR Trend + Daily Committed MRR side by side */}
        <div className="grid gap-4 lg:grid-cols-2">
          <MRRTrendChart />
          <DailyCommittedMRRChart />
        </div>

        {/* MRR Movement */}
        <MRRMovementChart />
      </div>

      {/* Top Products Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{t('dashboard.topProductsSection.title')}</h2>
          <p className="text-muted">{t('dashboard.topProductsSection.desc')}</p>
        </div>

        <TopProductsTable />
      </div>

      {/* Cancellations Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{t('dashboard.cancellationsSection.title')}</h2>
          <p className="text-muted">{t('dashboard.cancellationsSection.desc')}</p>
        </div>

        {hasPendingCancellations ? (
          <PendingCancellationsTable />
        ) : (
          <div className="rounded-xl overflow-hidden p-8 bg-emerald-600">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-white/20">
                <Icon name="check_circle" size="2xl" className="text-white" />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-2xl font-bold text-white">{t('dashboard.cancellationsSection.noPending')}</p>
                <p className="text-white/70">{t('dashboard.cancellationsSection.noPendingDesc')}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Syncs Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{t('dashboard.recentSyncsSection.title')}</h2>
          <p className="text-muted">{t('dashboard.recentSyncsSection.desc')}</p>
        </div>

        <RecentActivity
          syncLogs={syncStatus?.history ?? []}
          loading={syncLoading}
        />
      </div>
    </div>
    </NoInstancesGuard>
  )
}
