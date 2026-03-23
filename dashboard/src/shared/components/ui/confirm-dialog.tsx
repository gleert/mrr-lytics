import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './button'
import { Icon } from './icon'
import { cn } from '@/shared/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation()

  // Close on Escape
  React.useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md rounded-xl bg-surface border border-border shadow-2xl p-6 animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-start gap-4">
          <div className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            variant === 'danger' ? 'bg-error/10' : 'bg-warning/10'
          )}>
            <Icon
              name={variant === 'danger' ? 'delete' : 'warning'}
              size="lg"
              className={variant === 'danger' ? 'text-error' : 'text-warning'}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            {description && (
              <p className="mt-1 text-sm text-muted">{description}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {cancelLabel || t('common.cancel')}
          </Button>
          <Button
            variant={variant === 'danger' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? t('common.deleting') : confirmLabel || t('common.delete')}
          </Button>
        </div>
      </div>
    </div>
  )
}
