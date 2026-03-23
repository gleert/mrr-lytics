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
    let score = 50 // Base

    const factors: { label: string; impact: number; good: boolean }[] = []

    // MRR growth (+20 max)
    const mrrChange = metrics.mrr.mrr_change ?? 0
    if (mrrChange > 10) { score += 20; factors.push({ label: t('dashboard.health.mrrGrowth'), impact: 20, good: true }) }
    else if (mrrChange > 0) { score += 10; factors.push({ label: t('dashboard.health.mrrGrowth'), impact: 10, good: true }) }
    else if (mrrChange < -5) { score -= 15; factors.push({ label: t('dashboard.health.mrrDecline'), impact: -15, good: false }) }
    else if (mrrChange < 0) { score -= 5; factors.push({ label: t('dashboard.health.mrrDecline'), impact: -5, good: false }) }

    // Churn rate (+20 max)
    const churnRate = metrics.churn.churn_rate ?? 0
    if (churnRate <= 2) { score += 20; factors.push({ label: t('dashboard.health.lowChurn'), impact: 20, good: true }) }
    else if (churnRate <= 5) { score += 10; factors.push({ label: t('dashboard.health.moderateChurn'), impact: 10, good: true }) }
    else if (churnRate > 10) { score -= 20; factors.push({ label: t('dashboard.health.highChurn'), impact: -20, good: false }) }
    else { score -= 10; factors.push({ label: t('dashboard.health.elevatedChurn'), impact: -10, good: false }) }

    // Client growth (+10 max)
    const clientChange = metrics.clients.active_change ?? 0
    if (clientChange > 5) { score += 10; factors.push({ label: t('dashboard.health.clientGrowth'), impact: 10, good: true }) }
    else if (clientChange < -5) { score -= 10; factors.push({ label: t('dashboard.health.clientLoss'), impact: -10, good: false }) }

    // Overdue invoices (-10 max)
    const overdue = metrics.invoices.overdue_count ?? 0
    if (overdue > 10) { score -= 10; factors.push({ label: t('dashboard.health.manyOverdue'), impact: -10, good: false }) }
    else if (overdue === 0) { score += 5; factors.push({ label: t('dashboard.health.noOverdue'), impact: 5, good: true }) }

    score = Math.max(0, Math.min(100, score))

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
