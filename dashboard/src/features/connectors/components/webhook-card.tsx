import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { WebhookLogo } from './connector-logos'
import type { Connector } from '../hooks/use-connectors'

interface WebhookCardProps {
  connector: Connector
  onEdit: () => void
  onTest: () => void
  onDelete: () => void
  onViewEvents: () => void
  isTestLoading?: boolean
}

export function WebhookCard({
  connector,
  onEdit,
  onTest,
  onDelete,
  onViewEvents,
  isTestLoading = false,
}: WebhookCardProps) {
  const { t } = useTranslation()

  const displayUrl = connector.config.url
    ? connector.config.url.replace(/^https?:\/\//, '').slice(0, 40) +
      (connector.config.url.replace(/^https?:\/\//, '').length > 40 ? '…' : '')
    : t('connectors.noUrlConfigured')

  return (
    <Card className={`relative overflow-hidden ${!connector.enabled ? 'opacity-50' : ''}`}>
      <CardContent className="p-6">
        {/* Header: same layout as coming-soon cards */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-surface-hover">
              <WebhookLogo className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-semibold">{connector.name}</h3>
              <p className="mt-1 text-sm text-muted font-mono">{displayUrl}</p>
            </div>
          </div>
        </div>

        {/* Footer: badge + icon buttons */}
        <div className="mt-4 flex items-center justify-between">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            connector.enabled
              ? 'bg-primary-500/10 text-primary-400'
              : 'bg-muted/20 text-muted'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connector.enabled ? 'bg-primary-400' : 'bg-muted'}`} />
            {connector.enabled ? t('connectors.active') : t('connectors.disabled')}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onViewEvents}
              className="h-8 w-8 rounded-lg bg-white/5 border border-border/50 text-muted hover:bg-surface-elevated hover:border-border hover:text-foreground transition-all"
              title={t('connectors.viewEvents')}
            >
              <Icon name="history" size="sm" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onTest}
              disabled={!connector.enabled || isTestLoading}
              className="h-8 w-8 rounded-lg bg-white/5 border border-border/50 text-muted hover:bg-surface-elevated hover:border-border hover:text-foreground transition-all"
              title={t('connectors.test')}
            >
              {isTestLoading
                ? <Icon name="sync" size="sm" className="animate-spin" />
                : <Icon name="send" size="sm" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
              className="h-8 w-8 rounded-lg bg-white/5 border border-border/50 text-muted hover:bg-surface-elevated hover:border-border hover:text-foreground transition-all"
              title={t('common.edit')}
            >
              <Icon name="edit" size="sm" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-8 w-8 rounded-lg bg-red-500/5 border border-red-500/20 text-red-400/70 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400 transition-all"
              title={t('common.delete')}
            >
              <Icon name="delete" size="sm" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
