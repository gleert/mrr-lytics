import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { cn } from '@/shared/lib/utils'
import type { WhmcsInstanceFull } from '../hooks/use-instances'

interface InstanceCardProps {
  instance: WhmcsInstanceFull
  onEdit: (instance: WhmcsInstanceFull) => void
  onDelete: (instance: WhmcsInstanceFull) => void
  onSync: (instance: WhmcsInstanceFull) => Promise<{ success: boolean; error?: string }>
  onImport: (instance: WhmcsInstanceFull) => void
}

export function InstanceCard({ instance, onEdit, onDelete, onSync, onImport }: InstanceCardProps) {
  const { t } = useTranslation()
  const [syncState, setSyncState] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [syncError, setSyncError] = React.useState<string | null>(null)

  const statusColors = {
    active: 'bg-success/20 text-success',
    inactive: 'bg-muted/20 text-muted',
    error: 'bg-danger/20 text-danger',
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t('sync.never')
    return new Date(dateStr).toLocaleString()
  }

  const handleSync = async () => {
    setSyncState('loading')
    setSyncError(null)
    
    try {
      const result = await onSync(instance)
      if (result.success) {
        setSyncState('success')
        // Reset to idle after 3 seconds
        setTimeout(() => setSyncState('idle'), 3000)
      } else {
        setSyncState('error')
        setSyncError(result.error || t('instances.syncFailed'))
        // Reset to idle after 5 seconds
        setTimeout(() => {
          setSyncState('idle')
          setSyncError(null)
        }, 5000)
      }
    } catch (err) {
      setSyncState('error')
      setSyncError(err instanceof Error ? err.message : t('instances.syncFailed'))
      setTimeout(() => {
        setSyncState('idle')
        setSyncError(null)
      }, 5000)
    }
  }

  const getSyncButtonStyle = () => {
    switch (syncState) {
      case 'loading':
        return 'border-primary-500/50 text-primary-500'
      case 'success':
        return 'border-success/50 text-success bg-success/10'
      case 'error':
        return 'border-danger/50 text-danger bg-danger/10'
      default:
        return ''
    }
  }

  const getSyncIcon = () => {
    switch (syncState) {
      case 'loading':
        return <Icon name="sync" size="lg" className="animate-spin" />
      case 'success':
        return <Icon name="check_circle" size="lg" />
      case 'error':
        return <Icon name="error" size="lg" />
      default:
        return <Icon name="sync" size="lg" />
    }
  }

  // Generate a subtle background from the instance color
  const bgColor = `${instance.color}15` // 15 = ~8% opacity in hex

  return (
    <Card 
      className="relative overflow-hidden"
      style={{ 
        backgroundColor: bgColor,
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <div 
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: instance.color }}
              />
              <h3 className="font-medium text-foreground truncate">
                {instance.name}
              </h3>
              <span className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium shrink-0',
                statusColors[instance.status]
              )}>
                {t(`instances.status.${instance.status}`)}
              </span>
            </div>

            {/* URL */}
            <p className="text-sm text-muted truncate mb-3">
              {instance.whmcs_url}
            </p>

            {/* Stats */}
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-muted">
                <Icon name="sync" size="sm" />
                <span>
                  {instance.sync_enabled 
                    ? t('instances.syncEvery', { hours: instance.sync_interval_hours })
                    : t('instances.syncDisabled')
                  }
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-muted">
                <Icon name="schedule" size="sm" />
                <span>
                  {t('instances.lastSync')}: {formatDate(instance.last_sync_at)}
                </span>
              </div>
            </div>

            {/* Sync error message */}
            {syncError && (
              <p className="mt-2 text-xs text-danger">
                {syncError}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Sync button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncState === 'loading'}
              title={t('instances.syncNow')}
              className={cn('h-9 w-9 p-0 transition-colors', getSyncButtonStyle())}
            >
              {getSyncIcon()}
            </Button>
            {/* Import button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onImport(instance)}
              title={t('instances.importData', 'Import Data')}
              className="h-9 w-9 rounded-lg bg-white/5 border border-border/50 text-muted hover:bg-surface-elevated hover:border-border hover:text-foreground transition-all"
            >
              <Icon name="upload_file" size="md" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(instance)}
              title={t('common.edit')}
              className="h-9 w-9 rounded-lg bg-white/5 border border-border/50 text-muted hover:bg-surface-elevated hover:border-border hover:text-foreground transition-all"
            >
              <Icon name="edit" size="md" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(instance)}
              title={t('common.delete')}
              className="h-9 w-9 rounded-lg bg-red-500/5 border border-red-500/20 text-red-400/70 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400 transition-all"
            >
              <Icon name="delete" size="md" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
