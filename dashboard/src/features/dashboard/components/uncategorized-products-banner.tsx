import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@/shared/components/ui/icon'
import { useProducts } from '@/features/products/hooks/use-products'
import { useFilters } from '@/app/providers'

export function UncategorizedProductsBanner() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { userRole } = useFilters()
  const { data, isLoading } = useProducts()

  // Only admins see this actionable banner
  if (userRole !== 'admin') return null
  if (isLoading || !data) return null

  const uncategorized = data.products.filter(
    p => !p.category && !p.inherited_category
  )

  if (uncategorized.length === 0) return null

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-warning/30 dark:bg-warning/5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {t('dashboard.uncategorizedBanner.title', { count: uncategorized.length })}
        </p>
        <p className="text-xs text-muted">
          {t('dashboard.uncategorizedBanner.desc')}
        </p>
      </div>
      <button
        onClick={() => navigate('/products')}
        className="sm:shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-200 text-amber-800 text-xs font-semibold hover:bg-amber-300 active:scale-95 transition-all dark:bg-warning/15 dark:text-warning dark:hover:bg-warning/25"
      >
        {t('dashboard.uncategorizedBanner.cta')}
        <Icon name="arrow_forward" size="sm" />
      </button>
    </div>
  )
}
