import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import type { Connector } from '../hooks/use-connectors'

interface DeleteWebhookModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  connector: Connector | null
  isLoading?: boolean
}

export function DeleteWebhookModal({
  isOpen,
  onClose,
  onConfirm,
  connector,
  isLoading = false,
}: DeleteWebhookModalProps) {
  const { t } = useTranslation()

  if (!isOpen || !connector) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-surface-elevated border border-border rounded-xl shadow-xl">
        <div className="p-6">
          {/* Warning Icon */}
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-danger/10">
              <Icon name="warning" size="xl" className="text-danger" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-center mb-2">
            {t('connectors.deleteWebhook')}
          </h2>

          {/* Description */}
          <p className="text-center text-muted mb-4">
            {t('connectors.deleteWebhookConfirm', { name: connector.name })}
          </p>

          {/* Webhook preview */}
          <div className="p-4 bg-surface rounded-lg mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-hover">
                <Icon name="webhook" className="text-muted" />
              </div>
              <div>
                <p className="font-medium">{connector.name}</p>
                <p className="text-sm text-muted font-mono">
                  {connector.config.url?.replace(/^https?:\/\//, '').slice(0, 30)}...
                </p>
              </div>
            </div>
          </div>

          {/* Warning */}
          <p className="text-sm text-muted text-center mb-6">
            {t('connectors.deleteWebhookWarning')}
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isLoading}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Icon name="sync" size="sm" className="animate-spin mr-2" />
                  {t('common.deleting')}
                </>
              ) : (
                t('common.delete')
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
