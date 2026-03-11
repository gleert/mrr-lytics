import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { GmailLogo } from './connector-logos'
import type { EmailConnector } from '../hooks/use-connectors'

interface EmailCardProps {
  connector: EmailConnector
  onEdit: () => void
  onTest: () => void
  onDelete: () => void
  isTestLoading?: boolean
}

export function EmailCard({
  connector,
  onEdit,
  onTest,
  onDelete,
  isTestLoading = false,
}: EmailCardProps) {
  const { t } = useTranslation()

  const smtpInfo = `${connector.config.host}:${connector.config.port}`

  return (
    <Card className={`relative overflow-hidden ${!connector.enabled ? 'opacity-50' : ''}`}>
      <CardContent className="p-6">
        {/* Header: same layout as coming-soon cards */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-surface-hover">
              <GmailLogo className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-semibold">{connector.name}</h3>
              <p className="mt-1 text-sm text-muted">{smtpInfo}</p>
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
              size="sm"
              onClick={onTest}
              disabled={!connector.enabled || isTestLoading}
              className="h-8 w-8 p-0 text-muted hover:text-foreground"
              title={t('connectors.testEmail')}
            >
              {isTestLoading
                ? <Icon name="sync" size="sm" className="animate-spin" />
                : <Icon name="send" size="sm" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="h-8 w-8 p-0 text-muted hover:text-foreground"
              title={t('common.edit')}
            >
              <Icon name="edit" size="sm" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="h-8 w-8 p-0 text-danger hover:text-danger hover:bg-danger/10"
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
