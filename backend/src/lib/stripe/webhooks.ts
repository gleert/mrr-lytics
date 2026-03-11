import Stripe from 'stripe'
import { getStripe } from './client'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export interface WebhookResult {
  success: boolean
  message: string
  eventType?: string
}

/**
 * Handle incoming Stripe webhook events
 */
export async function handleStripeWebhook(
  payload: string,
  signature: string
): Promise<WebhookResult> {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
  }

  // Verify webhook signature
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new Error(`Webhook signature verification failed: ${message}`)
  }

  // Handle event based on type
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, event.id)
      break

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, event.id)
      break

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, event.id)
      break

    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event.data.object as Stripe.Invoice, event.id)
      break

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice, event.id)
      break

    case 'customer.subscription.trial_will_end':
      // Could send notification email here
      console.log('Trial will end soon:', event.data.object)
      break

    default:
      console.log(`Unhandled event type: ${event.type}`)
  }

  return {
    success: true,
    message: `Processed ${event.type}`,
    eventType: event.type,
  }
}

/**
 * Handle checkout.session.completed
 * This is when the customer completes the checkout flow
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session, eventId: string) {
  const tenantId = session.metadata?.tenant_id
  const planId = session.metadata?.plan_id

  if (!tenantId || !planId) {
    console.error('Missing tenant_id or plan_id in session metadata')
    return
  }

  // The subscription is handled by customer.subscription.created webhook
  // Here we just log the event
  await logSubscriptionEvent(tenantId, 'checkout_completed', null, planId, eventId, {
    session_id: session.id,
    customer_id: session.customer as string,
  })
}

/**
 * Handle subscription created or updated
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription, eventId: string) {
  const tenantId = subscription.metadata?.tenant_id
  
  if (!tenantId) {
    // Try to find tenant by customer ID
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('tenant_id, plan_id')
      .eq('stripe_customer_id', subscription.customer as string)
      .single()
    
    if (!existingSub) {
      console.error('Cannot find tenant for subscription:', subscription.id)
      return
    }
  }

  // Get plan from subscription items
  const priceId = subscription.items.data[0]?.price.id
  const plan = await getPlanByPriceId(priceId)
  
  if (!plan) {
    console.error('Cannot find plan for price:', priceId)
    return
  }

  // Get subscription item data (period info is now on items)
  const subscriptionItem = subscription.items.data[0]
  const interval = subscriptionItem?.price.recurring?.interval
  const currentPeriodStart = subscriptionItem?.current_period_start
  const currentPeriodEnd = subscriptionItem?.current_period_end

  // Get current subscription to check for plan change
  const { data: currentSub } = await supabase
    .from('subscriptions')
    .select('plan_id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  const oldPlanId = currentSub?.plan_id

  // Update subscription in database
  const { error } = await supabase
    .from('subscriptions')
    .update({
      plan_id: plan.id,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      billing_interval: interval,
      current_period_start: currentPeriodStart 
        ? new Date(currentPeriodStart * 1000).toISOString() 
        : null,
      current_period_end: currentPeriodEnd 
        ? new Date(currentPeriodEnd * 1000).toISOString() 
        : null,
      trial_start: subscription.trial_start 
        ? new Date(subscription.trial_start * 1000).toISOString() 
        : null,
      trial_end: subscription.trial_end 
        ? new Date(subscription.trial_end * 1000).toISOString() 
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at 
        ? new Date(subscription.canceled_at * 1000).toISOString() 
        : null,
    })
    .eq('stripe_customer_id', subscription.customer as string)

  if (error) {
    console.error('Failed to update subscription:', error)
    return
  }

  // Determine event type
  let eventType = 'updated'
  if (subscription.status === 'trialing') {
    eventType = 'trial_started'
  } else if (oldPlanId && oldPlanId !== plan.id) {
    // Compare plan sort order to determine upgrade/downgrade
    const { data: plans } = await supabase
      .from('subscription_plans')
      .select('id, sort_order')
      .in('id', [oldPlanId, plan.id])

    if (plans && plans.length === 2) {
      const oldOrder = plans.find(p => p.id === oldPlanId)?.sort_order ?? 0
      const newOrder = plans.find(p => p.id === plan.id)?.sort_order ?? 0
      eventType = newOrder > oldOrder ? 'upgraded' : 'downgraded'
    }
  }

  // Log event
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tenant_id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (sub) {
    await logSubscriptionEvent(
      sub.tenant_id,
      eventType,
      oldPlanId || null,
      plan.id,
      eventId,
      { status: subscription.status }
    )
  }
}

/**
 * Handle subscription deleted (canceled)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription, eventId: string) {
  // Get tenant from subscription
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tenant_id, plan_id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (!sub) {
    console.error('Subscription not found:', subscription.id)
    return
  }

  // Downgrade to free plan
  await supabase
    .from('subscriptions')
    .update({
      plan_id: 'free',
      status: 'active',
      stripe_subscription_id: null,
      billing_interval: null,
      current_period_start: null,
      current_period_end: null,
      trial_start: null,
      trial_end: null,
      cancel_at_period_end: false,
      canceled_at: null,
    })
    .eq('tenant_id', sub.tenant_id)

  // Log event
  await logSubscriptionEvent(sub.tenant_id, 'canceled', sub.plan_id, 'free', eventId)
}

/**
 * Get subscription ID from invoice (handles new Stripe API structure)
 */
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  // New API structure: parent.subscription_details.subscription
  const subscriptionDetails = invoice.parent?.subscription_details
  if (subscriptionDetails?.subscription) {
    return typeof subscriptionDetails.subscription === 'string' 
      ? subscriptionDetails.subscription 
      : subscriptionDetails.subscription.id
  }
  return null
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice, eventId: string) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice)
  if (!subscriptionId) return

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tenant_id, plan_id')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  if (sub) {
    await logSubscriptionEvent(sub.tenant_id, 'renewed', sub.plan_id, sub.plan_id, eventId, {
      amount_paid: invoice.amount_paid,
      invoice_id: invoice.id,
    })
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice, eventId: string) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice)
  if (!subscriptionId) return

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tenant_id, plan_id')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  if (!sub) return

  // Update status to past_due
  await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('tenant_id', sub.tenant_id)

  // Log event
  await logSubscriptionEvent(sub.tenant_id, 'payment_failed', sub.plan_id, sub.plan_id, eventId, {
    invoice_id: invoice.id,
    attempt_count: invoice.attempt_count,
  })
}

/**
 * Get plan by Stripe price ID
 */
async function getPlanByPriceId(priceId: string) {
  const { data } = await supabase
    .from('subscription_plans')
    .select('id, name, sort_order')
    .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
    .single()

  return data
}

/**
 * Log subscription event
 */
async function logSubscriptionEvent(
  tenantId: string,
  eventType: string,
  fromPlanId: string | null,
  toPlanId: string | null,
  stripeEventId?: string,
  metadata?: Record<string, unknown>
) {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('tenant_id', tenantId)
    .single()

  await supabase.from('subscription_events').insert({
    tenant_id: tenantId,
    subscription_id: sub?.id,
    event_type: eventType,
    from_plan_id: fromPlanId,
    to_plan_id: toPlanId,
    stripe_event_id: stripeEventId,
    metadata: metadata || {},
  })
}
