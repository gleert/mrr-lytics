import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

interface MovementDataPoint {
  month: string
  starting_mrr: number
  new_mrr: number
  churned_mrr: number
  expansion_mrr: number
  contraction_mrr: number
  ending_mrr: number
  net_change: number
}

/**
 * GET /api/metrics/mrr-movement - Get monthly MRR movement breakdown
 * 
 * Returns Starting MRR, New, Expansion, Contraction, Churn, Ending MRR for each month
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
    const monthsParam = searchParams.get('months') || '6'

    let instanceIds: string[] = []
    if (instanceIdsParam) {
      instanceIds = instanceIdsParam.split(',').filter(id => id.trim())
    } else if (instanceIdParam) {
      instanceIds = [instanceIdParam]
    }

    if (instanceIds.length === 0) {
      throw new Error('No instance specified')
    }

    const months = Math.min(Math.max(parseInt(monthsParam, 10) || 6, 3), 12)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get date range — start (months-1) months ago so the last iteration is the current month
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months + 1)
    startDate.setDate(1) // Start of month

    // Get all hosting services (all statuses — we need cancelled/terminated for churn)
    const { data: hostingServices, error: hostingError } = await supabase
      .from('whmcs_hosting')
      .select('id, instance_id, amount, billingcycle, domainstatus, regdate, nextduedate, terminationdate')
      .in('instance_id', instanceIds)

    if (hostingError) {
      console.error('Hosting query error:', hostingError)
      throw new Error('Failed to fetch hosting data')
    }

    // Monthly amount — same formula as mv_mrr_current view (no monthly_amount shortcut)
    const toMonthlyAmount = (amount: number, cycle: string): number => {
      const map: Record<string, number> = {
        monthly: 1, quarterly: 3,
        'semi-annually': 6, semiannually: 6,
        annually: 12, yearly: 12,
        biennially: 24, triennially: 36,
      }
      const divisor = map[cycle?.toLowerCase()]
      if (!divisor) return 0
      return amount / divisor
    }

    const getMonthlyAmount = (service: typeof hostingServices[0]): number =>
      toMonthlyAmount(Number(service.amount) || 0, service.billingcycle || '')

    // Was service active at end of a given date?
    // Rules (date-driven, NOT relying on current domainstatus for historical dates):
    //   1. regdate must exist and be <= date
    //   2. terminationdate, if set, must be > date (not yet terminated)
    //   3. If no terminationdate: active only if current status is Active/Suspended
    const wasActiveAt = (service: typeof hostingServices[0], date: Date): boolean => {
      const regDate = service.regdate && service.regdate !== '0000-00-00'
        ? new Date(service.regdate) : null
      const termDate = service.terminationdate && service.terminationdate !== '0000-00-00'
        ? new Date(service.terminationdate) : null

      if (!regDate || regDate > date) return false
      if (termDate && termDate <= date) return false

      // Service has a termination date in the future → was active at this date
      if (termDate && termDate > date) return true

      // No termination date: use current status as proxy
      return ['Active', 'Suspended'].includes(service.domainstatus)
    }

    // Generate monthly movement data
    const movementData: MovementDataPoint[] = []

    for (let i = 0; i < months; i++) {
      const monthDate = new Date(startDate)
      monthDate.setMonth(startDate.getMonth() + i)

      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999)
      const prevMonthEnd = new Date(monthStart.getTime() - 1)

      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`

      let starting_mrr = 0
      let new_mrr = 0
      let churned_mrr = 0
      let ending_mrr = 0

      hostingServices?.forEach(service => {
        const wasActive = wasActiveAt(service, prevMonthEnd)
        const isActive  = wasActiveAt(service, monthEnd)
        const mrr = getMonthlyAmount(service)

        if (wasActive) starting_mrr += mrr
        if (isActive)  ending_mrr   += mrr

        if (!wasActive && isActive)   new_mrr     += mrr  // new this month
        if (wasActive  && !isActive)  churned_mrr += mrr  // churned this month
      })

      // Expansion/contraction require historical price data — not available
      const expansion_mrr  = 0
      const contraction_mrr = 0
      const net_change = new_mrr - churned_mrr

      movementData.push({
        month: monthKey,
        starting_mrr: Math.round(starting_mrr * 100) / 100,
        new_mrr: Math.round(new_mrr * 100) / 100,
        churned_mrr: Math.round(churned_mrr * 100) / 100,
        expansion_mrr: Math.round(expansion_mrr * 100) / 100,
        contraction_mrr: Math.round(contraction_mrr * 100) / 100,
        ending_mrr: Math.round(ending_mrr * 100) / 100,
        net_change: Math.round(net_change * 100) / 100,
      })
    }

    // Calculate totals
    const totals = movementData.reduce(
      (acc, m) => ({
        new_mrr: acc.new_mrr + m.new_mrr,
        churned_mrr: acc.churned_mrr + m.churned_mrr,
        expansion_mrr: acc.expansion_mrr + m.expansion_mrr,
        contraction_mrr: acc.contraction_mrr + m.contraction_mrr,
        net_change: acc.net_change + m.net_change,
      }),
      { new_mrr: 0, churned_mrr: 0, expansion_mrr: 0, contraction_mrr: 0, net_change: 0 }
    )

    return success({
      movement_data: movementData,
      totals: {
        new_mrr: Math.round(totals.new_mrr * 100) / 100,
        churned_mrr: Math.round(totals.churned_mrr * 100) / 100,
        expansion_mrr: Math.round(totals.expansion_mrr * 100) / 100,
        contraction_mrr: Math.round(totals.contraction_mrr * 100) / 100,
        net_change: Math.round(totals.net_change * 100) / 100,
      },
      months,
    }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/metrics/mrr-movement:', err)
    return error(err instanceof Error ? err : new Error('Failed to get MRR movement'))
  }
}
