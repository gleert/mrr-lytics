import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { cn } from '@/shared/lib/utils'
import type { Category, CreateCategoryData, UpdateCategoryData } from '../hooks/use-categories'

interface CategoryFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateCategoryData | UpdateCategoryData) => void
  category?: Category | null
  isLoading?: boolean
}

const PRESET_COLORS = [
  '#7C3AED', // Purple (primary)
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#8B5CF6', // Violet
]

export function CategoryFormModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  category, 
  isLoading 
}: CategoryFormModalProps) {
  const { t } = useTranslation()
  const isEdit = !!category

  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [color, setColor] = React.useState(PRESET_COLORS[0])
  const [sortOrder, setSortOrder] = React.useState(0)
  const [isActive, setIsActive] = React.useState(true)

  // Reset form when modal opens/closes or category changes
  React.useEffect(() => {
    if (isOpen && category) {
      setName(category.name)
      setDescription(category.description || '')
      setColor(category.color || PRESET_COLORS[0])
      setSortOrder(category.sort_order)
      setIsActive(category.is_active)
    } else if (isOpen && !category) {
      setName('')
      setDescription('')
      setColor(PRESET_COLORS[0])
      setSortOrder(0)
      setIsActive(true)
    }
  }, [isOpen, category])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const data: CreateCategoryData | UpdateCategoryData = {
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      sort_order: sortOrder,
      is_active: isActive,
    }

    onSubmit(data)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-surface-elevated border border-border rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? t('categories.editCategory') : t('categories.addCategory')}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium leading-tight text-foreground">
              {t('categories.name')} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('categories.namePlaceholder')}
              required
              className="w-full h-10 px-3.5 py-2 bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium leading-tight text-foreground">
              {t('categories.description')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('categories.descriptionPlaceholder')}
              rows={2}
              className="w-full px-3.5 py-2 bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 resize-none"
            />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium leading-tight text-foreground">
              {t('categories.color')}
            </label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  onClick={() => setColor(presetColor)}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-all',
                    color === presetColor 
                      ? 'border-foreground scale-110' 
                      : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: presetColor }}
                />
              ))}
              {/* Custom color picker */}
              <div className="relative">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 w-8 h-8 opacity-0 cursor-pointer"
                />
                <div 
                  className="w-8 h-8 rounded-full border-2 border-dashed border-border flex items-center justify-center"
                  style={{ backgroundColor: !PRESET_COLORS.includes(color) ? color : undefined }}
                >
                  {PRESET_COLORS.includes(color) && (
                    <Icon name="palette" size="sm" className="text-muted" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sort Order & Active Toggle */}
          <div className="flex gap-6">
            {/* Sort Order */}
            <div className="space-y-1.5 flex-1">
              <label className="block text-sm font-medium leading-tight text-foreground">
                {t('categories.sortOrder')}
              </label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                min={0}
                className="w-full h-10 px-3.5 py-2 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
              />
            </div>

            {/* Active Toggle */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium leading-tight text-foreground">
                {t('categories.status')}
              </label>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={cn(
                  'flex items-center gap-2 h-10 px-3 rounded-lg border transition-colors',
                  isActive 
                    ? 'border-success/30 bg-success/10 text-success' 
                    : 'border-border bg-surface text-muted'
                )}
              >
                <Icon name={isActive ? 'check_circle' : 'cancel'} size="md" />
                <span className="text-sm font-medium">
                  {isActive ? t('categories.active') : t('categories.inactive')}
                </span>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !name.trim()}
            >
              {isLoading ? (
                <>
                  <Icon name="sync" size="md" className="animate-spin mr-2" />
                  {t('common.saving')}
                </>
              ) : (
                isEdit ? t('common.save') : t('categories.addCategory')
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
