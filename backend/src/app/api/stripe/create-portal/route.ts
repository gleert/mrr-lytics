import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { createBillingPortalSession, isStripeConfigured } from '@/lib/stripe'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError, BadRequestError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

/**
 * POST /api/stripe/create-portal
 * 
 * Create a Stripe Billing Portal session for managing subscription
 * 
 * Body:
 * - return_url: string (optional) - URL to return to after portal
 */
export async function POST(request: NextRequest) {
  try {
    // Check Stripe configuration
    if (!isStripeConfigured()) {
      throw new BadRequestError('Stripe is not configured')
    }

    const headersList = await headers()
    const auth = getAuthContext(headersList)

    if (!auth) {
      throw new UnauthorizedError('Authentication required')
    }

    const body = await request.json().catch(() => ({}))
    const { return_url } = body

    // Default return URL
    const baseUrl = process.env.DASHBOARD_URL || 'http://localhost:5173'
    const defaultReturnUrl = `${baseUrl}/settings/billing`

    // Create portal session
    const session = await createBillingPortalSession(
      auth.tenant_id,
      return_url || defaultReturnUrl
    )

    return success({
      portal_url: session.url,
    })
  } catch (err) {
    console.error('Create portal error:', err)
    return error(err instanceof Error ? err : new Error('Failed to create billing portal session'))
  }
}
