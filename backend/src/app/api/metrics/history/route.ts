import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

/**
 * Metrics history data point
 */
interface MetricsHistoryPoint {
  snapshot_date: string
  mrr: number
  arr: number
  active_services: number
  active_clients: number
  total_clients: number
  churned_services: number
  churned_mrr: number
  churn_rate: number
  revenue_day: number
}

/**
 * GET /api/metrics/history - Get historical metrics (time series)
 * 
 * Query params:
 * - instance_ids: Comma-separated list of WHMCS instance IDs (supports multiple)
 * - instance_id: Single instance ID (legacy, fallback)
 * - days: Number of days of history (default: 30, max: 365)
 * 
 * Returns daily snapshots for charting MRR trends, churn history, etc.
 */
export async function GET(request: NextRequest) {
  try {
    const headersList = await headers()
    const auth = getAuthContext(headersList)

    if (!auth) {
      throw new UnauthorizedError('Authentication required')
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const instanceIdsParam = searchParams.get('instance_ids')
    const instanceIdParam = searchParams.get('instance_id')
    const daysParam = searchParams.get('days')

    // Support multiple instance IDs (comma-separated) or single instance_id
    let instanceIds: string[] = []
    if (instanceIdsParam) {
      instanceIds = instanceIdsParam.split(',').filter(id => id.trim())
    } else if (instanceIdParam) {
      instanceIds = [instanceIdParam]
    }

    if (instanceIds.length === 0) {
      throw new Error('No instance specified')
    }

    // Parse days (default 30, max 365)
    const days = Math.min(Math.max(parseInt(daysParam || '30', 10) || 30, 1), 365)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    let historyData: MetricsHistoryPoint[]

    if (instanceIds.length === 1) {
      // Single instance - use the simple function
      const { data, error: rpcError } = await supabase.rpc('get_metrics_history', {
        p_instance_id: instanceIds[0],
        p_days: days,
      })

      if (rpcError) {
        throw new Error(`Failed to get metrics history: ${rpcError.message}`)
      }

      historyData = (data || []).map((row: Record<string, unknown>) => ({
        snapshot_date: row.snapshot_date as string,
        mrr: Number(row.mrr) || 0,
        arr: Number(row.arr) || 0,
        active_services: Number(row.active_services) || 0,
        active_clients: Number(row.active_clients) || 0,
        total_clients: Number(row.total_clients) || 0,
        churned_services: Number(row.churned_services) || 0,
        churned_mrr: Number(row.churned_mrr) || 0,
        churn_rate: Number(row.churn_rate) || 0,
        revenue_day: Number(row.revenue_day) || 0,
      }))
    } else {
      // Multiple instances - use the aggregated function
      const { data, error: rpcError } = await supabase.rpc('get_metrics_history_aggregated', {
        p_instance_ids: instanceIds,
        p_days: days,
      })

      if (rpcError) {
        throw new Error(`Failed to get aggregated metrics history: ${rpcError.message}`)
      }

      historyData = (data || []).map((row: Record<string, unknown>) => ({
        snapshot_date: row.snapshot_date as string,
        mrr: Number(row.mrr) || 0,
        arr: Number(row.arr) || 0,
        active_services: Number(row.active_services) || 0,
        active_clients: Number(row.active_clients) || 0,
        total_clients: Number(row.total_clients) || 0,
        churned_services: Number(row.churned_services) || 0,
        churned_mrr: Number(row.churned_mrr) || 0,
        churn_rate: Number(row.churn_rate) || 0,
        revenue_day: Number(row.revenue_day) || 0,
      }))
    }

    // Calculate summary statistics
    const latestSnapshot = historyData[0]
    const oldestSnapshot = historyData[historyData.length - 1]

    let mrrChange = 0
    let mrrChangePercent = 0
    if (latestSnapshot && oldestSnapshot && oldestSnapshot.mrr > 0) {
      mrrChange = latestSnapshot.mrr - oldestSnapshot.mrr
      mrrChangePercent = (mrrChange / oldestSnapshot.mrr) * 100
    }

    return success({
      data: historyData,
      summary: {
        days_requested: days,
        days_available: historyData.length,
        latest_date: latestSnapshot?.snapshot_date || null,
        oldest_date: oldestSnapshot?.snapshot_date || null,
        current_mrr: latestSnapshot?.mrr || 0,
        mrr_change: mrrChange,
        mrr_change_percent: Math.round(mrrChangePercent * 100) / 100,
      },
      instance_ids: instanceIds,
    })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to get metrics history'))
  }
}
