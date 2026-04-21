import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@/shared/components/ui/icon'
import { useCurrency } from '@/shared/hooks/use-currency'
import { useForecastingStats } from '@/features/forecasting/hooks/use-forecasting-stats'
import { useMetrics } from '../hooks/use-metrics'

export function ForecastCTA() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: stats, isLoading: forecastLoading } = useForecastingStats({ periodOverride: 'mtd' })
  const { data: metrics, isLoading: metricsLoading } = useMetrics()
  const { formatCurrency, formatNumber } = useCurrency()

  if (forecastLoading || metricsLoading || !stats) return null

  const projectedMrr = stats.projected_mrr
  const currentMrr = stats.current_mrr
  const growth = stats.projected_growth

  const isPositive = growth >= 0
  const forecastGradient = isPositive
    ? 'bg-gradient-to-br from-violet-600 to-violet-700'
    : 'bg-gradient-to-br from-rose-700 to-rose-800'
  const iconName = isPositive ? 'trending_up' : 'trending_down'

  const periodRevenue = metrics?.invoices?.revenue_last_30_days ?? 0
  const mrrChange = metrics?.mrr?.mrr_change ?? 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* — Forecasting CTA — */}
      <div className={`rounded-xl overflow-hidden p-8 ${forecastGradient} flex flex-col justify-between gap-6`}>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-white/70">
            <Icon name={iconName} size="lg" />
            <span className="text-sm font-medium uppercase tracking-wider">
              {t('forecasting.calloutGainLabel')}
            </span>
          </div>
          <p className="text-3xl font-black text-white leading-tight tabular-nums">
            {formatCurrency(projectedMrr, { maximumFractionDigits: 0 })}
            <span className="text-lg font-semibold text-white/70">{t('dashboard.forecastCta.perMonth')}</span>
          </p>
          <p className="text-white/70 text-sm">
            {isPositive
              ? t('dashboard.forecastCta.subUp', {
                  growth: formatNumber(growth, { maximumFractionDigits: 1 }),
                  current: formatCurrency(currentMrr, { maximumFractionDigits: 0 }),
                })
              : t('dashboard.forecastCta.subDown', {
                  growth: formatNumber(Math.abs(growth), { maximumFractionDigits: 1 }),
                  current: formatCurrency(currentMrr, { maximumFractionDigits: 0 }),
                })
            }
          </p>
        </div>
        <div>
          <p className="text-white/60 text-xs mb-3">{t('dashboard.forecastCta.desc')}</p>
          <button
            onClick={() => navigate('/forecasting')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-violet-700 font-semibold text-sm hover:bg-white/90 active:scale-95 transition-all shadow"
          >
            <Icon name="show_chart" size="sm" />
            {t('dashboard.forecastCta.button')}
            <Icon name="arrow_forward" size="sm" />
          </button>
        </div>
      </div>

      {/* — Revenue CTA — */}
      <div className="rounded-xl overflow-hidden p-8 bg-gradient-to-br from-emerald-600 to-emerald-700 flex flex-col justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-white/70">
            <Icon name="paid" size="lg" />
            <span className="text-sm font-medium uppercase tracking-wider">
              {t('dashboard.revenueCta.label')}
            </span>
          </div>
          <p className="text-3xl font-black text-white leading-tight">
            {formatCurrency(periodRevenue, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-white/70 text-sm">
            {mrrChange >= 0
              ? t('dashboard.revenueCta.subUp', { percent: formatNumber(mrrChange, { maximumFractionDigits: 1 }) })
              : t('dashboard.revenueCta.subDown', { percent: formatNumber(Math.abs(mrrChange), { maximumFractionDigits: 1 }) })
            }
          </p>
        </div>
        <div>
          <p className="text-white/60 text-xs mb-3">{t('dashboard.revenueCta.desc')}</p>
          <button
            onClick={() => navigate('/revenue')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-emerald-700 font-semibold text-sm hover:bg-white/90 active:scale-95 transition-all shadow"
          >
            <Icon name="bar_chart" size="sm" />
            {t('dashboard.revenueCta.button')}
            <Icon name="arrow_forward" size="sm" />
          </button>
        </div>
      </div>

    </div>
  )
}
