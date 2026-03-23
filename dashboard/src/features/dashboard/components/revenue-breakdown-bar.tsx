import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@/shared/components/ui/icon'
import { useMRRBreakdown } from '../hooks/use-metrics'
import { cn } from '@/shared/lib/utils'
import { useCurrency } from '@/shared/hooks/use-currency'
import { BarSkeleton } from '@/shared/components/ui/chart-skeleton'

export function RevenueBreakdownBar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data, isLoading } = useMRRBreakdown()
  const { formatCurrency } = useCurrency()

  return (
    <div className="rounded-xl border border-border bg-surface">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Icon name="donut_large" size="lg" className="text-primary-400" />
        <div>
          <h2 className="text-lg font-medium">{t('dashboard.revenueBreakdownTitle')}</h2>
          <p className="text-sm text-muted">
            {data && !isLoading
              ? data.using_categories
                ? t('dashboard.revenueBreakdownDescCategories')
                : t('dashboard.revenueBreakdownDescGroups')
              : t('dashboard.revenueBreakdownDesc')
            }
          </p>
        </div>
        {/* Badge showing which mode is active */}
        {data && !isLoading && (
          <span className={cn(
            'ml-auto shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
            data.using_categories
              ? 'bg-success/10 text-success'
              : 'bg-warning/10 text-warning'
          )}>
            <Icon name={data.using_categories ? 'category' : 'folder'} size="sm" />
            {data.using_categories
              ? t('dashboard.revenueBreakdownBadgeCategories')
              : t('dashboard.revenueBreakdownBadgeGroups')
            }
          </span>
        )}
      </div>

      {/* Fallback warning */}
      {data && !isLoading && !data.using_categories && (
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-warning/5">
          <Icon name="info" size="sm" className="text-warning shrink-0" />
          <p className="text-xs text-muted flex-1">
            {t('dashboard.revenueBreakdownFallbackWarning', {
              pct: data.uncategorized_mrr_pct.toFixed(0),
            })}
          </p>
          <button
            onClick={() => navigate('/products')}
            className="shrink-0 text-xs font-semibold text-warning hover:underline"
          >
            {t('dashboard.revenueBreakdownFallbackCta')}
          </button>
        </div>
      )}

      <div className="p-4">
        {isLoading ? (
          <BarSkeleton />
        ) : !data?.breakdown?.length ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted">
            <Icon name="bar_chart" size="xl" className="mb-2 opacity-50" />
            <p>{t('dashboard.noData')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Total MRR */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">{t('dashboard.totalMrr')}</span>
              <span className="text-xl font-bold">{formatCurrency(data.total_mrr)}</span>
            </div>

            {/* Segmented bar */}
            <div className="relative h-10 rounded-lg overflow-hidden flex">
              {data.breakdown.map((group, index) => (
                <div
                  key={group.name}
                  className="relative h-full transition-all duration-300 hover:opacity-80 group cursor-pointer"
                  style={{
                    width: `${group.percentage}%`,
                    backgroundColor: group.color,
                    minWidth: group.percentage > 0 ? '2px' : '0',
                  }}
                >
                  {/* Tooltip on hover */}
                  <div className={cn(
                    "absolute bottom-full mb-2 px-3 py-2 rounded-lg bg-surface-elevated border border-border shadow-lg",
                    "opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10",
                    "whitespace-nowrap",
                    index > data.breakdown.length / 2 ? "right-0" : "left-0"
                  )}>
                    <p className="font-medium text-sm">{group.name}</p>
                    <p className="text-xs text-muted">
                      {formatCurrency(group.mrr)} ({group.percentage.toFixed(1)}%)
                    </p>
                    <p className="text-xs text-muted">
                      {group.count} {t('dashboard.services')}
                    </p>
                  </div>

                  {group.percentage >= 8 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-medium text-white drop-shadow-sm">
                        {group.percentage.toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 pt-2">
              {data.breakdown.map((group) => (
                <div key={group.name} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="text-sm">
                    <span className="font-medium">{group.name}</span>
                    <span className="text-muted ml-1">
                      {formatCurrency(group.mrr)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
