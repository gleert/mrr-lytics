import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

interface GroupBreakdown {
  name: string
  mrr: number
  percentage: number
  count: number
  color: string
}

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
 * GET /api/metrics/mrr-breakdown - Get MRR breakdown by category (with fallback to product group)
 *
 * Priority for grouping each active service:
 *   1. Category mapped directly to the product
 *   2. Category mapped to the product's group
 *   3. Fallback: product group name  (triggers fallback mode)
 *
 * Returns:
 *   - breakdown: GroupBreakdown[]
 *   - total_mrr: number
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

    // --- Fetch all needed data in parallel ---
    const [
      { data: hostingServices, error: hostingError },
      { data: products },
      { data: productGroups },
      { data: mappings },
      { data: billableItems },
      { data: activeDomains },
    ] = await Promise.all([
      supabase
        .from('whmcs_hosting')
        .select('instance_id, packageid, amount, billingcycle')
        .in('instance_id', instanceIds)
        .eq('domainstatus', 'Active'),
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
        .select('instance_id, whmcs_id, amount, recurcycle, recurfor, invoicecount')
        .in('instance_id', instanceIds)
        .eq('invoice_action', 4)
        .gt('invoicecount', 0)
        .limit(10000),
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

    // --- Monthly amount helper (matches mv_mrr_current view exactly) ---
    const toMonthlyAmount = (amount: number, cycle: string): number => {
      const map: Record<string, number> = {
        monthly: 1, months: 1, month: 1,
        quarterly: 3,
        'semi-annually': 6, semiannually: 6,
        annually: 12, yearly: 12, years: 12, year: 12,
        biennially: 24, triennially: 36,
      }
      const divisor = map[cycle?.toLowerCase()]
      if (!divisor) return 0 // unknown cycle → 0, consistent with mv_mrr_current ELSE 0
      return amount / divisor
    }

    // --- Aggregate MRR by resolved group name + track category coverage ---
    const groupTotals = new Map<string, { mrr: number; count: number; color: string; hasCategory: boolean }>()
    let totalMRR = 0
    let categorizedMRR = 0

    hostingServices?.forEach(service => {
      // Always calculate from amount + billingcycle (same as mv_mrr_current view)
      // Never use monthly_amount column — it may be stale or differ from the view
      const monthlyAmount = toMonthlyAmount(Number(service.amount) || 0, service.billingcycle || '')

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

      const existing = groupTotals.get(resolvedName) || { mrr: 0, count: 0, color: resolvedColor, hasCategory }
      groupTotals.set(resolvedName, {
        mrr: existing.mrr + monthlyAmount,
        count: existing.count + 1,
        color: existing.color || resolvedColor,
        hasCategory: existing.hasCategory || hasCategory,
      })
      totalMRR += monthlyAmount
    })

    // --- Aggregate billable items MRR ---
    // Filter in JS: column-to-column OR comparisons don't work in PostgREST .or()
    const activeBillableItems = (billableItems ?? []).filter(
      item => (item.recurfor ?? 0) === 0 || (item.invoicecount ?? 0) < (item.recurfor ?? 0)
    )
    activeBillableItems.forEach(item => {
      const monthlyAmount = toMonthlyAmount(Number(item.amount) || 0, item.recurcycle || '')
      const key = `${item.instance_id}:${item.whmcs_id}`
      const cat = billableCategoryMap.get(key)
      const resolvedName = cat?.name ?? 'Uncategorized'
      const resolvedColor = cat?.color ?? ''
      const hasCategory = !!cat

      if (hasCategory) categorizedMRR += monthlyAmount

      const existing = groupTotals.get(resolvedName) || { mrr: 0, count: 0, color: resolvedColor, hasCategory }
      groupTotals.set(resolvedName, {
        mrr: existing.mrr + monthlyAmount,
        count: existing.count + 1,
        color: existing.color || resolvedColor,
        hasCategory: existing.hasCategory || hasCategory,
      })
      totalMRR += monthlyAmount
    })

    // --- Aggregate domain MRR as "Domains" group ---
    activeDomains?.forEach(domain => {
      const annual = Number(domain.recurringamount) || 0
      const period = Number(domain.registrationperiod) || 1
      const monthlyAmount = annual > 0 && period > 0 ? annual / (period * 12) : 0
      if (monthlyAmount === 0) return

      const resolvedName = 'Domains'
      const resolvedColor = '#06B6D4' // Cyan
      const existing = groupTotals.get(resolvedName) || { mrr: 0, count: 0, color: resolvedColor, hasCategory: false }
      groupTotals.set(resolvedName, {
        mrr: existing.mrr + monthlyAmount,
        count: existing.count + 1,
        color: existing.color || resolvedColor,
        hasCategory: false,
      })
      totalMRR += monthlyAmount
    })

    // --- Determine mode ---
    const uncategorizedMrrPct = totalMRR > 0
      ? Math.round(((totalMRR - categorizedMRR) / totalMRR) * 10000) / 100
      : 0
    // Use category mode when at least 50% of MRR is covered by categories
    const usingCategories = totalMRR > 0 && (categorizedMRR / totalMRR) >= 0.5

    // --- Sort and cap at 9 + Others ---
    let breakdown: GroupBreakdown[] = Array.from(groupTotals.entries())
      .map(([name, data]) => ({
        name,
        mrr: Math.round(data.mrr * 100) / 100,
        percentage: totalMRR > 0 ? Math.round((data.mrr / totalMRR) * 10000) / 100 : 0,
        count: data.count,
        color: data.color,
      }))
      .sort((a, b) => b.mrr - a.mrr)

    if (breakdown.length >= 10) {
      const top9 = breakdown.slice(0, 9)
      const others = breakdown.slice(9)
      const othersMrr = others.reduce((sum, i) => sum + i.mrr, 0)
      const othersCount = others.reduce((sum, i) => sum + i.count, 0)
      breakdown = [
        ...top9,
        {
          name: 'Others',
          mrr: Math.round(othersMrr * 100) / 100,
          percentage: totalMRR > 0 ? Math.round((othersMrr / totalMRR) * 10000) / 100 : 0,
          count: othersCount,
          color: '',
        },
      ]
    }

    // Assign fallback colors where no category color was set
    breakdown.forEach((item, index) => {
      if (item.name === 'Uncategorized') {
        item.color = '#6B7280' // Always gray for uncategorized
      } else if (!item.color) {
        item.color = GROUP_COLORS[index % GROUP_COLORS.length]
      }
    })

    return success({
      total_mrr: Math.round(totalMRR * 100) / 100,
      breakdown,
      using_categories: usingCategories,
      uncategorized_mrr_pct: uncategorizedMrrPct,
    }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/metrics/mrr-breakdown:', err)
    return error(err instanceof Error ? err : new Error('Failed to get MRR breakdown'))
  }
}
