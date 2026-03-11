import { useTranslation } from 'react-i18next'
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Spinner } from '@/shared/components/ui/spinner'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { formatRelativeTime, formatDate } from '@/shared/lib/utils'
import { useSyncStatus, useTriggerSync } from '../hooks/use-sync'
import type { SyncLog } from '@/shared/types'

const statusConfig = {
  pending: {
    icon: Clock,
    variant: 'secondary' as const,
    label: 'Pending',
    color: 'text-muted',
  },
  running: {
    icon: RefreshCw,
    variant: 'warning' as const,
    label: 'Running',
    color: 'text-warning',
  },
  completed: {
    icon: CheckCircle2,
    variant: 'success' as const,
    label: 'Completed',
    color: 'text-success',
  },
  failed: {
    icon: XCircle,
    variant: 'destructive' as const,
    label: 'Failed',
    color: 'text-error',
  },
}

function SyncLogRow({ log }: { log: SyncLog }) {
  const config = statusConfig[log.status]
  const Icon = config.icon
  const duration = log.completed_at
    ? Math.round(
        (new Date(log.completed_at).getTime() -
          new Date(log.started_at).getTime()) /
          1000
      )
    : null

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon
            className={`h-4 w-4 ${config.color} ${
              log.status === 'running' ? 'animate-spin' : ''
            }`}
          />
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        {log.sync_type === 'manual' ? 'Manual' : 'Scheduled'}
      </td>
      <td className="px-4 py-3 text-sm text-muted">
        {formatDate(log.started_at, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </td>
      <td className="px-4 py-3 text-sm text-muted">
        {duration !== null ? `${duration}s` : '-'}
      </td>
      <td className="px-4 py-3 text-sm">{log.records_processed}</td>
      <td className="px-4 py-3 text-sm text-error">
        {log.error_message && (
          <span className="truncate max-w-[200px] inline-block" title={log.error_message}>
            {log.error_message}
          </span>
        )}
      </td>
    </tr>
  )
}

export function SyncPage() {
  const { t } = useTranslation()
  const { data: syncStatus, isLoading } = useSyncStatus()
  const triggerSync = useTriggerSync()

  const handleTriggerSync = async () => {
    try {
      await triggerSync.mutateAsync()
    } catch (error) {
      console.error('Failed to trigger sync:', error)
    }
  }

  const lastSync = syncStatus?.history?.[0]
  const isSyncing = syncStatus?.is_syncing || triggerSync.isPending

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('sync.title')}</h1>
          <p className="text-muted">Manage data synchronization with WHMCS</p>
        </div>
        <Button
          onClick={handleTriggerSync}
          disabled={isSyncing}
          className="gap-2"
        >
          {isSyncing ? (
            <>
              <Spinner size="sm" />
              Syncing...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              {t('sync.triggerSync')}
            </>
          )}
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Current Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted">
              Current Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : isSyncing ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 animate-spin text-warning" />
                <span className="text-lg font-semibold text-warning">
                  Syncing...
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span className="text-lg font-semibold">Idle</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Last Sync */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted">
              {t('sync.lastSync')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : lastSync ? (
              <div>
                <p className="text-lg font-semibold">
                  {formatRelativeTime(lastSync.started_at)}
                </p>
                <p className="text-xs text-muted">
                  {lastSync.records_processed} records processed
                </p>
              </div>
            ) : (
              <p className="text-lg font-semibold text-muted">Never</p>
            )}
          </CardContent>
        </Card>

        {/* Sync Interval */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted">
              Sync Interval
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">Every 6 hours</p>
            <p className="text-xs text-muted">Automatic synchronization</p>
          </CardContent>
        </Card>
      </div>

      {/* Error Alert */}
      {lastSync?.status === 'failed' && lastSync.error_message && (
        <Card className="border-error/50 bg-error/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-error shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-error">Last sync failed</p>
              <p className="text-sm text-muted mt-1">{lastSync.error_message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync History */}
      <Card>
        <CardHeader>
          <CardTitle>{t('sync.history')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : syncStatus?.history && syncStatus.history.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-surface-elevated">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">
                      Started
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">
                      Records
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">
                      Error
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {syncStatus.history.map((log) => (
                    <SyncLogRow key={log.id} log={log} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-muted">
              No sync history available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
