import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
import { useMRRMovement } from '../hooks/use-metrics'
import { cn } from '@/shared/lib/utils'
import { useCurrency } from '@/shared/hooks/use-currency'
import { TableSkeleton } from '@/shared/components/ui/chart-skeleton'

export function MRRMovementChart() {
  const { t } = useTranslation()
  const { data, isLoading } = useMRRMovement(6)
  const { formatCurrency, formatCurrencyWithSign } = useCurrency()

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
      isPositive ? "bg-primary-600" : "bg-red-600"
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

        {/* Right side - Movement pills (50%) */}
        <div className="lg:w-1/2 flex items-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full">
            {/* New MRR */}
            <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-full bg-white/90 text-primary-700 font-medium transition-all hover:scale-105 hover:shadow-lg">
              <div className="flex items-center gap-2">
                <Icon name="add_circle" size="sm" />
                <span className="text-xs sm:text-sm">{t('dashboard.mrrMovement.newMrr')}</span>
              </div>
              <span className="font-bold text-sm sm:text-base">+{formatAmount(latestMonth.new_mrr)}</span>
            </div>

            {/* Expansion */}
            <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-full bg-white/90 text-primary-700 font-medium transition-all hover:scale-105 hover:shadow-lg">
              <div className="flex items-center gap-2">
                <Icon name="trending_up" size="sm" />
                <span className="text-xs sm:text-sm">{t('dashboard.mrrMovement.expansion')}</span>
              </div>
              <span className="font-bold text-sm sm:text-base">+{formatAmount(latestMonth.expansion_mrr)}</span>
            </div>

            {/* Contraction */}
            <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-full bg-white/20 text-white font-medium transition-all hover:scale-105 hover:shadow-lg">
              <div className="flex items-center gap-2">
                <Icon name="trending_down" size="sm" />
                <span className="text-xs sm:text-sm">{t('dashboard.mrrMovement.contraction')}</span>
              </div>
              <span className="font-bold text-sm sm:text-base">-{formatAmount(latestMonth.contraction_mrr)}</span>
            </div>

            {/* Churned */}
            <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-full bg-white/20 text-white font-medium transition-all hover:scale-105 hover:shadow-lg">
              <div className="flex items-center gap-2">
                <Icon name="remove_circle" size="sm" />
                <span className="text-xs sm:text-sm">{t('dashboard.mrrMovement.churned')}</span>
              </div>
              <span className="font-bold text-sm sm:text-base">-{formatAmount(latestMonth.churned_mrr)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
