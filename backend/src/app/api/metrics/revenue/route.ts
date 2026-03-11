import { headers } from 'next/headers'
import { getAuthContext } from '@/lib/auth'
import { calculateRevenueByProduct } from '@/lib/metrics'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

/**
 * GET /api/metrics/revenue - Get revenue by product
 */
export async function GET() {
  try {
    const headersList = await headers()
    const auth = getAuthContext(headersList)

    if (!auth) {
      throw new UnauthorizedError('Authentication required')
    }

    const revenue = await calculateRevenueByProduct(auth.tenant_id)

    return success({
      products: revenue,
      total_mrr: revenue.reduce((sum, p) => sum + p.mrr, 0),
    }, { tenant_id: auth.tenant_id })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to get revenue metrics'))
  }
}
