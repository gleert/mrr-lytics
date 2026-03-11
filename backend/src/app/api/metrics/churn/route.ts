import { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { getAuthContext } from '@/lib/auth'
import { calculateChurn } from '@/lib/metrics'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

/**
 * GET /api/metrics/churn - Get churn metrics
 * Query params: period_days (default: 30)
 */
export async function GET(request: NextRequest) {
  try {
    const headersList = await headers()
    const auth = getAuthContext(headersList)

    if (!auth) {
      throw new UnauthorizedError('Authentication required')
    }

    const periodDays = parseInt(request.nextUrl.searchParams.get('period_days') || '30', 10)
    const validPeriod = Math.min(Math.max(periodDays, 1), 365) // Between 1 and 365 days

    const churn = await calculateChurn(auth.tenant_id, validPeriod)

    return success(churn, { tenant_id: auth.tenant_id })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to get churn metrics'))
  }
}
