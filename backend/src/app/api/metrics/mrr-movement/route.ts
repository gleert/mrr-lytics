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
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months + 1)
    startDate.setDate(1) // Start of month

    // Get all hosting services
    const { data: hostingServices, error: hostingError } = await supabase
      .from('whmcs_hosting')
      .select('id, instance_id, amount, billingcycle, monthly_amount, domainstatus, regdate, terminationdate')
      .in('instance_id', instanceIds)

    if (hostingError) {
      console.error('Hosting query error:', hostingError)
      throw new Error('Failed to fetch hosting data')
    }

    // Helper to convert billing cycle to monthly amount
    const toMonthlyAmount = (amount: number, cycle: string): number => {
      const cycleLower = cycle?.toLowerCase() || 'monthly'
      switch (cycleLower) {
        case 'monthly': return amount
        case 'quarterly': return amount / 3
        case 'semi-annually':
        case 'semiannually': return amount / 6
        case 'annually':
        case 'yearly': return amount / 12
        case 'biennially': return amount / 24
        case 'triennially': return amount / 36
        default: return amount
      }
    }

    // Get monthly amount for a service
    const getMonthlyAmount = (service: typeof hostingServices[0]): number => {
      return service.monthly_amount || toMonthlyAmount(
        Number(service.amount) || 0,
        service.billingcycle || 'monthly'
      )
    }

    // Check if service was active at a specific date
    const wasActiveAt = (service: typeof hostingServices[0], date: Date): boolean => {
      const regDate = service.regdate && service.regdate !== '0000-00-00' ? new Date(service.regdate) : null
      const termDate = service.terminationdate && service.terminationdate !== '0000-00-00' ? new Date(service.terminationdate) : null

      // Not yet registered
      if (regDate && regDate > date) {
        return false
      }

      // Already terminated
      if (termDate && termDate <= date) {
        return false
      }

      // Must be Active or Suspended to count
      if (!['Active', 'Suspended'].includes(service.domainstatus)) {
        // If terminated in the future, it was active at this date
        if (termDate && termDate > date) {
          return true
        }
        return false
      }

      return true
    }

    // Calculate MRR at end of month
    const calculateMRRAtDate = (date: Date): number => {
      let mrr = 0
      hostingServices?.forEach(service => {
        if (wasActiveAt(service, date)) {
          mrr += getMonthlyAmount(service)
        }
      })
      return mrr
    }

    // Track services for movement calculation
    interface ServiceSnapshot {
      id: string
      amount: number
      active: boolean
    }

    const getServicesSnapshot = (date: Date): Map<string, ServiceSnapshot> => {
      const snapshot = new Map<string, ServiceSnapshot>()
      hostingServices?.forEach(service => {
        const active = wasActiveAt(service, date)
        snapshot.set(service.id, {
          id: service.id,
          amount: getMonthlyAmount(service),
          active,
        })
      })
      return snapshot
    }

    // Generate monthly movement data
    const movementData: MovementDataPoint[] = []

    for (let i = 0; i < months; i++) {
      const monthDate = new Date(startDate)
      monthDate.setMonth(startDate.getMonth() + i)
      
      // Start of this month
      const monthStart = new Date(monthDate)
      monthStart.setDate(1)
      
      // End of this month
      const monthEnd = new Date(monthDate)
      monthEnd.setMonth(monthEnd.getMonth() + 1)
      monthEnd.setDate(0)
      monthEnd.setHours(23, 59, 59, 999)

      // End of previous month (for starting MRR)
      const prevMonthEnd = new Date(monthStart)
      prevMonthEnd.setDate(0)
      prevMonthEnd.setHours(23, 59, 59, 999)

      const monthKey = monthDate.toISOString().substring(0, 7) // YYYY-MM

      // Get snapshots
      const prevSnapshot = getServicesSnapshot(prevMonthEnd)
      const currSnapshot = getServicesSnapshot(monthEnd)

      let starting_mrr = 0
      let new_mrr = 0
      let churned_mrr = 0
      let expansion_mrr = 0
      let contraction_mrr = 0
      let ending_mrr = 0

      // Calculate starting MRR (active at end of previous month)
      prevSnapshot.forEach((service) => {
        if (service.active) {
          starting_mrr += service.amount
        }
      })

      // Calculate movements by comparing snapshots
      currSnapshot.forEach((curr, id) => {
        const prev = prevSnapshot.get(id)

        if (curr.active) {
          ending_mrr += curr.amount

          if (!prev || !prev.active) {
            // New customer or reactivation
            new_mrr += curr.amount
          } else if (prev.active) {
            // Existing customer - check for expansion/contraction
            const diff = curr.amount - prev.amount
            if (diff > 0) {
              expansion_mrr += diff
            } else if (diff < 0) {
              contraction_mrr += Math.abs(diff)
            }
          }
        } else if (prev && prev.active) {
          // Was active, now not - churned
          churned_mrr += prev.amount
        }
      })

      // Check for services in prev but not in curr (shouldn't happen, but just in case)
      prevSnapshot.forEach((prev, id) => {
        if (prev.active && !currSnapshot.has(id)) {
          churned_mrr += prev.amount
        }
      })

      const net_change = new_mrr + expansion_mrr - churned_mrr - contraction_mrr

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
