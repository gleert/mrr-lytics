import { NextRequest, NextResponse } from 'next/server'
import { handleStripeWebhook, isStripeConfigured } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

// Disable body parsing for webhook signature verification
export const runtime = 'nodejs'

/**
 * POST /api/stripe/webhook
 * 
 * Handle Stripe webhook events
 * This endpoint must be publicly accessible (no auth)
 */
export async function POST(request: NextRequest) {
  try {
    // Check Stripe configuration
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      )
    }

    // Get raw body for signature verification
    const payload = await request.text()
    
    // Get Stripe signature header
    const signature = request.headers.get('stripe-signature')
    
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    // Handle the webhook
    const result = await handleStripeWebhook(payload, signature)

    return NextResponse.json({
      received: true,
      ...result,
    })
  } catch (err) {
    console.error('Webhook error:', err)
    const message = err instanceof Error ? err.message : 'Webhook handler failed'
    return NextResponse.json(
      { error: message },
      { status: 400 }
    )
  }
}
