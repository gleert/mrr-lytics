import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

/**
 * GET /api/subscription
 * 
 * Get current subscription status and usage for the tenant
 */
export async function GET() {
  try {
    const headersList = await headers()
    const auth = getAuthContext(headersList)

    if (!auth) {
      throw new UnauthorizedError('Authentication required')
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get subscription with plan details
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        plan_id,
        status,
        billing_interval,
        current_period_start,
        current_period_end,
        trial_start,
        trial_end,
        cancel_at_period_end,
        canceled_at,
        stripe_customer_id,
        stripe_subscription_id,
        subscription_plans (
          id,
          name,
          description,
          price_monthly,
          price_yearly,
          limits,
          features
        )
      `)
      .eq('tenant_id', auth.tenant_id)
      .single()

    if (subError) {
      throw new Error(`Failed to get subscription: ${subError.message}`)
    }

    // Get current usage
    const { data: usage } = await supabase.rpc('get_tenant_usage', {
      p_tenant_id: auth.tenant_id,
    })

    // Get webhook count
    const { count: webhooksCount } = await supabase
      .from('connectors')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', auth.tenant_id)
      .eq('type', 'webhook')

    // Calculate trial days remaining (for any trialing subscription, including free)
    let trialDaysRemaining: number | null = null
    let trialExpired = false
    if (subscription.trial_end) {
      const trialEnd = new Date(subscription.trial_end)
      const now = new Date()
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      trialDaysRemaining = Math.max(0, daysLeft)
      trialExpired = subscription.plan_id === 'free' && daysLeft <= 0
    }

    // Format response - subscription_plans is an object (not array) due to foreign key
    const planData = subscription.subscription_plans as unknown as {
      id: string
      name: string
      description: string
      price_monthly: number
      price_yearly: number
      limits: Record<string, number>
      features: string[]
    } | null

    if (!planData) {
      throw new Error('Subscription plan not found')
    }

    const plan = planData

    // Check if Stripe is configured
    const stripeConfigured = !!(
      process.env.STRIPE_SECRET_KEY?.startsWith('sk_') && 
      process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')
    )

    return success({
      dev_mode: !stripeConfigured,
      subscription: {
        id: subscription.id,
        status: trialExpired ? 'expired' : subscription.status,
        billing_interval: subscription.billing_interval,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        trial_end: subscription.trial_end,
        trial_days_remaining: trialDaysRemaining,
        trial_expired: trialExpired,
        cancel_at_period_end: subscription.cancel_at_period_end,
        has_payment_method: !!subscription.stripe_subscription_id,
      },
      plan: {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price_monthly: plan.price_monthly,
        price_yearly: plan.price_yearly,
        limits: plan.limits,
        features: plan.features,
      },
      usage: {
        instances: usage?.[0]?.instances_count ?? 0,
        team_members: usage?.[0]?.team_members_count ?? 0,
        webhooks: webhooksCount ?? 0,
        oldest_data: usage?.[0]?.oldest_snapshot_date ?? null,
      },
    })
  } catch (err) {
    console.error('Get subscription error:', err)
    return error(err instanceof Error ? err : new Error('Failed to get subscription'))
  }
}
