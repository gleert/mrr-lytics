import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
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
import { useMetrics, usePendingCancellations } from '../hooks/use-metrics'
import { useSyncStatus } from '@/features/sync/hooks/use-sync'
import { useAuth } from '@/app/providers'
import { NoInstancesGuard } from '@/shared/components/no-instances-guard'

export function DashboardPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: metrics, isLoading: metricsLoading } = useMetrics()
  const { data: syncStatus, isLoading: syncLoading } = useSyncStatus()
  const { data: cancellationsData, isLoading: cancellationsLoading } = usePendingCancellations(10)

  const hasPendingCancellations = !cancellationsLoading && cancellationsData && cancellationsData.count > 0

  // Get user's first name for greeting
  const userName = user?.user_metadata?.full_name?.split(' ')[0] || 
                   user?.user_metadata?.name?.split(' ')[0] || 
                   user?.email?.split('@')[0] || 
                   ''

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
          <p className="text-muted">{t('dashboard.welcomeSubtitle')}</p>
        </div>
        <DashboardFilters showPeriod={false} />
      </div>

      {/* Uncategorized products warning */}
      <UncategorizedProductsBanner />

      {/* Main KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title={t('dashboard.mrr')}
          value={metrics?.mrr.mrr ?? 0}
          changePercent={metrics?.mrr.mrr_change}
          format="currency"
          loading={metricsLoading}
          icon={<Icon name="payments" size="2xl" />}
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
          accentColor="warning"
        />
      </div>

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
