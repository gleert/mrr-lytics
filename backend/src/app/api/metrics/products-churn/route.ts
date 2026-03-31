import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

interface HostingService {
  instance_id: string
  packageid: number
  amount: number
  billingcycle: string
  domainstatus: string
  regdate: string | null
  terminationdate: string | null
}

interface ProductChurnStats {
  whmcs_id: number
  instance_id: string
  active_services: number
  churned_services: number
  churned_mrr: number
  churn_rate: number
}

// Same formula as mv_mrr_current view
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

// Date-driven active check — consistent with mrr-movement route
const wasActiveAt = (service: HostingService, date: Date): boolean => {
  const regDate = service.regdate && service.regdate !== '0000-00-00'
    ? new Date(service.regdate) : null
  const termDate = service.terminationdate && service.terminationdate !== '0000-00-00'
    ? new Date(service.terminationdate) : null

  if (!regDate || regDate > date) return false
  if (termDate && termDate <= date) return false
  if (termDate && termDate > date) return true

  // No termination date: use current domainstatus as proxy
  return ['Active', 'Suspended'].includes(service.domainstatus)
}

/**
 * GET /api/metrics/products-churn - Get churn stats per product
 *
 * Returns active_services, churned_services, churned_mrr, churn_rate for each product
 * over the requested period.
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

    const { data: hostingServices, error: hostingError } = await supabase
      .from('whmcs_hosting')
      .select('instance_id, packageid, amount, billingcycle, domainstatus, regdate, terminationdate')
      .in('instance_id', instanceIds)

    if (hostingError) {
      console.error('Hosting query error:', hostingError)
      throw new Error('Failed to fetch hosting data')
    }

    const periodEnd = new Date()
    const periodStart = new Date()
    periodStart.setDate(periodStart.getDate() - periodDays)

    // Aggregate per product
    const stats = new Map<string, { active: number; churned: number; churned_mrr: number }>()

    hostingServices?.forEach(service => {
      const wasActive = wasActiveAt(service, periodStart)
      const isActive = wasActiveAt(service, periodEnd)
      const mrr = toMonthlyAmount(Number(service.amount) || 0, service.billingcycle || '')
      const key = `${service.instance_id}:${service.packageid}`

      const existing = stats.get(key) || { active: 0, churned: 0, churned_mrr: 0 }

      if (isActive) existing.active++
      if (wasActive && !isActive) {
        existing.churned++
        existing.churned_mrr += mrr
      }

      stats.set(key, existing)
    })

    const products: ProductChurnStats[] = []
    stats.forEach((data, key) => {
      const [instance_id, whmcsIdStr] = key.split(':')
      const total = data.active + data.churned
      products.push({
        whmcs_id: Number(whmcsIdStr),
        instance_id,
        active_services: data.active,
        churned_services: data.churned,
        churned_mrr: Math.round(data.churned_mrr * 100) / 100,
        churn_rate: total > 0 ? Math.round((data.churned / total) * 10000) / 100 : 0,
      })
    })

    return success({ products, period_days: periodDays }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/metrics/products-churn:', err)
    return error(err instanceof Error ? err : new Error('Failed to get product churn data'))
  }
}
