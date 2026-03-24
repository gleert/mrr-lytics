import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/ui/icon'
import { cn } from '@/shared/lib/utils'
import type { SubscriptionPlan } from '../hooks/use-subscription'

interface PlanCardProps {
  plan: SubscriptionPlan
  currentPlanId: string
  billingInterval: 'month' | 'year'
  onSelect: (planId: string) => void
  isLoading?: boolean
  devMode?: boolean
}

export function PlanCard({ 
  plan, 
  currentPlanId, 
  billingInterval, 
  onSelect,
  isLoading,
  devMode = false,
}: PlanCardProps) {
  const { t } = useTranslation()
  const isCurrent = plan.id === currentPlanId
  const isUpgrade = !isCurrent && !plan.is_free
  const isDowngrade = !isCurrent && plan.is_free && currentPlanId !== 'free'

  const price = billingInterval === 'year' 
    ? plan.price.yearly_monthly_equivalent 
    : plan.price.monthly_display

  const totalPrice = billingInterval === 'year'
    ? plan.price.yearly_display
    : plan.price.monthly_display

  return (
    <Card 
      className={cn(
        'relative p-6 transition-all',
        plan.is_popular && 'ring-2 ring-primary-500',
        isCurrent && 'bg-primary-500/5 border-primary-500'
      )}
    >
      {/* Popular badge */}
      {plan.is_popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-primary-500 text-white text-xs font-medium px-3 py-1 rounded-full">
            {t('billing.mostPopular', 'Most Popular')}
          </span>
        </div>
      )}

      {/* Current plan badge */}
      {isCurrent && (
        <div className="absolute -top-3 right-4">
          <span className="bg-success text-white text-xs font-medium px-3 py-1 rounded-full">
            {t('billing.currentPlan', 'Current Plan')}
          </span>
        </div>
      )}

      {/* Plan name */}
      <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>
      <p className="text-sm text-muted mt-1">{plan.description}</p>

      {/* Price */}
      <div className="mt-4">
        {plan.is_free ? (
          <div>
            <span className="text-4xl font-bold text-foreground">{t('billing.free', 'Free')}</span>
            <p className="text-sm text-primary-400 font-medium mt-1">
              {t('billing.trialDuration', '15-day trial')}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-foreground">{price}</span>
              <span className="text-muted">/mo</span>
            </div>
            {billingInterval === 'year' && (
              <p className="text-sm text-muted mt-1">
                {totalPrice}/year ({plan.price.yearly_savings_percent}% off)
              </p>
            )}
          </>
        )}
      </div>

      {/* Features */}
      <ul className="mt-6 space-y-3">
        {plan.features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <Icon name="check_circle" size="md" className="text-success flex-shrink-0 mt-0.5" />
            <span className="text-sm text-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      {/* Action button */}
      <div className="mt-6">
        {isCurrent ? (
          <Button variant="outline" className="w-full" disabled>
            {t('billing.currentPlan', 'Current Plan')}
          </Button>
        ) : plan.is_free ? (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => onSelect(plan.id)}
            disabled={isLoading}
          >
            {isDowngrade 
              ? t('billing.downgrade', 'Downgrade') 
              : t('billing.getStarted', 'Get Started')}
            {devMode && <span className="ml-1 text-warning">(Dev)</span>}
          </Button>
        ) : (
          <Button 
            variant={plan.is_popular ? 'default' : 'outline'}
            className="w-full"
            onClick={() => onSelect(plan.id)}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Icon name="sync" size="sm" className="mr-2 animate-spin" />
                {t('common.loading', 'Loading...')}
              </>
            ) : (
              <>
                {isUpgrade 
                  ? t('billing.upgrade', 'Upgrade') 
                  : t('billing.subscribe', 'Subscribe')}
                {devMode && <span className="ml-1 text-warning">(Dev)</span>}
              </>
            )}
          </Button>
        )}
      </div>
    </Card>
  )
}
