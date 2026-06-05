import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
import type { AllMetrics } from '@/shared/types'

interface HealthScoreProps {
  metrics: AllMetrics
}

export function HealthScore({ metrics }: HealthScoreProps) {
  const { t } = useTranslation()

  const { score, label, color, bgColor, factors } = useMemo(() => {
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
    const factors: { label: string; impact: number; good: boolean }[] = []

    // Proportional "what remains" model: each factor moves the score in
    // proportion to how much was lost vs retained — no flat cliff buckets — so a
    // small dip costs little and a large loss costs more, but bounded. The worst
    // realistic case floors near ~22 instead of collapsing toward zero.
    let score = 100

    // MRR momentum — decline penalised in proportion (full weight at -25%),
    // growth rewarded (full at +25%).
    const mrrChange = metrics.mrr.mrr_change ?? 0
    const fMrr = mrrChange >= 0
      ? clamp(mrrChange / 25, 0, 1) * 10
      : -clamp(-mrrChange / 25, 0, 1) * 25
    score += fMrr
    factors.push({
      label: t(mrrChange >= 0 ? 'dashboard.health.mrrGrowth' : 'dashboard.health.mrrDecline'),
      impact: Math.round(fMrr), good: fMrr >= 0,
    })

    // Churn — penalty proportional to the rate (full weight at 30%); a small
    // bonus when retention is strong (≤2%).
    const churnRate = metrics.churn.churn_rate ?? 0
    const fChurn = churnRate <= 2 ? 5 : -clamp(churnRate / 30, 0, 1) * 22
    score += fChurn
    factors.push({
      label: t(
        churnRate <= 2 ? 'dashboard.health.lowChurn'
        : churnRate <= 5 ? 'dashboard.health.moderateChurn'
        : churnRate <= 10 ? 'dashboard.health.elevatedChurn'
        : 'dashboard.health.highChurn'
      ),
      impact: Math.round(fChurn), good: fChurn >= 0,
    })

    // Client base — loss penalised in proportion (full weight at -40%), growth
    // rewarded (full at +20%).
    const clientChange = metrics.clients.active_change ?? 0
    const fClients = clientChange >= 0
      ? clamp(clientChange / 20, 0, 1) * 8
      : -clamp(-clientChange / 40, 0, 1) * 16
    score += fClients
    factors.push({
      label: t(clientChange >= 0 ? 'dashboard.health.clientGrowth' : 'dashboard.health.clientLoss'),
      impact: Math.round(fClients), good: fClients >= 0,
    })

    // Overdue invoices — amount-aware: scaled by the overdue amount relative to
    // MRR (full weight at 2 months of MRR), not by invoice count.
    const overdueAmount = metrics.invoices.amount_overdue ?? 0
    const mrrValue = metrics.mrr.mrr || 0
    const overdueRatio = mrrValue > 0 ? overdueAmount / mrrValue : 0
    const fOverdue = overdueAmount <= 0 ? 3 : -clamp(overdueRatio / 2, 0, 1) * 15
    score += fOverdue
    factors.push({
      label: t(overdueAmount <= 0 ? 'dashboard.health.noOverdue' : 'dashboard.health.manyOverdue'),
      impact: Math.round(fOverdue), good: fOverdue >= 0,
    })

    score = Math.max(0, Math.min(100, Math.round(score)))

    const label = score >= 80 ? t('dashboard.health.excellent') :
                  score >= 60 ? t('dashboard.health.good') :
                  score >= 40 ? t('dashboard.health.fair') :
                  t('dashboard.health.needsAttention')

    const color = score >= 80 ? 'text-emerald-400' :
                  score >= 60 ? 'text-blue-400' :
                  score >= 40 ? 'text-amber-400' :
                  'text-red-400'

    const bgColor = score >= 80 ? 'bg-emerald-500' :
                    score >= 60 ? 'bg-blue-500' :
                    score >= 40 ? 'bg-amber-500' :
                    'bg-red-500'

    return { score, label, color, bgColor, factors }
  }, [metrics, t])

  return (
    <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-center gap-4">
        {/* Score circle */}
        <div className="relative flex items-center justify-center w-16 h-16 shrink-0">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="var(--color-border)" strokeWidth="4" />
            <circle
              cx="32" cy="32" r="28" fill="none"
              className={bgColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${(score / 100) * 176} 176`}
            />
          </svg>
          <span className={`absolute text-lg font-bold ${color}`}>{score}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">{t('dashboard.health.title')}</h3>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${bgColor}/10 ${color}`}>
              {label}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {factors.map((f, i) => (
              <span key={i} className="flex items-center gap-1 text-xs text-muted">
                <Icon
                  name={f.good ? 'add_circle' : 'remove_circle'}
                  size="xs"
                  className={f.good ? 'text-emerald-400' : 'text-red-400'}
                />
                {f.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
