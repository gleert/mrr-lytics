import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { calculateRevenueByProductMultiInstance } from '@/lib/metrics'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

/**
 * GET /api/metrics/revenue - Hosting MRR broken down by product.
 *
 * Sourced from mv_revenue_by_product, which covers hosting products only
 * (domainstatus='Active') — so total_mrr here is the hosting slice of MRR, not
 * the full committed MRR. Takes instance_ids like the other metrics endpoints
 * (previously it incorrectly passed tenant_id into an instance_id filter, so it
 * always returned zero).
 */
export async function GET(request: NextRequest) {
  try {
    const headersList = await headers()
    const auth = getAuthContext(headersList)

    if (!auth) {
      throw new UnauthorizedError('Authentication required')
    }

    const { searchParams } = new URL(request.url)
    const instanceIdsParam = searchParams.get('instance_ids')
    const instanceIdParam = searchParams.get('instance_id')

    let instanceIds: string[] = []
    if (instanceIdsParam) {
      instanceIds = instanceIdsParam.split(',').filter(id => id.trim())
    } else if (instanceIdParam) {
      instanceIds = [instanceIdParam]
    }

    if (instanceIds.length === 0) {
      throw new Error('No instance specified')
    }

    const revenue = await calculateRevenueByProductMultiInstance(instanceIds)

    return success({
      products: revenue,
      total_mrr: revenue.reduce((sum, p) => sum + p.mrr, 0),
    }, { instance_ids: instanceIds })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to get revenue metrics'))
  }
}
