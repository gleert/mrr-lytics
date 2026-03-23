import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'

type ChangeType = 'feature' | 'improvement' | 'fix' | 'security'

interface Change {
  type: ChangeType
  text: string
}

interface ChangelogEntry {
  version: string
  date: string
  changes: Change[]
}

const CHANGE_CONFIG: Record<ChangeType, { icon: string; color: string; bgColor: string }> = {
  feature:     { icon: 'add_circle',     color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
  improvement: { icon: 'trending_up',    color: 'text-blue-400',    bgColor: 'bg-blue-500/10' },
  fix:         { icon: 'bug_report',     color: 'text-amber-400',   bgColor: 'bg-amber-500/10' },
  security:    { icon: 'shield',         color: 'text-purple-400',  bgColor: 'bg-purple-500/10' },
}

// Changelog entries - newest first
const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.0.0',
    date: '2026-03-23',
    changes: [
      { type: 'feature', text: 'changelog.entries.v200.dashboardKpis' },
      { type: 'feature', text: 'changelog.entries.v200.healthScore' },
      { type: 'feature', text: 'changelog.entries.v200.quickInsights' },
      { type: 'feature', text: 'changelog.entries.v200.quickLinks' },
      { type: 'feature', text: 'changelog.entries.v200.rbac' },
      { type: 'improvement', text: 'changelog.entries.v200.actionButtons' },
      { type: 'improvement', text: 'changelog.entries.v200.staleWarning' },
      { type: 'fix', text: 'changelog.entries.v200.teamInvite' },
      { type: 'fix', text: 'changelog.entries.v200.teamDelete' },
      { type: 'fix', text: 'changelog.entries.v200.syncFeedback' },
    ],
  },
  {
    version: '1.9.0',
    date: '2026-03-23',
    changes: [
      { type: 'feature', text: 'changelog.entries.v190.topClientsMrrToggle' },
      { type: 'improvement', text: 'changelog.entries.v190.topClientsHeadline' },
    ],
  },
  {
    version: '1.8.0',
    date: '2026-03-23',
    changes: [
      { type: 'feature', text: 'changelog.entries.v180.productStats' },
      { type: 'feature', text: 'changelog.entries.v180.productTopMrr' },
      { type: 'feature', text: 'changelog.entries.v180.productMrrCategory' },
      { type: 'feature', text: 'changelog.entries.v180.productDistribution' },
    ],
  },
  {
    version: '1.7.0',
    date: '2026-03-23',
    changes: [
      { type: 'feature', text: 'changelog.entries.v170.clientRetention' },
      { type: 'feature', text: 'changelog.entries.v170.clientNetGrowth' },
      { type: 'feature', text: 'changelog.entries.v170.clientConcentration' },
      { type: 'feature', text: 'changelog.entries.v170.clientNetTrend' },
      { type: 'feature', text: 'changelog.entries.v170.topClientsMrrToggle' },
      { type: 'improvement', text: 'changelog.entries.v170.clientSkeletons' },
      { type: 'improvement', text: 'changelog.entries.v170.clientEmptyStates' },
    ],
  },
  {
    version: '1.6.0',
    date: '2026-03-23',
    changes: [
      { type: 'feature', text: 'changelog.entries.v160.revenueAvgInvoice' },
      { type: 'feature', text: 'changelog.entries.v160.revenueTopProduct' },
      { type: 'feature', text: 'changelog.entries.v160.revenueTrendChart' },
      { type: 'improvement', text: 'changelog.entries.v160.revenueSkeletons' },
      { type: 'improvement', text: 'changelog.entries.v160.revenueEmptyStates' },
      { type: 'improvement', text: 'changelog.entries.v160.revenueKpiGrid' },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-03-23',
    changes: [
      { type: 'feature', text: 'changelog.entries.v150.forecastMrrDelta' },
      { type: 'feature', text: 'changelog.entries.v150.forecastMilestone' },
      { type: 'feature', text: 'changelog.entries.v150.forecastArpu' },
      { type: 'feature', text: 'changelog.entries.v150.forecastAcceleration' },
      { type: 'feature', text: 'changelog.entries.v150.forecastHowItWorks' },
      { type: 'improvement', text: 'changelog.entries.v150.forecastBillingPct' },
      { type: 'improvement', text: 'changelog.entries.v150.forecastProjectedBar' },
      { type: 'improvement', text: 'changelog.entries.v150.forecastSkeletons' },
      { type: 'improvement', text: 'changelog.entries.v150.syncI18n' },
      { type: 'improvement', text: 'changelog.entries.v150.dateLocale' },
      { type: 'improvement', text: 'changelog.entries.v150.alertsRedesign' },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-03-23',
    changes: [
      { type: 'feature', text: 'changelog.entries.v140.changelog' },
      { type: 'improvement', text: 'changelog.entries.v140.codeSplitting' },
      { type: 'improvement', text: 'changelog.entries.v140.searchDebounce' },
      { type: 'improvement', text: 'changelog.entries.v140.scrollRestoration' },
      { type: 'improvement', text: 'changelog.entries.v140.mobilePageTitle' },
      { type: 'improvement', text: 'changelog.entries.v140.emptyStates' },
      { type: 'improvement', text: 'changelog.entries.v140.metricCaching' },
      { type: 'improvement', text: 'changelog.entries.v140.confirmDialog' },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-03-23',
    changes: [
      { type: 'improvement', text: 'changelog.entries.v130.responsiveKpis' },
      { type: 'improvement', text: 'changelog.entries.v130.responsiveForecast' },
      { type: 'improvement', text: 'changelog.entries.v130.responsiveSidebar' },
      { type: 'improvement', text: 'changelog.entries.v130.responsiveRevenue' },
      { type: 'improvement', text: 'changelog.entries.v130.responsiveMrrMovement' },
      { type: 'fix', text: 'changelog.entries.v130.sidebarZIndex' },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-03-22',
    changes: [
      { type: 'security', text: 'changelog.entries.v120.timingSafe' },
      { type: 'security', text: 'changelog.entries.v120.rateLimit' },
      { type: 'security', text: 'changelog.entries.v120.zodValidation' },
      { type: 'security', text: 'changelog.entries.v120.likeInjection' },
      { type: 'improvement', text: 'changelog.entries.v120.healthCheck' },
      { type: 'improvement', text: 'changelog.entries.v120.errorBoundary' },
      { type: 'improvement', text: 'changelog.entries.v120.skeletonLoading' },
      { type: 'feature', text: 'changelog.entries.v120.webhookCron' },
      { type: 'improvement', text: 'changelog.entries.v120.syncOptimization' },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-03-20',
    changes: [
      { type: 'feature', text: 'changelog.entries.v110.chartTooltip' },
      { type: 'feature', text: 'changelog.entries.v110.companyName' },
      { type: 'fix', text: 'changelog.entries.v110.syncErrors' },
      { type: 'fix', text: 'changelog.entries.v110.activeUsers' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-03-15',
    changes: [
      { type: 'feature', text: 'changelog.entries.v100.initial' },
      { type: 'feature', text: 'changelog.entries.v100.dashboard' },
      { type: 'feature', text: 'changelog.entries.v100.forecasting' },
      { type: 'feature', text: 'changelog.entries.v100.clients' },
      { type: 'feature', text: 'changelog.entries.v100.domains' },
      { type: 'feature', text: 'changelog.entries.v100.revenue' },
      { type: 'feature', text: 'changelog.entries.v100.multiInstance' },
      { type: 'feature', text: 'changelog.entries.v100.billing' },
    ],
  },
]

export function ChangelogSection() {
  const { t } = useTranslation()

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-3 mb-1">
          <Icon name="new_releases" size="lg" className="text-primary-400" />
          <div>
            <h2 className="text-lg font-medium">{t('changelog.title')}</h2>
            <p className="text-sm text-muted">{t('changelog.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[19px] top-6 bottom-6 w-px bg-border hidden sm:block" />

        <div className="space-y-6">
          {CHANGELOG.map((entry, entryIndex) => (
            <div key={entry.version} className="relative">
              {/* Version header */}
              <div className="flex items-center gap-3 mb-4">
                {/* Timeline dot */}
                <div className="relative z-10 hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-primary-500/20 border-2 border-primary-500 shrink-0">
                  <span className="text-xs font-bold text-primary-400">
                    {entry.version.split('.')[1]}
                  </span>
                </div>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h3 className="text-lg font-semibold">
                    v{entry.version}
                  </h3>
                  <span className="text-sm text-muted">
                    {formatDate(entry.date)}
                  </span>
                  {entryIndex === 0 && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary-500/20 text-primary-400">
                      {t('changelog.latest')}
                    </span>
                  )}
                </div>
              </div>

              {/* Changes list */}
              <div className="sm:ml-[52px] rounded-xl border border-border bg-surface overflow-hidden">
                {entry.changes.map((change, changeIndex) => {
                  const config = CHANGE_CONFIG[change.type]
                  return (
                    <div
                      key={changeIndex}
                      className="flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface-hover transition-colors"
                    >
                      <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${config.bgColor} shrink-0 mt-0.5`}>
                        <Icon name={config.icon} size="sm" className={config.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm">{t(change.text)}</span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bgColor} ${config.color} shrink-0`}>
                        {t(`changelog.types.${change.type}`)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
