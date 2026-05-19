import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
import { useMRRMovement } from '../hooks/use-metrics'
import { cn } from '@/shared/lib/utils'
import { useCurrency } from '@/shared/hooks/use-currency'
import { TableSkeleton } from '@/shared/components/ui/chart-skeleton'
import { MRRMovementItemsModal } from './mrr-movement-items-modal'

export function MRRMovementChart() {
  const { t } = useTranslation()
  const { data, isLoading } = useMRRMovement(6)
  const { formatCurrency, formatCurrencyWithSign } = useCurrency()
  const [drilldown, setDrilldown] = React.useState<'new' | 'churned' | null>(null)

  const latestMonth = data?.movement_data?.[data.movement_data.length - 1]

  const formatAmount = (value: number) => {
    return formatCurrency(Math.abs(value), { maximumFractionDigits: 0 })
  }

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }

  const isPositive = latestMonth ? latestMonth.net_change >= 0 : true
  const currentMonthLabel = latestMonth ? formatMonth(latestMonth.month) : ''

  if (isLoading) {
    return (
      <div className="rounded-xl overflow-hidden bg-surface border border-border">
        <TableSkeleton rows={4} />
      </div>
    )
  }

  if (!latestMonth) {
    return null
  }

  return (
    <div className={cn(
      "rounded-xl overflow-hidden p-5 sm:p-8",
      isPositive ? "bg-primary-600" : "bg-slate-700"
    )}>
      <div className="flex flex-col lg:flex-row gap-5 sm:gap-8">
        {/* Left side - Main info (50%) */}
        <div className="lg:w-1/2 flex flex-col justify-center">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl sm:text-5xl font-black text-white">
                {formatCurrencyWithSign(latestMonth.net_change)}
              </span>
            </div>
            <p className="text-lg sm:text-2xl font-light text-white">
              {isPositive
                ? t('dashboard.mrrMovement.growthMessage')
                : t('dashboard.mrrMovement.declineMessage')
              }
            </p>
            <p className="text-white/60 text-sm sm:text-base">{currentMonthLabel}</p>
          </div>
        </div>

        {/* Right side - Movement pills (50%).
            Expansion/contraction are hidden when 0 — they're hardcoded to 0
            for now because we don't snapshot per-service prices, so the
            empty pills would just confuse. When historical price tracking
            lands they'll appear automatically. */}
        <div className="lg:w-1/2 flex items-center">
          <div className="flex flex-wrap justify-end gap-2 sm:gap-3 w-full">
            {/* New MRR — hidden when 0 */}
            {latestMonth.new_mrr > 0 && (
              <button
                type="button"
                onClick={() => setDrilldown('new')}
                className="group flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-full bg-white/90 text-primary-700 font-medium transition-all hover:scale-105 hover:shadow-lg cursor-pointer text-left w-full sm:w-auto sm:min-w-[14rem]"
                title={t('dashboard.mrrMovementItems.openHint')}
              >
                <div className="flex items-center gap-2">
                  <Icon name="add_circle" size="sm" />
                  <span className="text-xs sm:text-sm">{t('dashboard.mrrMovement.newMrr')}</span>
                </div>
                <span className="flex items-center gap-1 font-bold text-sm sm:text-base">
                  +{formatAmount(latestMonth.new_mrr)}
                  <Icon name="chevron_right" size="sm" className="opacity-0 group-hover:opacity-70 transition-opacity" />
                </span>
              </button>
            )}

            {/* Churned — hidden when 0 */}
            {latestMonth.churned_mrr > 0 && (
              <button
                type="button"
                onClick={() => setDrilldown('churned')}
                className="group flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-full bg-white/20 text-white font-medium transition-all hover:scale-105 hover:shadow-lg cursor-pointer text-left w-full sm:w-auto sm:min-w-[14rem]"
                title={t('dashboard.mrrMovementItems.openHint')}
              >
                <div className="flex items-center gap-2">
                  <Icon name="remove_circle" size="sm" />
                  <span className="text-xs sm:text-sm">{t('dashboard.mrrMovement.churned')}</span>
                </div>
                <span className="flex items-center gap-1 font-bold text-sm sm:text-base">
                  -{formatAmount(latestMonth.churned_mrr)}
                  <Icon name="chevron_right" size="sm" className="opacity-0 group-hover:opacity-70 transition-opacity" />
                </span>
              </button>
            )}

            {/* Expansion — only shown when populated */}
            {latestMonth.expansion_mrr > 0 && (
              <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-full bg-white/90 text-primary-700 font-medium transition-all hover:scale-105 hover:shadow-lg w-full sm:w-auto sm:min-w-[14rem]">
                <div className="flex items-center gap-2">
                  <Icon name="trending_up" size="sm" />
                  <span className="text-xs sm:text-sm">{t('dashboard.mrrMovement.expansion')}</span>
                </div>
                <span className="font-bold text-sm sm:text-base">+{formatAmount(latestMonth.expansion_mrr)}</span>
              </div>
            )}

            {/* Contraction — only shown when populated */}
            {latestMonth.contraction_mrr > 0 && (
              <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-full bg-white/20 text-white font-medium transition-all hover:scale-105 hover:shadow-lg w-full sm:w-auto sm:min-w-[14rem]">
                <div className="flex items-center gap-2">
                  <Icon name="trending_down" size="sm" />
                  <span className="text-xs sm:text-sm">{t('dashboard.mrrMovement.contraction')}</span>
                </div>
                <span className="font-bold text-sm sm:text-base">-{formatAmount(latestMonth.contraction_mrr)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <MRRMovementItemsModal
        isOpen={drilldown !== null}
        onClose={() => setDrilldown(null)}
        type={drilldown}
        month={latestMonth.month}
      />
    </div>
  )
}
