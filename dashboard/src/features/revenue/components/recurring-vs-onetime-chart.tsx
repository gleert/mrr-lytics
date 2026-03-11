import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
import { useCurrency } from '@/shared/hooks/use-currency'
import { useRevenueTrend } from '../hooks/use-revenue-stats'

export function RecurringVsOnetimeChart() {
  const { t } = useTranslation()
  const { formatCurrencyCompact } = useCurrency()
  const { data, isLoading } = useRevenueTrend()

  // Sum totals across the whole period
  const { recurring, onetime, total } = useMemo(() => {
    const trend = data?.trend ?? []
    const recurring = trend.reduce((s, p) => s + (p.recurring || 0), 0)
    const onetime   = trend.reduce((s, p) => s + (p.onetime  || 0), 0)
    return { recurring, onetime, total: recurring + onetime }
  }, [data?.trend])

  const recurringPct = total > 0 ? (recurring / total) * 100 : 0
  const onetimePct   = total > 0 ? (onetime  / total) * 100 : 0

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Icon name="stacked_line_chart" size="lg" className="text-primary-400" />
        <div>
          <h2 className="text-lg font-medium">{t('revenue.revenueComparisonTitle')}</h2>
          <p className="text-sm text-muted">{t('revenue.revenueComparisonDesc')}</p>
        </div>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-24">
            <Icon name="sync" size="xl" className="animate-spin text-muted" />
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-muted">
            <Icon name="stacked_line_chart" size="xl" className="mb-2 opacity-50" />
            <p>{t('revenue.noData')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Labels row */}
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-xs text-muted mb-0.5">{t('revenue.recurringRevenue')}</p>
                <p className="text-xl font-semibold text-foreground tabular-nums">
                  {formatCurrencyCompact(recurring)}
                </p>
                <p className="text-sm text-primary-400 font-medium">
                  {recurringPct.toFixed(1)}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted mb-0.5">{t('revenue.total')}</p>
                <p className="text-base font-medium text-foreground tabular-nums">
                  {formatCurrencyCompact(total)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted mb-0.5">{t('revenue.onetimeRevenue')}</p>
                <p className="text-xl font-semibold text-foreground tabular-nums">
                  {formatCurrencyCompact(onetime)}
                </p>
                <p className="text-sm font-medium text-emerald-400">
                  {onetimePct.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Horizontal bar */}
            <div className="flex h-5 w-full overflow-hidden rounded-full bg-surface-elevated">
              {recurringPct > 0 && (
                <div
                  className="h-full bg-primary-500 transition-all duration-500"
                  style={{ width: `${recurringPct}%` }}
                />
              )}
              {onetimePct > 0 && (
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${onetimePct}%` }}
                />
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary-500" />
                <span className="text-sm text-muted">{t('revenue.recurringRevenue')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-sm text-muted">{t('revenue.onetimeRevenue')}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
