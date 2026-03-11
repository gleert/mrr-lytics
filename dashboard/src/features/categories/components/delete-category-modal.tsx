import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import type { Category } from '../hooks/use-categories'

interface DeleteCategoryModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  category: Category | null
  isLoading?: boolean
}

export function DeleteCategoryModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  category, 
  isLoading 
}: DeleteCategoryModalProps) {
  const { t } = useTranslation()

  if (!isOpen || !category) return null

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
            {t('categories.deleteCategory')}
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
                {t('categories.deleteConfirm', { name: category.name })}
              </p>
              <p className="mt-2 text-sm text-muted">
                {t('categories.deleteWarning')}
              </p>
            </div>
          </div>

          {/* Category info */}
          <div className="mt-4 p-3 bg-surface rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div 
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              <div>
                <span className="font-medium text-foreground">{category.name}</span>
                {category.description && (
                  <p className="text-sm text-muted truncate">{category.description}</p>
                )}
              </div>
            </div>
            {category.mappings_count > 0 && (
              <p className="text-sm text-warning mt-2 flex items-center gap-1.5">
                <Icon name="warning" size="sm" />
                {t('categories.hasMappings', { count: category.mappings_count })}
              </p>
            )}
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
