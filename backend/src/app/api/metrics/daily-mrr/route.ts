import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'
import { getHistoryDaysLimit } from '@/lib/subscription/limits'

export const dynamic = 'force-dynamic'

interface DailyMRRPoint {
  date: string
  total: number
  pending_churn: number
  categories: Record<string, number>
}

/**
 * GET /api/metrics/daily-mrr - Get daily committed MRR with category breakdown
 * 
 * Query params:
 * - instance_ids: comma-separated instance IDs
 * - days: number of days (30, 60, 90) - defaults to 30
 * 
 * Returns daily MRR data with:
 * - Total committed MRR per day
 * - Breakdown by category
 * - Pending churn (services scheduled for termination)
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

    // Get date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get all active hosting services + billable items + domains in parallel
    const [
      { data: hostingServices, error: hostingError },
      { data: billableItems },
      { data: categoryMappings, error: mappingsError },
      { data: billableMappings },
      { data: domainServices },
    ] = await Promise.all([
      supabase
        .from('whmcs_hosting')
        .select('id, instance_id, whmcs_id, packageid, amount, billingcycle, domainstatus, regdate, nextduedate, terminationdate')
        .in('instance_id', instanceIds)
        .eq('domainstatus', 'Active'),
      supabase
        .from('whmcs_billable_items')
        .select('instance_id, whmcs_id, amount, recurcycle, recur, recurfor, invoicecount, duedate, invoice_action, cancelled_at')
        .in('instance_id', instanceIds)
        .gt('invoicecount', 0)
        .limit(10000),
      supabase
        .from('category_mappings')
        .select('whmcs_id, instance_id, mapping_type, categories(id, name, color)')
        .in('instance_id', instanceIds)
        .eq('mapping_type', 'product'),
      supabase
        .from('category_mappings')
        .select('whmcs_id, instance_id, categories(id, name, color)')
        .in('instance_id', instanceIds)
        .eq('mapping_type', 'billable_item'),
      supabase
        .from('whmcs_domains')
        .select('recurringamount, registrationperiod')
        .in('instance_id', instanceIds)
        .eq('status', 'Active'),
    ])

    if (hostingError) {
      console.error('Hosting query error:', hostingError)
      throw new Error('Failed to fetch hosting data')
    }

    if (mappingsError) {
      console.error('Category mappings query error:', mappingsError)
    }

    // Get products to map packageid -> product for group mappings
    const { data: products, error: productsError } = await supabase
      .from('whmcs_products')
      .select('whmcs_id, instance_id, gid, name')
      .in('instance_id', instanceIds)

    if (productsError) {
      console.error('Products query error:', productsError)
    }

    // Get group-level category mappings
    const { data: groupMappings, error: groupMappingsError } = await supabase
      .from('category_mappings')
      .select(`
        whmcs_id,
        instance_id,
        mapping_type,
        categories (
          id,
          name,
          color
        )
      `)
      .in('instance_id', instanceIds)
      .eq('mapping_type', 'product_group')

    if (groupMappingsError) {
      console.error('Group mappings query error:', groupMappingsError)
    }

    // Build lookup maps
    const productCategoryMap = new Map<string, { name: string; color: string }>()
    const groupCategoryMap = new Map<string, { name: string; color: string }>()
    const productToGroupMap = new Map<string, number>()
    const billableCategoryMap = new Map<string, { name: string; color: string }>()

    // Map products to their groups
    products?.forEach(product => {
      const key = `${product.instance_id}:${product.whmcs_id}`
      productToGroupMap.set(key, product.gid)
    })

    // Direct product mappings
    categoryMappings?.forEach(mapping => {
      if (mapping.categories) {
        const key = `${mapping.instance_id}:${mapping.whmcs_id}`
        const cat = mapping.categories as unknown as { name: string; color: string }
        productCategoryMap.set(key, { name: cat.name, color: cat.color })
      }
    })

    // Group mappings
    groupMappings?.forEach(mapping => {
      if (mapping.categories) {
        const key = `${mapping.instance_id}:${mapping.whmcs_id}`
        const cat = mapping.categories as unknown as { name: string; color: string }
        groupCategoryMap.set(key, { name: cat.name, color: cat.color })
      }
    })

    // Billable item category mappings
    billableMappings?.forEach((mapping: any) => {
      if (mapping.categories) {
        const key = `${mapping.instance_id}:${mapping.whmcs_id}`
        const cat = mapping.categories as { name: string; color: string }
        billableCategoryMap.set(key, { name: cat.name, color: cat.color })
      }
    })

    // Helper to get category for a service
    const getCategoryForService = (instanceId: string, packageId: number): { name: string; color: string } => {
      // First check direct product mapping
      const productKey = `${instanceId}:${packageId}`
      if (productCategoryMap.has(productKey)) {
        return productCategoryMap.get(productKey)!
      }

      // Then check group mapping
      const groupId = productToGroupMap.get(productKey)
      if (groupId) {
        const groupKey = `${instanceId}:${groupId}`
        if (groupCategoryMap.has(groupKey)) {
          return groupCategoryMap.get(groupKey)!
        }
      }

      // Default to Uncategorized
      return { name: 'Uncategorized', color: '#6B7280' }
    }

    // Helper to convert billing cycle to monthly amount
    const toMonthlyAmount = (amount: number, cycle: string): number => {
      const map: Record<string, number> = {
        monthly: 1, months: 1, month: 1,
        quarterly: 3,
        'semi-annually': 6, semiannually: 6,
        annually: 12, yearly: 12, years: 12, year: 12,
        biennially: 24, triennially: 36,
      }
      const divisor = map[cycle?.toLowerCase()]
      if (!divisor) return 0
      return amount / divisor
    }

    // Generate daily data points
    const dailyData: DailyMRRPoint[] = []
    const categoryColors: Record<string, string> = {}

    // Pre-compute billable items metadata — but active state has to be
    // evaluated per day so cancelled items only contribute on the days they
    // were actually live. Same asymmetric logic as calculate_churn:
    //   - cancelled_at known → active before that date, inactive after
    //   - cancelled_at NULL + invoice_action != 4 → legacy cancellation, fall
    //     back to duedate proxy (active until duedate, then inactive)
    //   - invoice_action = 4 → active across the whole window
    type BillableDaily = {
      startDate: Date
      cycleMonths: number
      recurfor: number
      invoiceAction: number
      cancelledAt: Date | null
      dueDate: Date
      monthlyMrr: number
      category: { name: string; color: string }
    }
    const getCycleMonths = (recurcycle: string | null, recur: number | null): number => {
      const base = (recurcycle || '').toLowerCase().startsWith('year') ? 12 : 1
      return base * (recur || 1)
    }
    const billableSeries: BillableDaily[] = (billableItems ?? []).flatMap(item => {
      if (!item.duedate) return []
      const monthlyMrr = toMonthlyAmount(Number(item.amount) || 0, item.recurcycle || '')
      if (monthlyMrr === 0) return []
      const cycleMonths = getCycleMonths(item.recurcycle, item.recur ?? null)
      if (cycleMonths === 0) return []
      const dueDate = new Date(item.duedate)
      const startDate = new Date(dueDate)
      startDate.setMonth(startDate.getMonth() - (item.invoicecount || 0) * cycleMonths)
      const key = `${item.instance_id}:${item.whmcs_id}`
      const cat = billableCategoryMap.get(key) ?? { name: 'Uncategorized', color: '#6B7280' }
      categoryColors[cat.name] = cat.color
      return [{
        startDate,
        cycleMonths,
        recurfor: item.recurfor ?? 0,
        invoiceAction: item.invoice_action ?? 0,
        cancelledAt: item.cancelled_at ? new Date(item.cancelled_at) : null,
        dueDate,
        monthlyMrr,
        category: cat,
      }]
    })
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const billableActiveOn = (b: BillableDaily, date: Date): boolean => {
      if (b.startDate > date) return false
      if (b.recurfor > 0) {
        const monthsDiff =
          (date.getFullYear() - b.startDate.getFullYear()) * 12 +
          (date.getMonth() - b.startDate.getMonth())
        if (Math.floor(monthsDiff / b.cycleMonths) >= b.recurfor) return false
      }
      if (b.invoiceAction === 4) return true
      // Strict at "today" so currently-cancelled items don't get credit for today
      if (date >= todayStart) return false
      // Non-committed item (won't auto-renew): count it in the historical line only
      // up to a REAL past lapse date — cancelled_at if known, else the duedate
      // paid-through proxy. If that lapse date is today-or-future, the item never
      // actually lapsed within the window, so the permissive proxy would draw it
      // active on every past day and only the strict rule above would drop it →
      // an artificial cliff on the last day (e.g. a cancelled Magento retainer with
      // invoice_action=0 and a future duedate). Exclude it so the historical line
      // stays consistent with today's committed value.
      const lapse = b.cancelledAt ?? b.dueDate
      if (lapse >= todayStart) return false
      if (b.cancelledAt) return b.cancelledAt > date
      return b.dueDate >= date
    }

    // Pre-compute domain MRR (constant across all days — already filtered status=Active)
    let domainDailyMRR = 0
    domainServices?.forEach(domain => {
      const annual = Number(domain.recurringamount) || 0
      const period = Number(domain.registrationperiod) || 1
      const monthlyMrr = annual > 0 && period > 0 ? annual / (period * 12) : 0
      domainDailyMRR += monthlyMrr
    })
    if (domainDailyMRR > 0) {
      categoryColors['Domains'] = '#06B6D4'
    }
    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0]
      const categoryTotals: Record<string, number> = {}
      let totalMRR = 0
      let pendingChurn = 0

      hostingServices?.forEach(service => {
        const amount = toMonthlyAmount(
          Number(service.amount) || 0,
          service.billingcycle || ''
        )

        // Check if service was active on this date
        const regDate = service.regdate ? new Date(service.regdate) : null
        const termDate = service.terminationdate ? new Date(service.terminationdate) : null

        // Service must have been registered before this date
        if (regDate && regDate > currentDate) {
          return
        }

        // If terminated before this date, skip
        if (termDate && termDate < currentDate) {
          return
        }

        // Get category
        const category = getCategoryForService(service.instance_id, service.packageid)
        categoryColors[category.name] = category.color

        // Add to category total
        categoryTotals[category.name] = (categoryTotals[category.name] || 0) + amount
        totalMRR += amount

        // Check for pending churn (termination scheduled in the future from this date's perspective)
        if (termDate && termDate > currentDate) {
          pendingChurn += amount
        }
      })

      // Add recurring billable items — evaluate per day so cancelled items
      // drop out of the chart on the day they were cancelled instead of being
      // missing from every historical day.
      billableSeries.forEach(item => {
        if (!billableActiveOn(item, currentDate)) return
        categoryTotals[item.category.name] = (categoryTotals[item.category.name] || 0) + item.monthlyMrr
        totalMRR += item.monthlyMrr
      })

      // Add domain recurring revenue (constant — all active domains)
      if (domainDailyMRR > 0) {
        categoryTotals['Domains'] = (categoryTotals['Domains'] || 0) + domainDailyMRR
        totalMRR += domainDailyMRR
      }

      dailyData.push({
        date: dateStr,
        total: Math.round(totalMRR * 100) / 100,
        pending_churn: Math.round(pendingChurn * 100) / 100,
        categories: Object.fromEntries(
          Object.entries(categoryTotals).map(([k, v]) => [k, Math.round(v * 100) / 100])
        ),
      })

      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Get unique category names for the chart
    const allCategories = [...new Set(dailyData.flatMap(d => Object.keys(d.categories)))]

    return success({
      daily_data: dailyData,
      categories: allCategories.map(name => ({
        name,
        color: categoryColors[name] || '#6B7280',
      })),
      period_days: days,
    }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/metrics/daily-mrr:', err)
    return error(err instanceof Error ? err : new Error('Failed to get daily MRR data'))
  }
}
