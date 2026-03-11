import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { PlanCard, UsageMeter, BillingIntervalToggle } from '../components'
import { 
  useSubscription, 
  useSubscriptionPlans, 
  useCreateCheckout,
  useCreatePortal,
  useChangePlan,
} from '../hooks/use-subscription'

export function BillingPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const [billingInterval, setBillingInterval] = React.useState<'month' | 'year'>('month')

  const { data: subscription, isLoading: subLoading } = useSubscription()
  
  // Dev mode is determined by backend (Stripe not configured)
  const devMode = subscription?.dev_mode ?? false
  const { data: plans, isLoading: plansLoading } = useSubscriptionPlans()
  const createCheckout = useCreateCheckout()
  const createPortal = useCreatePortal()
  const changePlan = useChangePlan()

  // Check for success/cancel from Stripe redirect
  const showSuccess = searchParams.get('success') === 'true'
  const showCanceled = searchParams.get('canceled') === 'true'

  const handleSelectPlan = async (planId: string) => {
    if (planId === 'free') {
      // Downgrade to free - use manual endpoint in dev mode
      if (devMode) {
        try {
          await changePlan.mutateAsync({ plan_id: 'free', simulate_trial: false })
        } catch (error) {
          console.error('Failed to change plan:', error)
        }
        return
      }
      // In production, open portal to cancel
      handleManageSubscription()
      return
    }

    // If we already know we're in dev mode, use manual endpoint directly
    if (devMode) {
      try {
        await changePlan.mutateAsync({ plan_id: planId, simulate_trial: true })
      } catch (error) {
        console.error('Failed to change plan:', error)
      }
      return
    }

    // Use Stripe checkout
    try {
      const result = await createCheckout.mutateAsync({
        plan_id: planId,
        billing_interval: billingInterval,
      })
      
      // Redirect to Stripe Checkout
      if (result.checkout_url) {
        window.location.href = result.checkout_url
      }
    } catch (error) {
      console.error('Failed to create checkout:', error)
    }
  }

  const handleManageSubscription = async () => {
    try {
      const result = await createPortal.mutateAsync()
      
      // Redirect to Stripe Portal
      if (result.portal_url) {
        window.location.href = result.portal_url
      }
    } catch (error) {
      console.error('Failed to create portal:', error)
    }
  }

  const isLoading = subLoading || plansLoading
  const isChangingPlan = createCheckout.isPending || changePlan.isPending

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Icon name="sync" size="xl" className="animate-spin text-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {t('billing.title', 'Billing & Subscription')}
        </h1>
        <p className="text-muted">
          {t('billing.subtitle', 'Manage your subscription and billing details')}
        </p>
      </div>

      {/* Success/Cancel alerts */}
      {showSuccess && (
        <div className="bg-success/10 border border-success/30 rounded-lg p-4 flex items-center gap-3">
          <Icon name="check_circle" size="lg" className="text-success" />
          <div>
            <p className="font-medium text-success">
              {t('billing.subscriptionSuccess', 'Subscription successful!')}
            </p>
            <p className="text-sm text-muted">
              {t('billing.subscriptionSuccessDesc', 'Your subscription has been activated. Thank you for your support!')}
            </p>
          </div>
        </div>
      )}

      {showCanceled && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-center gap-3">
          <Icon name="info" size="lg" className="text-warning" />
          <p className="text-foreground">
            {t('billing.checkoutCanceled', 'Checkout was canceled. You can try again when you\'re ready.')}
          </p>
        </div>
      )}

      {/* Current subscription */}
      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="credit_card" size="lg" />
              {t('billing.currentSubscription', 'Current Subscription')}
              {devMode && (
                <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-warning/10 text-warning rounded">
                  (Dev)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Plan info */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted">{t('billing.plan', 'Plan')}</p>
                  <p className="text-xl font-semibold text-foreground">{subscription.plan.name}</p>
                </div>

                <div>
                  <p className="text-sm text-muted">{t('billing.status', 'Status')}</p>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      subscription.subscription.status === 'active' ? 'bg-success/10 text-success' :
                      subscription.subscription.status === 'trialing' ? 'bg-primary-500/10 text-primary-500' :
                      subscription.subscription.status === 'past_due' ? 'bg-danger/10 text-danger' :
                      'bg-muted/10 text-muted'
                    }`}>
                      {subscription.subscription.status === 'trialing' 
                        ? t('billing.trial', 'Trial')
                        : subscription.subscription.status}
                    </span>
                    
                    {subscription.subscription.trial_days_remaining !== null && (
                      <span className="text-sm text-muted">
                        ({subscription.subscription.trial_days_remaining} {t('billing.daysRemaining', 'days remaining')})
                      </span>
                    )}
                  </div>
                </div>

                {subscription.subscription.current_period_end && (
                  <div>
                    <p className="text-sm text-muted">
                      {subscription.subscription.cancel_at_period_end 
                        ? t('billing.cancelsOn', 'Cancels on')
                        : t('billing.renewsOn', 'Renews on')}
                    </p>
                    <p className="text-foreground">
                      {new Date(subscription.subscription.current_period_end).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {subscription.subscription.has_payment_method && (
                  <Button 
                    variant="outline" 
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
              </div>

              {/* Usage */}
              <div className="space-y-4">
                <p className="text-sm font-medium text-foreground">
                  {t('billing.usage', 'Usage')}
                </p>
                
                <UsageMeter 
                  label={t('billing.whmcsInstances', 'WHMCS Instances')}
                  current={subscription.usage.instances}
                  limit={subscription.plan.limits.instances}
                />

                <UsageMeter 
                  label={t('billing.teamMembers', 'Team Members')}
                  current={subscription.usage.team_members}
                  limit={subscription.plan.limits.team_members}
                />

                <UsageMeter 
                  label={t('billing.webhooks', 'Webhooks')}
                  current={subscription.usage.webhooks}
                  limit={subscription.plan.limits.webhooks}
                />

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">{t('billing.dataHistory', 'Data History')}</span>
                  <span className="font-medium text-foreground">
                    {subscription.plan.limits.history_days === -1 
                      ? t('billing.unlimited', 'Unlimited')
                      : `${subscription.plan.limits.history_days} ${t('billing.days', 'days')}`}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{t('billing.availablePlans', 'Available Plans')}</CardTitle>
              <CardDescription>
                {t('billing.choosePlan', 'Choose the plan that works best for you')}
              </CardDescription>
            </div>
            <BillingIntervalToggle 
              value={billingInterval} 
              onChange={setBillingInterval} 
            />
          </div>
        </CardHeader>
        <CardContent>
          {devMode && (
            <div className="mb-4 bg-warning/10 border border-warning/30 rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
              <Icon name="code" size="sm" className="text-warning" />
              <span className="text-warning font-medium">(Dev)</span>
              <span className="text-muted">Development mode - changes are applied without payment</span>
            </div>
          )}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {plans?.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                currentPlanId={subscription?.plan.id || 'free'}
                billingInterval={billingInterval}
                onSelect={handleSelectPlan}
                isLoading={isChangingPlan}
                devMode={devMode}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
