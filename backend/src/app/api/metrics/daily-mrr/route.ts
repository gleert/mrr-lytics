import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'
import { getHistoryDaysLimit } from '@/lib/subscription/limits'

export const dynamic = 'force-dynamic'

/**
 * Sentinel category name for the single committed-MRR band. The dashboard
 * localizes this to "MRR Comprometido" / "Committed MRR" (like 'pending_churn').
 */
const COMMITTED_CATEGORY = 'committed_mrr'

interface DailyMRRPoint {
  date: string
  total: number
  pending_churn: number
  categories: Record<string, number>
}

/**
 * GET /api/metrics/daily-mrr - Daily committed MRR, the REAL recorded value.
 *
 * Reads the per-day committed MRR straight from `metrics_daily.mrr` (the live
 * daily snapshot of the active set — the same figure as the MRR KPI), summed
 * across the requested instances. This is the faithful run-rate over time: it
 * dates every movement (new / churn / price change) on its real day, including
 * cancellations the old reconstruction could not date (it projected today's
 * active set backward, so it under/over-stated the past and dumped corrections on
 * the last day). Returned as a single "committed_mrr" series so the existing
 * stacked-area chart renders one accurate band.
 *
 * Query params:
 * - instance_ids: comma-separated instance IDs (or instance_id)
 * - days: 30 | 60 | 90 (default 30)
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
    const daysParam = searchParams.get('days') || '30'

    let instanceIds: string[] = []
    if (instanceIdsParam) {
      instanceIds = instanceIdsParam.split(',').filter(id => id.trim())
    } else if (instanceIdParam) {
      instanceIds = [instanceIdParam]
    }

    if (instanceIds.length === 0) {
      throw new Error('No instance specified')
    }

    const historyLimit = await getHistoryDaysLimit(auth.tenant_id)
    const maxDays = historyLimit === -1 ? 90 : Math.min(90, historyLimit)
    const days = Math.min(maxDays, Math.max(30, parseInt(daysParam, 10) || 30))

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Date window [startDate, today].
    const today = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startStr = startDate.toISOString().slice(0, 10)
    const endStr = today.toISOString().slice(0, 10)

    // Real recorded committed MRR per (instance, day).
    const { data: rows, error: rowsError } = await supabase
      .from('metrics_daily')
      .select('date, mrr')
      .in('instance_id', instanceIds)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true })
      .limit(100000)

    if (rowsError) {
      console.error('metrics_daily query error:', rowsError)
      throw new Error('Failed to fetch daily MRR data')
    }

    // Sum across instances per day.
    const totalsByDate = new Map<string, number>()
    for (const r of rows ?? []) {
      totalsByDate.set(r.date, (totalsByDate.get(r.date) ?? 0) + (Number(r.mrr) || 0))
    }

    const dailyData: DailyMRRPoint[] = Array.from(totalsByDate.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, total]) => {
        const rounded = Math.round(total * 100) / 100
        return {
          date,
          total: rounded,
          pending_churn: 0,
          categories: { [COMMITTED_CATEGORY]: rounded },
        }
      })

    return success({
      daily_data: dailyData,
      categories: [{ name: COMMITTED_CATEGORY, color: '#7C3AED' }],
      period_days: days,
    }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/metrics/daily-mrr:', err)
    return error(err instanceof Error ? err : new Error('Failed to get daily MRR data'))
  }
}
