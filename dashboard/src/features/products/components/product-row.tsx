import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
import { cn } from '@/shared/lib/utils'
import type { Product, ProductGroup, CategoryInfo } from '../hooks/use-products'
import type { ProductChurnData } from '../hooks/use-products-churn'
import type { Category } from '@/features/categories'

function getChurnColor(rate: number): string {
  if (rate < 5) return 'text-success'
  if (rate < 15) return 'text-warning'
  return 'text-danger'
}

interface ProductRowProps {
  item: Product | ProductGroup
  type: 'product' | 'product_group'
  categories: Category[]
  onCategoryChange: (categoryId: string | null) => void
  onUseGroupCategory?: () => void
  onCreateCategory?: () => void
  isUpdating?: boolean
  showTypeColumns?: boolean
  showCategoryColumn?: boolean
  churnData?: ProductChurnData | null
  churnLoading?: boolean
}

export function ProductRow({
  item,
  type,
  categories,
  onCategoryChange,
  onUseGroupCategory,
  onCreateCategory,
  isUpdating,
  showTypeColumns = true,
  showCategoryColumn = true,
  churnData,
  churnLoading,
}: ProductRowProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
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

  const handleUseGroupCategory = () => {
    if (onUseGroupCategory) {
      onUseGroupCategory()
      setIsOpen(false)
    }
  }

  const isProduct = type === 'product'
  const product = item as Product
  const productGroup = item as ProductGroup
  
  // Determine effective category for display
  // For products: check own category, then inherited
  // For groups: just their own category
  let effectiveCategory: CategoryInfo | null = null
  let isInherited = false
  let hasOwnCategory = false
  let groupHasCategory = false

  if (isProduct) {
    hasOwnCategory = !!product.category
    groupHasCategory = product.group_has_category
    isInherited = product.is_category_inherited
    effectiveCategory = product.category || product.inherited_category || null
  } else {
    effectiveCategory = productGroup.category
    hasOwnCategory = !!effectiveCategory
  }

  // For groups: show inheriting products count
  const inheritingCount = !isProduct ? productGroup.inheriting_products_count : 0
  
  return (
    <tr className="border-b border-border hover:bg-surface-hover/50 transition-colors">
      {/* Instance indicator */}
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

      {/* Name */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            {isProduct && (
              <Icon 
                name="inventory_2"
                size="sm" 
                className="text-muted shrink-0" 
              />
            )}
            <span className="font-medium text-foreground truncate">
              {item.name || t('products.unnamed')}
            </span>
            {isProduct && product.retired === 1 && (
              <span className="px-1.5 py-0.5 text-xs bg-muted/20 text-muted rounded">
                {t('products.retired')}
              </span>
            )}
          </div>
          {/* For groups with category: show inheriting products count */}
          {!isProduct && effectiveCategory && inheritingCount > 0 && (
            <span className="text-xs text-muted/70">
              {t('products.inheritingProducts', { count: inheritingCount })}
            </span>
          )}
        </div>
      </td>

      {/* Type (for products only) */}
      {showTypeColumns && (
        <>
          <td className="px-4 py-3 text-sm text-muted">
            {isProduct ? (product.type || '-') : t('products.group')}
          </td>

          {/* Pay Type (for products only) */}
          <td className="px-4 py-3 text-sm text-muted">
            {isProduct ? (product.paytype || '-') : '-'}
          </td>
        </>
      )}

      {/* Active services */}
      <td className="px-4 py-3 text-right">
        {churnLoading ? (
          <div className="h-4 w-8 bg-surface-hover animate-pulse rounded ml-auto" />
        ) : churnData ? (
          <span className="text-sm text-foreground font-medium tabular-nums">
            {churnData.active_services}
          </span>
        ) : (
          <span className="text-sm text-muted">—</span>
        )}
      </td>

      {/* Churn rate */}
      <td className="px-4 py-3 text-right">
        {churnLoading ? (
          <div className="h-4 w-10 bg-surface-hover animate-pulse rounded ml-auto" />
        ) : churnData ? (
          <span className={cn('text-sm font-medium tabular-nums', getChurnColor(churnData.churn_rate))}>
            {churnData.churn_rate.toFixed(1)}%
          </span>
        ) : (
          <span className="text-sm text-muted">—</span>
        )}
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
              effectiveCategory
                ? 'border-border bg-surface hover:bg-surface-hover'
                : 'border-dashed border-border/50 text-muted hover:border-border hover:bg-surface',
              isUpdating && 'opacity-50 cursor-wait'
            )}
          >
            {isUpdating ? (
              <Icon name="sync" size="sm" className="animate-spin" />
            ) : effectiveCategory ? (
              <>
                <div 
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: effectiveCategory.color }}
                />
                <span className="truncate">{effectiveCategory.name}</span>
                {isInherited && (
                  <span className="text-xs text-muted/60">({t('products.inherited')})</span>
                )}
              </>
            ) : (
              <>
                <Icon name="add" size="sm" />
                <span>{t('products.assignCategory')}</span>
              </>
            )}
            <Icon name="expand_more" size="sm" className="ml-auto shrink-0" />
          </button>

          {/* Dropdown */}
          {isOpen && (
            <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-surface-elevated border border-border rounded-lg shadow-xl py-1">
              {/* For products with own category: option to use group's category */}
              {isProduct && hasOwnCategory && groupHasCategory && onUseGroupCategory && (
                <>
                  <button
                    onClick={handleUseGroupCategory}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary-400 hover:bg-primary-500/20 transition-colors"
                  >
                    <Icon name="link" size="sm" />
                    <span>{t('products.useGroupCategory')}</span>
                  </button>
                  <div className="border-t border-border my-1" />
                </>
              )}

              {/* Remove category option */}
              {hasOwnCategory && (
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
                const isCurrentOwn = hasOwnCategory && item.category?.id === category.id
                const isCurrentInherited = isInherited && effectiveCategory?.id === category.id
                
                return (
                  <button
                    key={category.id}
                    onClick={() => handleSelect(category.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                      isCurrentOwn
                        ? 'bg-primary-500/10 text-primary-500'
                        : isCurrentInherited
                          ? 'bg-surface-hover text-muted'
                          : 'text-foreground hover:bg-surface-hover'
                    )}
                  >
                    <div 
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="truncate">{category.name}</span>
                    {isCurrentOwn && (
                      <Icon name="check" size="sm" className="ml-auto" />
                    )}
                    {isCurrentInherited && (
                      <span className="ml-auto text-xs text-muted/60">({t('products.inherited')})</span>
                    )}
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
