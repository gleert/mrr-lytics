import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@/shared/components/ui/icon'
import { useCurrency } from '@/shared/hooks/use-currency'
import { useRevenueStats } from '@/features/revenue/hooks/use-revenue-stats'
import { useMetrics } from '../hooks/use-metrics'

export function ForecastCTA() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: revenueStats, isLoading: revenueLoading } = useRevenueStats({ periodOverride: '30d' })
  const { data: metrics, isLoading: metricsLoading } = useMetrics()
  const { formatCurrency, formatNumber } = useCurrency()

  if (revenueLoading || metricsLoading || !revenueStats) return null

  const projection = revenueStats.projected_next_period
  const onetimeMonthly = revenueStats.onetime_revenue // last 30 days ≈ monthly
  const mrr = revenueStats.mrr
  const revenueChange = revenueStats.revenue_change

  const isPositive = revenueChange >= 0
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
              {t('revenue.highlights.projectionLabel')}
            </span>
          </div>
          <p className="text-3xl font-black text-white leading-tight tabular-nums">
            {formatCurrency(projection, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-white/70 text-sm">
            {t('revenue.highlights.projectionDesc')}
          </p>
          <div className="flex items-center gap-4 text-xs text-white/60 pt-1">
            <span className="flex items-center gap-1">
              <Icon name="autorenew" size="xs" />
              MRR: {formatCurrency(mrr, { maximumFractionDigits: 0 })}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="payments" size="xs" />
              {t('dashboard.forecastCta.onetime')}: {formatCurrency(onetimeMonthly, { maximumFractionDigits: 0 })}
            </span>
          </div>
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
