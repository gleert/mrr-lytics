import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'

type AlertType = 'info' | 'warning' | 'error' | 'success'

interface AlertItem {
  id: string
  type: AlertType
  titleKey: string
  descKey: string
  icon: string
}

const ALERT_CONFIG: Record<AlertType, { color: string; bgColor: string }> = {
  info:    { color: 'text-blue-400',    bgColor: 'bg-blue-500/10' },
  warning: { color: 'text-amber-400',   bgColor: 'bg-amber-500/10' },
  error:   { color: 'text-red-400',     bgColor: 'bg-red-500/10' },
  success: { color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
}

const AVAILABLE_ALERTS: AlertItem[] = [
  { id: 'sync_failed',     type: 'error',   titleKey: 'alerts.available.syncFailed',     descKey: 'alerts.available.syncFailedDesc',     icon: 'sync_problem' },
  { id: 'churn_spike',     type: 'warning', titleKey: 'alerts.available.churnSpike',     descKey: 'alerts.available.churnSpikeDesc',     icon: 'trending_down' },
  { id: 'mrr_milestone',   type: 'success', titleKey: 'alerts.available.mrrMilestone',   descKey: 'alerts.available.mrrMilestoneDesc',   icon: 'emoji_events' },
  { id: 'domain_expiring', type: 'warning', titleKey: 'alerts.available.domainExpiring', descKey: 'alerts.available.domainExpiringDesc', icon: 'schedule' },
  { id: 'new_clients',     type: 'info',    titleKey: 'alerts.available.newClients',     descKey: 'alerts.available.newClientsDesc',     icon: 'person_add' },
  { id: 'invoice_overdue', type: 'error',   titleKey: 'alerts.available.invoiceOverdue', descKey: 'alerts.available.invoiceOverdueDesc', icon: 'receipt_long' },
]

export function AlertsPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('alerts.title')}</h1>
        <p className="text-muted">{t('alerts.subtitle')}</p>
      </div>

      {/* Empty state */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="flex flex-col items-center justify-center py-12 sm:py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-500/10 mb-4">
            <Icon name="notifications" size="2xl" className="text-primary-400" />
          </div>
          <h3 className="text-lg font-medium">{t('alerts.noAlerts')}</h3>
          <p className="mt-2 max-w-md text-center text-sm text-muted px-4">
            {t('alerts.noAlertsDesc')}
          </p>
        </div>
      </div>

      {/* Available alert types */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{t('alerts.availableTitle')}</h2>
          <p className="text-muted">{t('alerts.availableDesc')}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AVAILABLE_ALERTS.map((alert) => {
            const config = ALERT_CONFIG[alert.type]
            return (
              <div
                key={alert.id}
                className="rounded-xl border border-border bg-surface p-4 hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${config.bgColor} shrink-0`}>
                    <Icon name={alert.icon} size="md" className={config.color} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium">{t(alert.titleKey)}</h3>
                    <p className="text-xs text-muted mt-1">{t(alert.descKey)}</p>
                    <span className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${config.bgColor} ${config.color}`}>
                      {t('alerts.comingSoon')}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
