import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
import { useCurrency } from '@/shared/hooks/use-currency'
import type { ForecastingStats } from '../hooks/use-forecasting-stats'

interface ForecastCalloutProps {
  stats: ForecastingStats
}

export function ForecastCallout({ stats }: ForecastCalloutProps) {
  const { t } = useTranslation()
  const { formatCurrency } = useCurrency()

  const isPositive = stats.scenarios.baseline.growth >= 0
  const mainValue = isPositive
    ? stats.scenarios.optimistic.mrr
    : stats.scenarios.pessimistic.mrr
  const growthValue = isPositive
    ? stats.scenarios.optimistic.growth
    : stats.scenarios.pessimistic.growth

  if (isPositive) {
    return (
      <div className="rounded-xl overflow-hidden bg-gradient-to-br from-violet-600 to-violet-700 p-8">
        <div className="flex flex-col lg:flex-row gap-8 items-center">
          {/* Left — headline */}
          <div className="lg:w-1/2 space-y-3">
            <div className="flex items-center gap-2 text-white/70">
              <Icon name="trending_up" size="lg" />
              <span className="text-sm font-medium uppercase tracking-wider">
                {t('forecasting.calloutGainLabel')}
              </span>
            </div>
            <p className="text-4xl font-black text-white leading-tight">
              {t('forecasting.calloutGainHeadline', {
                amount: formatCurrency(mainValue, { maximumFractionDigits: 0 }),
              })}
            </p>
            <p className="text-white/70 text-sm">
              {t('forecasting.calloutGainSub', {
                growth: growthValue.toFixed(1),
                baseline: formatCurrency(stats.scenarios.baseline.mrr, { maximumFractionDigits: 0 }),
              })}
            </p>
          </div>

          {/* Right — three scenario mini-stats */}
          <div className="lg:w-1/2 grid grid-cols-3 gap-3 w-full">
            {[
              { label: t('forecasting.pessimistic'), mrr: stats.scenarios.pessimistic.mrr, growth: stats.scenarios.pessimistic.growth },
              { label: t('forecasting.baseline'),    mrr: stats.scenarios.baseline.mrr,    growth: stats.scenarios.baseline.growth },
              { label: t('forecasting.optimistic'),  mrr: stats.scenarios.optimistic.mrr,  growth: stats.scenarios.optimistic.growth },
            ].map(({ label, mrr, growth }) => (
              <div key={label} className="flex flex-col gap-1 px-4 py-3 rounded-xl bg-white/10 text-white text-center">
                <span className="text-xs text-white/60 uppercase tracking-wide">{label}</span>
                <span className="text-lg font-bold">
                  {formatCurrency(mrr, { maximumFractionDigits: 0 })}
                </span>
                <span className="text-xs text-white/70">
                  {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Negative / loss outlook
  return (
    <div className="rounded-xl overflow-hidden bg-gradient-to-br from-rose-700 to-rose-800 p-8">
      <div className="flex flex-col lg:flex-row gap-8 items-center">
        {/* Left — headline */}
        <div className="lg:w-1/2 space-y-3">
          <div className="flex items-center gap-2 text-white/70">
            <Icon name="trending_down" size="lg" />
            <span className="text-sm font-medium uppercase tracking-wider">
              {t('forecasting.calloutLossLabel')}
            </span>
          </div>
          <p className="text-4xl font-black text-white leading-tight">
            {t('forecasting.calloutLossHeadline', {
              amount: formatCurrency(mainValue, { maximumFractionDigits: 0 }),
            })}
          </p>
          <p className="text-white/70 text-sm">
            {t('forecasting.calloutLossSub', {
              growth: Math.abs(growthValue).toFixed(1),
              baseline: formatCurrency(stats.scenarios.baseline.mrr, { maximumFractionDigits: 0 }),
            })}
          </p>
        </div>

        {/* Right — three scenario mini-stats */}
        <div className="lg:w-1/2 grid grid-cols-3 gap-3 w-full">
          {[
            { label: t('forecasting.pessimistic'), mrr: stats.scenarios.pessimistic.mrr, growth: stats.scenarios.pessimistic.growth },
            { label: t('forecasting.baseline'),    mrr: stats.scenarios.baseline.mrr,    growth: stats.scenarios.baseline.growth },
            { label: t('forecasting.optimistic'),  mrr: stats.scenarios.optimistic.mrr,  growth: stats.scenarios.optimistic.growth },
          ].map(({ label, mrr, growth }) => (
            <div key={label} className="flex flex-col gap-1 px-4 py-3 rounded-xl bg-white/10 text-white text-center">
              <span className="text-xs text-white/60 uppercase tracking-wide">{label}</span>
              <span className="text-lg font-bold">
                {formatCurrency(mrr, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs text-white/70">
                {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
