import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
import { useCurrency } from '@/shared/hooks/use-currency'
import type { AllMetrics } from '@/shared/types'

interface QuickInsightsProps {
  metrics: AllMetrics
}

interface Insight {
  icon: string
  text: string
  color: string
}

export function QuickInsights({ metrics }: QuickInsightsProps) {
  const { t } = useTranslation()
  const { formatCurrency, formatNumber } = useCurrency()

  const insights = useMemo(() => {
    const items: Insight[] = []

    // MRR trend
    if (metrics.mrr.mrr_change !== undefined) {
      if (metrics.mrr.mrr_change > 0) {
        items.push({
          icon: 'trending_up',
          text: t('dashboard.insights.mrrGrew', { pct: formatNumber(metrics.mrr.mrr_change, { maximumFractionDigits: 1 }) }),
          color: 'text-emerald-400',
        })
      } else if (metrics.mrr.mrr_change < 0) {
        items.push({
          icon: 'trending_down',
          text: t('dashboard.insights.mrrDeclined', { pct: formatNumber(Math.abs(metrics.mrr.mrr_change), { maximumFractionDigits: 1 }) }),
          color: 'text-red-400',
        })
      }
    }

    // Churn
    if (metrics.churn.churn_rate > 5) {
      items.push({
        icon: 'warning',
        text: t('dashboard.insights.highChurn', { rate: formatNumber(metrics.churn.churn_rate, { maximumFractionDigits: 1 }) }),
        color: 'text-amber-400',
      })
    } else if (metrics.churn.churn_rate <= 2 && metrics.churn.churn_rate >= 0) {
      items.push({
        icon: 'verified',
        text: t('dashboard.insights.lowChurn', { rate: formatNumber(metrics.churn.churn_rate, { maximumFractionDigits: 1 }) }),
        color: 'text-emerald-400',
      })
    }

    // Domains expiring
    if (metrics.domains && metrics.domains.expiring_30d > 0) {
      items.push({
        icon: 'schedule',
        text: t('dashboard.insights.domainsExpiring', { count: metrics.domains.expiring_30d }),
        color: 'text-amber-400',
      })
    }

    // Overdue invoices
    if (metrics.invoices.overdue_count && metrics.invoices.overdue_count > 0) {
      items.push({
        icon: 'receipt_long',
        text: t('dashboard.insights.overdueInvoices', {
          count: metrics.invoices.overdue_count,
          amount: formatCurrency(metrics.invoices.amount_overdue || 0, { maximumFractionDigits: 0 }),
        }),
        color: 'text-red-400',
      })
    }

    // Active clients growth
    if (metrics.clients.active_change !== undefined && metrics.clients.active_change > 5) {
      items.push({
        icon: 'group_add',
        text: t('dashboard.insights.clientsGrowing', { pct: formatNumber(metrics.clients.active_change, { maximumFractionDigits: 1 }) }),
        color: 'text-emerald-400',
      })
    }

    return items.slice(0, 4) // Max 4 insights
  }, [metrics, t, formatCurrency, formatNumber])

  if (insights.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="auto_awesome" size="md" className="text-primary-400" />
        <h3 className="text-sm font-medium">{t('dashboard.insights.title')}</h3>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <Icon name={insight.icon} size="sm" className={insight.color} />
            <span className="text-muted">{insight.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
