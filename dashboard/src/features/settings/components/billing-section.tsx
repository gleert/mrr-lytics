import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { Section } from '@/shared/components/ui/section'
import { UsageMeter } from '@/features/billing'
import { useSubscription, useCreatePortal } from '@/features/billing'

export function BillingSection() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: subscription, isLoading } = useSubscription()
  const createPortal = useCreatePortal()

  const handleManageSubscription = async () => {
    try {
      const result = await createPortal.mutateAsync()
      if (result.portal_url) {
        window.location.href = result.portal_url
      }
    } catch (error) {
      console.error('Failed to create portal:', error)
    }
  }

  const handleViewPlans = () => {
    navigate('/settings/billing')
  }

  if (isLoading) {
    return (
      <Section 
        title={t('billing.title', 'Billing & Subscription')} 
        description={t('billing.subtitle', 'Manage your subscription and billing details')}
      >
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <Icon name="sync" size="lg" className="animate-spin text-muted" />
            </div>
          </CardContent>
        </Card>
      </Section>
    )
  }

  if (!subscription) {
    return null
  }

  const { subscription: sub, plan, usage } = subscription

  return (
    <Section 
      title={t('billing.title', 'Billing & Subscription')} 
      description={t('billing.subtitle', 'Manage your subscription and billing details')}
    >
      <div className="flex justify-end mb-4">
        <Button variant="outline" size="sm" onClick={handleViewPlans}>
          {t('billing.viewPlans', 'View Plans')}
        </Button>
      </div>
      <Card>
        <CardContent className="py-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Plan info */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">{t('billing.currentPlan', 'Current Plan')}</p>
                <p className="text-xl font-semibold text-foreground">{plan.name}</p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                sub.status === 'active' ? 'bg-success/10 text-success' :
                sub.status === 'trialing' ? 'bg-primary-500/10 text-primary-500' :
                sub.status === 'past_due' ? 'bg-danger/10 text-danger' :
                'bg-muted/10 text-muted'
              }`}>
                {sub.status === 'trialing' 
                  ? `${t('billing.trial', 'Trial')} - ${sub.trial_days_remaining} ${t('billing.daysLeft', 'days left')}`
                  : sub.status}
              </span>
            </div>

            {sub.current_period_end && (
              <div>
                <p className="text-sm text-muted">
                  {sub.cancel_at_period_end 
                    ? t('billing.cancelsOn', 'Cancels on')
                    : t('billing.renewsOn', 'Renews on')}
                </p>
                <p className="text-foreground">
                  {new Date(sub.current_period_end).toLocaleDateString()}
                </p>
              </div>
            )}

            {sub.has_payment_method && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleManageSubscription}
                disabled={createPortal.isPending}
              >
                {createPortal.isPending ? (
                  <>
                    <Icon name="sync" size="sm" className="mr-2 animate-spin" />
                    {t('common.loading', 'Loading...')}
                  </>
                ) : (
                  <>
                    <Icon name="settings" size="sm" className="mr-2" />
                    {t('billing.manageSubscription', 'Manage Subscription')}
                  </>
                )}
              </Button>
            )}

            {!sub.has_payment_method && plan.id === 'free' && (
              <Button size="sm" onClick={handleViewPlans}>
                <Icon name="upgrade" size="sm" className="mr-2" />
                {t('billing.upgrade', 'Upgrade')}
              </Button>
            )}
          </div>

          {/* Usage */}
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">
              {t('billing.usage', 'Usage')}
            </p>
            
            <UsageMeter 
              label={t('billing.whmcsInstances', 'WHMCS Instances')}
              current={usage.instances}
              limit={plan.limits.instances}
            />

            <UsageMeter 
              label={t('billing.teamMembers', 'Team Members')}
              current={usage.team_members}
              limit={plan.limits.team_members}
            />

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">{t('billing.dataHistory', 'Data History')}</span>
              <span className="font-medium text-foreground">
                {plan.limits.history_days === -1 
                  ? t('billing.unlimited', 'Unlimited')
                  : `${plan.limits.history_days} ${t('billing.days', 'days')}`}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    </Section>
  )
}
