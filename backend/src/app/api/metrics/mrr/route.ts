import { headers } from 'next/headers'
import { getAuthContext } from '@/lib/auth'
import { calculateMrr } from '@/lib/metrics'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

/**
 * GET /api/metrics/mrr - Get MRR metrics
 */
export async function GET() {
  try {
    const headersList = await headers()
    const auth = getAuthContext(headersList)

    if (!auth) {
      throw new UnauthorizedError('Authentication required')
    }

    const mrr = await calculateMrr(auth.tenant_id)

    return success(mrr, { tenant_id: auth.tenant_id })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to get MRR metrics'))
  }
}
