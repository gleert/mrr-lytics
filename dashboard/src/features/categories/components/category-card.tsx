import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { cn } from '@/shared/lib/utils'
import type { Category } from '../hooks/use-categories'

interface CategoryCardProps {
  category: Category
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
}

export function CategoryCard({ category, onEdit, onDelete }: CategoryCardProps) {
  const { t } = useTranslation()

  // Generate a subtle background from the category color
  const bgColor = `${category.color}15` // 15 = ~8% opacity in hex

  return (
    <Card 
      className="relative overflow-hidden border-l-4"
      style={{ 
        borderLeftColor: category.color,
        backgroundColor: bgColor,
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
              <div 
                className="h-4 w-4 rounded-full shrink-0"
                style={{ backgroundColor: category.color }}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-foreground truncate">
                    {category.name}
                  </h3>
                  {!category.is_active && (
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium shrink-0',
                      'bg-muted/20 text-muted'
                    )}>
                      {t('categories.inactive')}
                    </span>
                  )}
                </div>
                {category.description && (
                  <p className="text-sm text-muted truncate">
                    {category.description}
                  </p>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-4 text-sm mt-3">
              <div className="flex items-center gap-1.5 text-muted">
                <Icon name="link" size="sm" />
                <span>
                  {t('categories.mappingsCount', { count: category.mappings_count })}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-muted">
                <Icon name="sort" size="sm" />
                <span>
                  {t('categories.sortOrder')}: {category.sort_order}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(category)}
              title={t('common.edit')}
              className="h-9 w-9 rounded-lg bg-white/5 border border-border/50 text-muted hover:bg-surface-elevated hover:border-border hover:text-foreground transition-all"
            >
              <Icon name="edit" size="md" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(category)}
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
