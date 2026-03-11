import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import type { WhmcsInstanceFull } from '../hooks/use-instances'

interface DeleteInstanceModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  instance: WhmcsInstanceFull | null
  isLoading?: boolean
}

export function DeleteInstanceModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  instance, 
  isLoading 
}: DeleteInstanceModalProps) {
  const { t } = useTranslation()

  if (!isOpen || !instance) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-surface-elevated border border-border rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {t('instances.deleteInstance')}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <Icon name="close" size="md" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center">
              <Icon name="warning" size="lg" className="text-danger" />
            </div>
            <div>
              <p className="text-foreground">
                {t('instances.deleteConfirm', { name: instance.name })}
              </p>
              <p className="mt-2 text-sm text-muted">
                {t('instances.deleteWarning')}
              </p>
            </div>
          </div>

          {/* Instance info */}
          <div className="mt-4 p-3 bg-surface rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: instance.color }}
              />
              <span className="font-medium text-foreground">{instance.name}</span>
            </div>
            <p className="text-sm text-muted mt-1 truncate">{instance.whmcs_url}</p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Icon name="sync" size="md" className="animate-spin mr-2" />
                  {t('common.deleting')}
                </>
              ) : (
                <>
                  <Icon name="delete" size="md" className="mr-2" />
                  {t('common.delete')}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
