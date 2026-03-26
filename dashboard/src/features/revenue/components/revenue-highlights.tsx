import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
import { useCurrency } from '@/shared/hooks/use-currency'
import { formatDate } from '@/shared/lib/utils'
import type { RevenueStats } from '../hooks/use-revenue-stats'

interface RevenueHighlightsProps {
  stats: RevenueStats
}

export function RevenueHighlights({ stats }: RevenueHighlightsProps) {
  const { t } = useTranslation()
  const { formatCurrency } = useCurrency()

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

      {/* Projection next period */}
      <div className="rounded-xl overflow-hidden p-5 sm:p-6 bg-gradient-to-br from-violet-600 to-violet-700 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-white/70">
          <Icon name="show_chart" size="md" />
          <span className="text-xs font-medium uppercase tracking-wider">
            {t('revenue.highlights.projectionLabel')}
          </span>
        </div>
        <div>
          <p className="text-2xl sm:text-3xl font-black text-white leading-tight tabular-nums">
            {formatCurrency(stats.projected_next_period, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-white/60 text-sm mt-1">
            {t('revenue.highlights.projectionDesc')}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-white/50 mt-auto">
          <span className="flex items-center gap-1">
            <Icon name="autorenew" size="xs" />
            MRR: {formatCurrency(stats.mrr, { maximumFractionDigits: 0 })}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="receipt" size="xs" />
            ARR: {formatCurrency(stats.arr, { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* Pending invoices */}
      <div className="rounded-xl overflow-hidden p-5 sm:p-6 bg-gradient-to-br from-amber-600 to-amber-700 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-white/70">
          <Icon name="pending" size="md" />
          <span className="text-xs font-medium uppercase tracking-wider">
            {t('revenue.highlights.pendingLabel')}
          </span>
        </div>
        <div>
          <p className="text-2xl sm:text-3xl font-black text-white leading-tight tabular-nums">
            {formatCurrency(stats.unpaid_total, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-white/60 text-sm mt-1">
            {t('revenue.highlights.pendingDesc', { count: stats.unpaid_count })}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-white/50 mt-auto">
          <span className="flex items-center gap-1">
            <Icon name="check_circle" size="xs" />
            {t('revenue.highlights.paidSummary', {
              amount: formatCurrency(stats.paid_total, { maximumFractionDigits: 0 }),
              count: stats.paid_count,
            })}
          </span>
        </div>
      </div>

      {/* Recent paid invoices */}
      <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-muted">
          <Icon name="receipt_long" size="md" />
          <span className="text-xs font-medium uppercase tracking-wider">
            {t('revenue.highlights.recentLabel')}
          </span>
        </div>
        {stats.recent_paid.length > 0 ? (
          <div className="space-y-2.5 flex-1">
            {stats.recent_paid.map((inv, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{inv.client_name}</p>
                  <p className="text-xs text-muted">
                    #{inv.invoice_num} · {formatDate(inv.date)}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-emerald-400 shrink-0">
                  {formatCurrency(inv.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted text-sm">
            {t('revenue.highlights.noRecent')}
          </div>
        )}
      </div>

    </div>
  )
}
