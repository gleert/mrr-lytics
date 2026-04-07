import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
import { cn } from '@/shared/lib/utils'
import { useCurrency } from '@/shared/hooks/use-currency'
import type { BillableItem } from '../hooks/use-billable-items'
import type { Category } from '@/features/categories'

interface BillableItemRowProps {
  item: BillableItem
  categories: Category[]
  onCategoryChange: (categoryId: string | null) => void
  onCreateCategory?: () => void
  isUpdating?: boolean
  showCategoryColumn?: boolean
  inPeriod?: boolean
}

export function BillableItemRow({
  item,
  categories,
  onCategoryChange,
  onCreateCategory,
  isUpdating,
  showCategoryColumn = true,
  inPeriod = false,
}: BillableItemRowProps) {
  const { t } = useTranslation()
  const { formatCurrency } = useCurrency()
  const [isOpen, setIsOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (categoryId: string | null) => {
    onCategoryChange(categoryId)
    setIsOpen(false)
  }

  const cycleLabel = item.recurcycle
    ? item.recurcycle.charAt(0).toUpperCase() + item.recurcycle.slice(1)
    : '—'

  const statusConfig = {
    active:    { label: t('billableItems.status.active'),   className: 'bg-success/15 text-success' },
    completed: { label: t('billableItems.status.completed'), className: 'bg-muted/20 text-muted' },
    one_time:  { label: t('billableItems.status.oneTime'),  className: 'bg-warning/15 text-warning' },
  }
  const status = statusConfig[item.status] ?? statusConfig.one_time

  return (
    <tr className="border-b border-border hover:bg-surface-hover/50 transition-colors">
      {/* Instance */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: item.instance_color }}
            title={item.instance_name}
          />
          <span className="text-xs text-muted truncate max-w-[80px]" title={item.instance_name}>
            {item.instance_name}
          </span>
        </div>
      </td>

      {/* Description */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground truncate max-w-xs">
            {item.description || '—'}
          </span>
          {inPeriod && (
            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary-500/15 text-primary-400">
              {t('billableItems.inPeriod')}
            </span>
          )}
        </div>
      </td>

      {/* Client */}
      <td className="px-4 py-3 text-sm text-muted">
        {item.client_name || '—'}
      </td>

      {/* Amount */}
      <td className="px-4 py-3 text-right text-sm text-foreground font-medium tabular-nums">
        {formatCurrency(item.amount)}
      </td>

      {/* Cycle + Status */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          {item.recurcycle && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-elevated text-muted border border-border w-fit">
              {cycleLabel}
            </span>
          )}
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium w-fit', status.className)}>
            {status.label}
          </span>
        </div>
      </td>

      {/* MRR/month */}
      <td className="px-4 py-3 text-right text-sm text-foreground font-medium tabular-nums">
        {formatCurrency(item.monthly_mrr)}
      </td>

      {/* Category (admin only) */}
      {showCategoryColumn && (
        <td className="px-4 py-3">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsOpen(!isOpen)}
              disabled={isUpdating}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors text-sm min-w-[140px]',
                item.category
                  ? 'border-border bg-surface hover:bg-surface-hover'
                  : 'border-dashed border-border/50 text-muted hover:border-border hover:bg-surface',
                isUpdating && 'opacity-50 cursor-wait'
              )}
            >
              {isUpdating ? (
                <Icon name="sync" size="sm" className="animate-spin" />
              ) : item.category ? (
                <>
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: item.category.color }}
                  />
                  <span className="truncate">{item.category.name}</span>
                </>
              ) : (
                <>
                  <Icon name="add" size="sm" />
                  <span>{t('products.assignCategory')}</span>
                </>
              )}
              <Icon name="expand_more" size="sm" className="ml-auto shrink-0" />
            </button>

            {isOpen && (
              <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-surface-elevated border border-border rounded-lg shadow-xl py-1">
                {/* Remove category option */}
                {item.category && (
                  <>
                    <button
                      onClick={() => handleSelect(null)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger/10 transition-colors"
                    >
                      <Icon name="remove_circle" size="sm" />
                      <span>{t('products.removeCategory')}</span>
                    </button>
                    <div className="border-t border-border my-1" />
                  </>
                )}

                {/* Category list */}
                {categories.filter(c => c.is_active).map(category => {
                  const isCurrent = item.category?.id === category.id
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleSelect(category.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                        isCurrent
                          ? 'bg-primary-500/10 text-primary-500'
                          : 'text-foreground hover:bg-surface-hover'
                      )}
                    >
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="truncate">{category.name}</span>
                      {isCurrent && <Icon name="check" size="sm" className="ml-auto" />}
                    </button>
                  )
                })}

                {/* Create new category option */}
                {onCreateCategory && (
                  <>
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={() => {
                        setIsOpen(false)
                        onCreateCategory()
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary-400 hover:bg-primary-500/20 transition-colors"
                    >
                      <Icon name="add_circle" size="sm" />
                      <span>{t('products.createCategory')}</span>
                    </button>
                  </>
                )}

                {categories.filter(c => c.is_active).length === 0 && !onCreateCategory && (
                  <div className="px-3 py-4 text-sm text-muted text-center">
                    {t('products.noCategories')}
                  </div>
                )}
              </div>
            )}
          </div>
        </td>
      )}
    </tr>
  )
}
