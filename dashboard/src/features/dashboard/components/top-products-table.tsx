import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Icon } from '@/shared/components/ui/icon'
import { useTopProducts } from '../hooks/use-metrics'
import { useCurrency } from '@/shared/hooks/use-currency'
import { TableSkeleton } from '@/shared/components/ui/chart-skeleton'

export function TopProductsTable() {
  const { t } = useTranslation()
  const { data, isLoading } = useTopProducts(5)
  const { formatCurrency, formatPercent } = useCurrency()

  return (
    <div className="rounded-xl border border-border bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Icon name="inventory_2" size="lg" className="text-primary-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-medium">{t('dashboard.topProducts.title')}</h2>
            <p className="text-xs sm:text-sm text-muted truncate">{t('dashboard.topProducts.desc')}</p>
          </div>
        </div>
        <Link
          to="/products"
          className="flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300 transition-colors shrink-0 ml-2"
        >
          <span className="hidden sm:inline">{t('dashboard.topProducts.viewAll')}</span>
          <Icon name="arrow_forward" size="sm" />
        </Link>
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4">
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : !data?.products?.length ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted gap-1">
            <Icon name="inventory_2" size="xl" className="mb-1 opacity-50" />
            <p className="font-medium">{t('dashboard.noData')}</p>
            <p className="text-xs">{t('dashboard.noDataProducts')}</p>
          </div>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="space-y-2 sm:hidden">
              {data.products.map((product, index) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-surface-hover transition-colors"
                >
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-500/10 text-primary-400 text-xs font-bold shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{product.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary-500"
                          style={{ width: `${Math.min(product.percentage, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted w-10 text-right">
                        {formatPercent(product.percentage)}
                      </span>
                    </div>
                  </div>
                  <span className="font-medium text-sm shrink-0">
                    {formatCurrency(product.mrr)}
                  </span>
                </div>
              ))}
            </div>

            {/* Desktop table layout */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-3 px-2 text-left text-sm font-medium text-muted">
                      {t('dashboard.topProducts.name')}
                    </th>
                    <th className="py-3 px-2 text-right text-sm font-medium text-muted">
                      {t('dashboard.topProducts.activeServices')}
                    </th>
                    <th className="py-3 px-2 text-right text-sm font-medium text-muted">
                      {t('dashboard.topProducts.mrr')}
                    </th>
                    <th className="py-3 px-2 text-right text-sm font-medium text-muted">
                      {t('dashboard.topProducts.percentage')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((product, index) => (
                    <tr
                      key={product.id}
                      className="border-b border-border/50 last:border-0 hover:bg-surface-hover transition-colors"
                    >
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-500/10 text-primary-400 text-xs font-bold">
                            {index + 1}
                          </span>
                          <span className="font-medium truncate max-w-[200px]">{product.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right text-muted">
                        {product.active_services}
                      </td>
                      <td className="py-3 px-2 text-right font-medium">
                        {formatCurrency(product.mrr)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary-500"
                              style={{ width: `${Math.min(product.percentage, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted w-12 text-right">
                            {formatPercent(product.percentage)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
