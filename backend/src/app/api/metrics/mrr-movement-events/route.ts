import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

type MovementEventType = 'new' | 'churn' | 'expansion' | 'contraction' | 'reactivation'

interface MovementEvent {
  instance_id: string
  entity_type: 'hosting' | 'billable' | 'domain'
  entity_id: number
  event_type: MovementEventType
  mrr_before: number
  mrr_after: number
  mrr_delta: number
  observed_date: string
  effective_date: string | null
}

/**
 * GET /api/metrics/mrr-movement-events
 *
 * Observed per-entity MRR movements (new / churn / expansion / contraction /
 * reactivation) detected by the daily snapshot diff (runMovementSnapshot).
 * Validation/inspection endpoint for the new mechanism — the production
 * mrr-movement endpoints are NOT migrated to this yet.
 *
 * Query params:
 *   - instance_ids: comma-separated  (or instance_id)
 *   - month: 'YYYY-MM' (default current month)
 *   - use: 'observed' (default) | 'effective' — which date to bucket by
 */
export async function GET(request: NextRequest) {
  try {
    const headersList = await headers()
    const auth = getAuthContext(headersList)
    if (!auth) throw new UnauthorizedError('Authentication required')

    const { searchParams } = new URL(request.url)
    const instanceIdsParam = searchParams.get('instance_ids')
    const instanceIdParam = searchParams.get('instance_id')
    const monthParam = searchParams.get('month')
    const useEffective = searchParams.get('use') === 'effective'

    let instanceIds: string[] = []
    if (instanceIdsParam) instanceIds = instanceIdsParam.split(',').filter((id) => id.trim())
    else if (instanceIdParam) instanceIds = [instanceIdParam]
    if (instanceIds.length === 0) throw new Error('No instance specified')

    // Resolve month window [monthStart, nextMonthStart) as YYYY-MM-DD strings.
    const now = new Date()
    let year: number
    let month0: number
    if (monthParam) {
      const [y, m] = monthParam.split('-').map(Number)
      year = y
      month0 = (m || 1) - 1
    } else {
      year = now.getFullYear()
      month0 = now.getMonth()
    }
    const pad = (n: number) => String(n).padStart(2, '0')
    const monthStart = `${year}-${pad(month0 + 1)}-01`
    const nextYear = month0 === 11 ? year + 1 : year
    const nextMonth0 = month0 === 11 ? 0 : month0 + 1
    const nextMonthStart = `${nextYear}-${pad(nextMonth0 + 1)}-01`
    const month = `${year}-${pad(month0 + 1)}`

    const dateCol = useEffective ? 'effective_date' : 'observed_date'

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error: queryError } = await supabase
      .from('mrr_movement_events')
      .select('instance_id, entity_type, entity_id, event_type, mrr_before, mrr_after, mrr_delta, observed_date, effective_date')
      .in('instance_id', instanceIds)
      .gte(dateCol, monthStart)
      .lt(dateCol, nextMonthStart)
      .order(dateCol, { ascending: false })
      .limit(10000)

    if (queryError) throw new Error(`Failed to load movement events: ${queryError.message}`)

    const events: MovementEvent[] = (data ?? []).map((e) => ({
      instance_id: e.instance_id,
      entity_type: e.entity_type,
      entity_id: e.entity_id,
      event_type: e.event_type,
      mrr_before: Number(e.mrr_before) || 0,
      mrr_after: Number(e.mrr_after) || 0,
      mrr_delta: Number(e.mrr_delta) || 0,
      observed_date: e.observed_date,
      effective_date: e.effective_date,
    }))

    const round2 = (n: number) => Math.round(n * 100) / 100
    const sumDelta = (type: MovementEventType) =>
      events.filter((e) => e.event_type === type).reduce((s, e) => s + e.mrr_delta, 0)
    const countOf = (type: MovementEventType) => events.filter((e) => e.event_type === type).length

    const new_mrr = sumDelta('new')
    const reactivation_mrr = sumDelta('reactivation')
    const expansion_mrr = sumDelta('expansion')
    const contraction_mrr = sumDelta('contraction') // negative
    const churn_mrr = sumDelta('churn') // negative
    const net_change = new_mrr + reactivation_mrr + expansion_mrr + contraction_mrr + churn_mrr

    return success(
      {
        month,
        instance_ids: instanceIds,
        bucketed_by: dateCol,
        totals: {
          new_mrr: round2(new_mrr),
          reactivation_mrr: round2(reactivation_mrr),
          expansion_mrr: round2(expansion_mrr),
          contraction_mrr: round2(contraction_mrr),
          churn_mrr: round2(churn_mrr),
          net_change: round2(net_change),
          event_counts: {
            new: countOf('new'),
            reactivation: countOf('reactivation'),
            expansion: countOf('expansion'),
            contraction: countOf('contraction'),
            churn: countOf('churn'),
          },
        },
        events,
      },
      { instance_ids: instanceIds }
    )
  } catch (err) {
    console.error('Error in /api/metrics/mrr-movement-events:', err)
    return error(err instanceof Error ? err : new Error('Failed to get movement events'))
  }
}
