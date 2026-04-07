import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

interface MonthlyDataPoint {
  month: string
  total: number
  groups: Record<string, number>
}

interface GroupInfo {
  id: number
  name: string
  color: string
  total_mrr: number
}

// Default colors for product groups
const GROUP_COLORS = [
  '#7C3AED', // Purple
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#8B5CF6', // Violet
  '#F97316', // Orange
  '#14B8A6', // Teal
]

/**
 * GET /api/metrics/mrr-trend - Get 12-month MRR trend by category (with fallback to product group)
 *
 * Priority for grouping each active service:
 *   1. Category mapped directly to the product
 *   2. Category mapped to the product's group
 *   3. Fallback: product group name  (triggers fallback mode)
 *
 * Returns:
 *   - monthly_data: MonthlyDataPoint[]
 *   - all_groups: GroupInfo[]
 *   - default_groups: string[]
 *   - using_categories: boolean  — true when ≥50% of MRR is covered by real categories
 *   - uncategorized_mrr_pct: number — percentage of MRR with no category mapping
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
      instanceIds = instanceIdsParam.split(',').filter(id => id.trim())
    } else if (instanceIdParam) {
      instanceIds = [instanceIdParam]
    }

    if (instanceIds.length === 0) {
      throw new Error('No instance specified')
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get date range (last 12 months)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - 11)
    startDate.setDate(1) // Start of month

    // --- Fetch all needed data in parallel ---
    const [
      { data: hostingServices, error: hostingError },
      { data: products },
      { data: productGroups },
      { data: mappings },
      { data: billableItems },
    ] = await Promise.all([
      supabase
        .from('whmcs_hosting')
        .select('instance_id, packageid, amount, billingcycle, domainstatus, regdate, terminationdate')
        .in('instance_id', instanceIds),
      supabase
        .from('whmcs_products')
        .select('whmcs_id, instance_id, gid, name')
        .in('instance_id', instanceIds),
      supabase
        .from('whmcs_product_groups')
        .select('whmcs_id, instance_id, name')
        .in('instance_id', instanceIds),
      supabase
        .from('category_mappings')
        .select('instance_id, mapping_type, whmcs_id, categories(id, name, color)')
        .in('instance_id', instanceIds),
      supabase
        .from('whmcs_billable_items')
        .select('instance_id, whmcs_id, amount, recurcycle, recur, invoicecount, recurfor, duedate')
        .in('instance_id', instanceIds)
        .eq('invoice_action', 4)
        .gt('invoicecount', 0)
        .limit(10000),
    ])

    if (hostingError) {
      console.error('Hosting query error:', hostingError)
      throw new Error('Failed to fetch hosting data')
    }

    // --- Build lookup maps ---

    // product group id per product: `instance:productWhmcsId` → groupWhmcsId
    const productToGroupMap = new Map<string, number>()
    products?.forEach(p => {
      productToGroupMap.set(`${p.instance_id}:${p.whmcs_id}`, p.gid)
    })

    // product group name: `instance:groupWhmcsId` → name
    const groupNameMap = new Map<string, string>()
    productGroups?.forEach(g => {
      groupNameMap.set(`${g.instance_id}:${g.whmcs_id}`, g.name || 'Unknown Group')
    })

    // category per product: `instance:productWhmcsId` → { name, color }
    const productCategoryMap = new Map<string, { name: string; color: string }>()
    // category per product group: `instance:groupWhmcsId` → { name, color }
    const groupCategoryMap = new Map<string, { name: string; color: string }>()

    // category per billable item: `instance:whmcsId` → { name, color }
    const billableCategoryMap = new Map<string, { name: string; color: string }>()

    mappings?.forEach((m: any) => {
      if (!m.categories) return
      const key = `${m.instance_id}:${m.whmcs_id}`
      const cat = { name: m.categories.name as string, color: m.categories.color as string }
      if (m.mapping_type === 'product') {
        productCategoryMap.set(key, cat)
      } else if (m.mapping_type === 'product_group') {
        groupCategoryMap.set(key, cat)
      } else if (m.mapping_type === 'billable_item') {
        billableCategoryMap.set(key, cat)
      }
    })

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

    // Estimate billing cycle duration in months
    const getCycleMonths = (recurcycle: string, recur: number): number => {
      const base = (recurcycle || '').toLowerCase().startsWith('year') ? 12 : 1
      return base * (recur || 1)
    }

    // Was billable item active at a given date?
    // Uses estimated start date: duedate - invoicecount * cycleMonths
    const billableWasActiveAt = (
      startDate: Date,
      recurfor: number,
      cycleMonths: number,
      date: Date,
    ): boolean => {
      if (startDate > date) return false
      if (recurfor === 0) return true
      const monthsDiff =
        (date.getFullYear() - startDate.getFullYear()) * 12 +
        (date.getMonth() - startDate.getMonth())
      return Math.floor(monthsDiff / cycleMonths) < recurfor
    }

    // Pre-compute billable item start dates
    type BillableItemWithStart = {
      startDate: Date
      cycleMonths: number
      recurfor: number
      monthlyMrr: number
      categoryName: string
      categoryColor: string
    }
    const billableWithStart: BillableItemWithStart[] = (billableItems || []).flatMap(item => {
      if (!item.duedate) return []
      const cycleMonths = getCycleMonths(item.recurcycle || 'Months', item.recur || 1)
      const monthlyMrr = toMonthlyAmount(Number(item.amount) || 0, item.recurcycle || '')
      if (monthlyMrr === 0 || cycleMonths === 0) return []
      const dueDate = new Date(item.duedate)
      const startDate = new Date(dueDate)
      startDate.setMonth(startDate.getMonth() - (item.invoicecount || 0) * cycleMonths)
      const key = `${item.instance_id}:${item.whmcs_id}`
      const cat = billableCategoryMap.get(key)
      return [{
        startDate,
        cycleMonths,
        recurfor: item.recurfor ?? 0,
        monthlyMrr,
        categoryName: cat?.name ?? 'Uncategorized',
        categoryColor: cat?.color ?? '',
      }]
    })

    // Generate 12 months of data
    const monthlyData: MonthlyDataPoint[] = []
    const groupTotals = new Map<string, { total: number; color: string }>()

    // Track category coverage across all months (use last month as representative)
    let lastMonthCategorizedMRR = 0
    let lastMonthTotalMRR = 0

    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(startDate)
      monthDate.setMonth(startDate.getMonth() + i)
      const monthEnd = new Date(monthDate)
      monthEnd.setMonth(monthEnd.getMonth() + 1)
      monthEnd.setDate(0) // Last day of month

      const monthKey = monthDate.toISOString().substring(0, 7) // YYYY-MM
      const groupMRR: Record<string, number> = {}
      let totalMRR = 0
      let categorizedMRR = 0

      hostingServices?.forEach(service => {
        // Check if service was active during this month
        const regDate = service.regdate ? new Date(service.regdate) : null
        const termDate = service.terminationdate ? new Date(service.terminationdate) : null

        // Service must have been registered before end of this month
        if (regDate && regDate > monthEnd) {
          return
        }

        // If terminated before start of this month, skip
        if (termDate && termDate < monthDate) {
          return
        }

        // Only count active services (Suspended excluded to match mv_mrr_current)
        if (service.domainstatus !== 'Active') {
          return
        }

        const monthlyAmount = toMonthlyAmount(
          Number(service.amount) || 0,
          service.billingcycle || ''
        )

        // Resolve group/category with priority logic
        const productKey = `${service.instance_id}:${service.packageid}`
        const groupId = productToGroupMap.get(productKey)
        const groupKey = groupId ? `${service.instance_id}:${groupId}` : null

        // Priority 1: category mapped directly to the product
        const productCat = productCategoryMap.get(productKey)
        // Priority 2: category mapped to the product group
        const groupCat = groupKey ? groupCategoryMap.get(groupKey) : undefined
        // Priority 3: product group name (fallback)
        const fallbackGroupName = groupKey ? (groupNameMap.get(groupKey) || 'Unknown Group') : 'Uncategorized'

        const resolvedName = productCat?.name ?? groupCat?.name ?? fallbackGroupName
        const resolvedColor = productCat?.color ?? groupCat?.color ?? ''
        const hasCategory = !!(productCat || groupCat)

        if (hasCategory) categorizedMRR += monthlyAmount

        groupMRR[resolvedName] = (groupMRR[resolvedName] || 0) + monthlyAmount
        totalMRR += monthlyAmount

        // Track color for this group (use category color when available)
        if (!groupTotals.has(resolvedName)) {
          groupTotals.set(resolvedName, { total: 0, color: resolvedColor })
        } else if (resolvedColor && !groupTotals.get(resolvedName)!.color) {
          groupTotals.get(resolvedName)!.color = resolvedColor
        }
        groupTotals.get(resolvedName)!.total += monthlyAmount
      })

      // Add recurring billable items active during this month
      billableWithStart.forEach(item => {
        if (!billableWasActiveAt(item.startDate, item.recurfor, item.cycleMonths, monthEnd)) return

        groupMRR[item.categoryName] = (groupMRR[item.categoryName] || 0) + item.monthlyMrr
        totalMRR += item.monthlyMrr
        categorizedMRR += item.categoryName !== 'Uncategorized' ? item.monthlyMrr : 0

        if (!groupTotals.has(item.categoryName)) {
          groupTotals.set(item.categoryName, { total: 0, color: item.categoryColor })
        } else if (item.categoryColor && !groupTotals.get(item.categoryName)!.color) {
          groupTotals.get(item.categoryName)!.color = item.categoryColor
        }
        groupTotals.get(item.categoryName)!.total += item.monthlyMrr
      })

      // Use last month for category coverage calculation
      if (i === 11) {
        lastMonthCategorizedMRR = categorizedMRR
        lastMonthTotalMRR = totalMRR
      }

      monthlyData.push({
        month: monthKey,
        total: Math.round(totalMRR * 100) / 100,
        groups: Object.fromEntries(
          Object.entries(groupMRR).map(([k, v]) => [k, Math.round(v * 100) / 100])
        ),
      })
    }

    // --- Determine category mode based on last month ---
    const uncategorizedMrrPct = lastMonthTotalMRR > 0
      ? Math.round(((lastMonthTotalMRR - lastMonthCategorizedMRR) / lastMonthTotalMRR) * 10000) / 100
      : 0
    const usingCategories = lastMonthTotalMRR > 0 && (lastMonthCategorizedMRR / lastMonthTotalMRR) >= 0.5

    // Get all groups sorted by total MRR (for selector and default selection)
    const allGroups: GroupInfo[] = Array.from(groupTotals.entries())
      .map(([name, info], index) => ({
        id: index,
        name,
        color: info.color || GROUP_COLORS[index % GROUP_COLORS.length],
        total_mrr: Math.round(info.total * 100) / 100,
      }))
      .sort((a, b) => b.total_mrr - a.total_mrr)

    // Assign fallback colors after sorting (only where no category color exists)
    allGroups.forEach((group, index) => {
      if (!group.color) {
        group.color = GROUP_COLORS[index % GROUP_COLORS.length]
      }
    })

    // Top 5 groups by default
    const defaultGroups = allGroups.slice(0, 5).map(g => g.name)

    return success({
      monthly_data: monthlyData,
      all_groups: allGroups,
      default_groups: defaultGroups,
      using_categories: usingCategories,
      uncategorized_mrr_pct: uncategorizedMrrPct,
    }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/metrics/mrr-trend:', err)
    return error(err instanceof Error ? err : new Error('Failed to get MRR trend'))
  }
}
