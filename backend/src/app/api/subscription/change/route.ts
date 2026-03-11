import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError, BadRequestError, ForbiddenError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

const TRIAL_DAYS = 14

/**
 * POST /api/subscription/change
 * 
 * Change subscription plan manually (DEVELOPMENT MODE ONLY)
 * 
 * Body:
 * - plan_id: string (required) - The plan to switch to
 * - simulate_trial: boolean (optional, default: true) - Whether to simulate a trial period
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow in development mode
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenError('This endpoint is only available in development mode')
    }

    const headersList = await headers()
    const auth = getAuthContext(headersList)

    if (!auth) {
      throw new UnauthorizedError('Authentication required')
    }

    const body = await request.json()
    const { plan_id, simulate_trial = true } = body

    if (!plan_id) {
      throw new BadRequestError('plan_id is required')
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify plan exists and is active
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id, name, limits, features, price_monthly, price_yearly')
      .eq('id', plan_id)
      .eq('is_active', true)
      .single()

    if (planError || !plan) {
      throw new BadRequestError(`Plan not found: ${plan_id}`)
    }

    // Get current subscription
    const { data: currentSub, error: subError } = await supabase
      .from('subscriptions')
      .select('id, plan_id, status')
      .eq('tenant_id', auth.tenant_id)
      .single()

    if (subError || !currentSub) {
      throw new BadRequestError('No subscription found for tenant')
    }

    const oldPlanId = currentSub.plan_id
    const now = new Date()
    
    // Calculate trial/period dates
    const trialEnd = simulate_trial && plan_id !== 'free'
      ? new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
      : null
    
    const periodEnd = trialEnd || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    // Update subscription
    const updateData: Record<string, unknown> = {
      plan_id: plan_id,
      status: simulate_trial && plan_id !== 'free' ? 'trialing' : 'active',
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      trial_start: simulate_trial && plan_id !== 'free' ? now.toISOString() : null,
      trial_end: trialEnd?.toISOString() || null,
      cancel_at_period_end: false,
      canceled_at: null,
      // Clear Stripe fields for manual change
      billing_interval: null,
    }

    const { error: updateError } = await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('tenant_id', auth.tenant_id)

    if (updateError) {
      throw new Error(`Failed to update subscription: ${updateError.message}`)
    }

    // Log the event
    const eventType = oldPlanId === plan_id 
      ? 'renewed' 
      : plan_id === 'free' 
        ? 'downgraded' 
        : 'upgraded'

    await supabase.from('subscription_events').insert({
      tenant_id: auth.tenant_id,
      subscription_id: currentSub.id,
      event_type: eventType,
      from_plan_id: oldPlanId,
      to_plan_id: plan_id,
      metadata: {
        source: 'manual_dev',
        simulate_trial,
      },
    })

    // Get updated subscription with plan details
    const { data: updatedSub } = await supabase
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
        stripe_subscription_id
      `)
      .eq('tenant_id', auth.tenant_id)
      .single()

    // Calculate trial days remaining
    let trialDaysRemaining: number | null = null
    if (updatedSub?.status === 'trialing' && updatedSub.trial_end) {
      const trialEndDate = new Date(updatedSub.trial_end)
      trialDaysRemaining = Math.max(0, Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    }

    return success({
      subscription: {
        id: updatedSub?.id,
        status: updatedSub?.status,
        billing_interval: updatedSub?.billing_interval,
        current_period_start: updatedSub?.current_period_start,
        current_period_end: updatedSub?.current_period_end,
        trial_end: updatedSub?.trial_end,
        trial_days_remaining: trialDaysRemaining,
        cancel_at_period_end: updatedSub?.cancel_at_period_end,
        has_payment_method: !!updatedSub?.stripe_subscription_id,
      },
      plan: {
        id: plan.id,
        name: plan.name,
        limits: plan.limits,
        features: plan.features,
        price_monthly: plan.price_monthly,
        price_yearly: plan.price_yearly,
      },
      dev_mode: true,
      message: `Successfully changed to ${plan.name} plan${simulate_trial ? ' with 14-day trial' : ''}`,
    })
  } catch (err) {
    console.error('Change subscription error:', err)
    return error(err instanceof Error ? err : new Error('Failed to change subscription'))
  }
}
