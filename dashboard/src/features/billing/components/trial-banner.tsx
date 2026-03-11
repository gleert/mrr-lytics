import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Icon } from '@/shared/components/ui/icon'
import { Button } from '@/shared/components/ui/button'
import { useSubscription } from '../hooks/use-subscription'

export function TrialBanner() {
  const { t } = useTranslation()
  const { data: subscription, isLoading } = useSubscription()

  // Don't show anything while loading
  if (isLoading) return null

  // Don't show if no subscription data
  if (!subscription) return null

  const { subscription: sub } = subscription

  // Only show for trialing status
  if (sub.status !== 'trialing') return null

  // Don't show if no trial days remaining info
  if (sub.trial_days_remaining === null) return null

  const daysRemaining = sub.trial_days_remaining
  const isUrgent = daysRemaining <= 3

  return (
    <div className={`
      flex items-center justify-between gap-4 px-4 py-2 text-sm
      ${isUrgent 
        ? 'bg-warning/10 border-b border-warning/20' 
        : 'bg-primary-500/10 border-b border-primary-500/20'
      }
    `}>
      <div className="flex items-center gap-2">
        <Icon 
          name={isUrgent ? 'schedule' : 'auto_awesome'} 
          size="md" 
          className={isUrgent ? 'text-warning' : 'text-primary-400'} 
        />
        <span className={isUrgent ? 'text-warning' : 'text-primary-400'}>
          {daysRemaining === 0 
            ? t('billing.trialEndsToday', 'Your trial ends today!')
            : daysRemaining === 1
              ? t('billing.trialEnds1Day', 'Your trial ends in 1 day')
              : t('billing.trialEndsDays', 'Your trial ends in {{days}} days', { days: daysRemaining })
          }
        </span>
      </div>

      <Link to="/settings/billing">
        <Button 
          size="sm" 
          variant={isUrgent ? 'default' : 'outline'}
          className={isUrgent ? '' : 'border-primary-500/50 text-primary-400 hover:bg-primary-500/10'}
        >
          {t('billing.upgadeNow', 'Upgrade Now')}
        </Button>
      </Link>
    </div>
  )
}
