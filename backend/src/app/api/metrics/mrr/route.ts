import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { calculateMrrLive } from '@/lib/metrics'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

/**
 * GET /api/metrics/mrr - Get MRR metrics
 *
 * Uses the live raw-table calculator so the numbers always match
 * /api/metrics and /api/metrics/mrr-breakdown.
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
      instanceIds = instanceIdsParam.split(',').filter((id) => id.trim())
    } else if (instanceIdParam) {
      instanceIds = [instanceIdParam]
    }

    if (instanceIds.length === 0) {
      throw new Error('No instance specified')
    }

    const live = await calculateMrrLive(instanceIds)

    return success(
      {
        mrr: live.total,
        arr: live.arr,
        active_services: live.active_services,
        mrr_by_cycle: live.mrr_by_cycle,
        calculated_at: live.calculated_at,
      },
      { instance_ids: instanceIds }
    )
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to get MRR metrics'))
  }
}
