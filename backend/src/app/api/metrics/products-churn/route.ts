import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

interface ProductChurnStats {
  whmcs_id: number
  instance_id: string
  active_services: number
  churned_services: number
  churned_mrr: number
  churn_rate: number
}

/**
 * GET /api/metrics/products-churn - Get churn stats per product
 *
 * Delegates per-instance aggregation to the SQL function
 * `get_product_churn_stats` so we share the canonical churn fallback
 * (terminationdate when present, otherwise synced_at + status) with
 * the rest of the system (see migration 00047).
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
    const periodDaysParam = searchParams.get('period_days') || '30'

    let instanceIds: string[] = []
    if (instanceIdsParam) {
      instanceIds = instanceIdsParam.split(',').filter(id => id.trim())
    } else if (instanceIdParam) {
      instanceIds = [instanceIdParam]
    }

    const periodDays = Math.min(Math.max(parseInt(periodDaysParam, 10) || 30, 1), 365)

    if (instanceIds.length === 0) {
      return success({ products: [], period_days: periodDays }, { instance_ids: [] })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const results = await Promise.all(
      instanceIds.map(async (instanceId) => {
        const { data, error: rpcError } = await supabase.rpc('get_product_churn_stats', {
          p_instance_id: instanceId,
          p_period_days: periodDays,
        })
        if (rpcError) {
          console.error('get_product_churn_stats failed:', { instanceId, rpcError })
          return [] as ProductChurnStats[]
        }
        return (data ?? []).map((row: { packageid: number; active_services: number; churned_services: number; churned_mrr: number }) => {
          const total = Number(row.active_services) + Number(row.churned_services)
          return {
            whmcs_id: Number(row.packageid),
            instance_id: instanceId,
            active_services: Number(row.active_services),
            churned_services: Number(row.churned_services),
            churned_mrr: Math.round(Number(row.churned_mrr) * 100) / 100,
            churn_rate: total > 0
              ? Math.round((Number(row.churned_services) / total) * 10000) / 100
              : 0,
          }
        })
      })
    )

    const products = results.flat()

    return success({ products, period_days: periodDays }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/metrics/products-churn:', err)
    return error(err instanceof Error ? err : new Error('Failed to get product churn data'))
  }
}
