import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { createCheckoutSession, isStripeConfigured } from '@/lib/stripe'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError, BadRequestError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

/**
 * POST /api/stripe/create-checkout
 * 
 * Create a Stripe Checkout session to upgrade subscription
 * 
 * Body:
 * - plan_id: string (required) - The plan to subscribe to
 * - billing_interval: 'month' | 'year' (required)
 * - success_url: string (optional) - Redirect URL after success
 * - cancel_url: string (optional) - Redirect URL after cancel
 * 
 * Returns 503 if Stripe is not configured (use /api/subscription/change in dev mode)
 */
export async function POST(request: NextRequest) {
  try {
    // Check Stripe configuration - return 503 if not configured
    if (!isStripeConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'STRIPE_NOT_CONFIGURED',
            message: 'Stripe is not configured. Use /api/subscription/change in development mode.',
          },
        },
        { status: 503 }
      )
    }

    const headersList = await headers()
    const auth = getAuthContext(headersList)

    if (!auth) {
      throw new UnauthorizedError('Authentication required')
    }

    const body = await request.json()
    const { plan_id, billing_interval, success_url, cancel_url } = body

    // Validate required fields
    if (!plan_id) {
      throw new BadRequestError('plan_id is required')
    }
    if (!billing_interval || !['month', 'year'].includes(billing_interval)) {
      throw new BadRequestError('billing_interval must be "month" or "year"')
    }

    // Get user email for Stripe
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('tenant_id', auth.tenant_id)
      .limit(1)
      .single()

    if (!user?.email) {
      throw new BadRequestError('No user email found')
    }

    // Default URLs
    const baseUrl = process.env.DASHBOARD_URL || 'http://localhost:5173'
    const defaultSuccessUrl = `${baseUrl}/settings/billing?success=true`
    const defaultCancelUrl = `${baseUrl}/settings/billing?canceled=true`

    // Create checkout session
    const session = await createCheckoutSession({
      tenantId: auth.tenant_id,
      planId: plan_id,
      billingInterval: billing_interval,
      userEmail: user.email,
      successUrl: success_url || defaultSuccessUrl,
      cancelUrl: cancel_url || defaultCancelUrl,
    })

    return success({
      checkout_url: session.url,
      session_id: session.id,
    })
  } catch (err) {
    console.error('Create checkout error:', err)
    return error(err instanceof Error ? err : new Error('Failed to create checkout session'))
  }
}
