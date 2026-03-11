import Stripe from 'stripe'
import { getStripe } from './client'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

interface CreateCheckoutOptions {
  tenantId: string
  planId: string
  billingInterval: 'month' | 'year'
  userEmail: string
  successUrl: string
  cancelUrl: string
}

interface Plan {
  id: string
  name: string
  stripe_price_id_monthly: string | null
  stripe_price_id_yearly: string | null
}

interface Subscription {
  stripe_customer_id: string | null
}

/**
 * Create a Stripe Checkout session for upgrading to a paid plan
 */
export async function createCheckoutSession(options: CreateCheckoutOptions): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe()
  const { tenantId, planId, billingInterval, userEmail, successUrl, cancelUrl } = options

  // Get plan details
  const { data: plan, error: planError } = await supabase
    .from('subscription_plans')
    .select('id, name, stripe_price_id_monthly, stripe_price_id_yearly')
    .eq('id', planId)
    .single()

  if (planError || !plan) {
    throw new Error(`Plan not found: ${planId}`)
  }

  const typedPlan = plan as Plan
  const priceId = billingInterval === 'year' 
    ? typedPlan.stripe_price_id_yearly 
    : typedPlan.stripe_price_id_monthly

  if (!priceId) {
    throw new Error(`No Stripe price configured for plan ${planId} (${billingInterval})`)
  }

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer(tenantId, userEmail)

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      trial_period_days: 14,
      metadata: {
        tenant_id: tenantId,
        plan_id: planId,
      },
    },
    metadata: {
      tenant_id: tenantId,
      plan_id: planId,
    },
    allow_promotion_codes: true,
    billing_address_collection: 'required',
  })

  return session
}

/**
 * Create a Stripe Billing Portal session for managing subscription
 */
export async function createBillingPortalSession(
  tenantId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe()

  // Get customer ID from subscription
  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('tenant_id', tenantId)
    .single()

  if (error || !subscription) {
    throw new Error('No subscription found for tenant')
  }

  const typedSubscription = subscription as Subscription

  if (!typedSubscription.stripe_customer_id) {
    throw new Error('No Stripe customer associated with subscription')
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: typedSubscription.stripe_customer_id,
    return_url: returnUrl,
  })

  return session
}

/**
 * Create a new Stripe customer
 */
export async function createStripeCustomer(
  tenantId: string,
  email: string,
  name?: string
): Promise<string> {
  const stripe = getStripe()

  // Get tenant name
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single()

  const customer = await stripe.customers.create({
    email,
    name: name || tenant?.name || undefined,
    metadata: {
      tenant_id: tenantId,
    },
  })

  // Update subscription with customer ID
  await supabase
    .from('subscriptions')
    .update({ stripe_customer_id: customer.id })
    .eq('tenant_id', tenantId)

  return customer.id
}

/**
 * Get existing Stripe customer or create a new one
 */
export async function getOrCreateStripeCustomer(
  tenantId: string,
  email: string
): Promise<string> {
  // Check if customer already exists
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('tenant_id', tenantId)
    .single()

  const typedSubscription = subscription as Subscription | null

  if (typedSubscription?.stripe_customer_id) {
    return typedSubscription.stripe_customer_id
  }

  // Create new customer
  return createStripeCustomer(tenantId, email)
}
