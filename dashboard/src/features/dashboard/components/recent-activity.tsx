import { useTranslation } from 'react-i18next'
import { RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { formatRelativeTime } from '@/shared/lib/utils'
import type { SyncLog } from '@/shared/types'

interface RecentActivityProps {
  syncLogs: SyncLog[]
  loading?: boolean
}

const statusConfig = {
  pending: { icon: Clock, variant: 'secondary' as const, labelKey: 'sync.pending' },
  running: { icon: RefreshCw, variant: 'warning' as const, labelKey: 'sync.running' },
  completed: { icon: CheckCircle2, variant: 'success' as const, labelKey: 'sync.completed' },
  failed: { icon: XCircle, variant: 'destructive' as const, labelKey: 'sync.failed' },
}

export function RecentActivity({ syncLogs, loading }: RecentActivityProps) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  const recordsCount = (log: SyncLog) => log.records_synced ?? log.records_processed ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium">{t('dashboard.recentSyncs.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {syncLogs.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">{t('dashboard.recentSyncs.noActivity')}</p>
        ) : (
          <div className="space-y-4">
            {syncLogs.slice(0, 5).map((log) => {
              const config = statusConfig[log.status]
              const Icon = config.icon
              const records = recordsCount(log)

              return (
                <div
                  key={log.id}
                  className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-hover"
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      log.status === 'running'
                        ? 'animate-spin bg-warning/10 text-warning'
                        : log.status === 'completed'
                        ? 'bg-success/10 text-success'
                        : log.status === 'failed'
                        ? 'bg-error/10 text-error'
                        : 'bg-surface-elevated text-muted'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {log.sync_type === 'manual' ? t('sync.manual') : t('sync.scheduled')} {t('dashboard.recentSyncs.sync')}
                      </p>
                      {log.instance_name && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-primary/10 text-primary">
                          {log.instance_name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted truncate">
                      {formatRelativeTime(log.started_at)}
                      {records > 0 && ` · ${records} ${t('dashboard.recentSyncs.records')}`}
                    </p>
                  </div>

                  <Badge variant={config.variant}>{t(config.labelKey)}</Badge>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
