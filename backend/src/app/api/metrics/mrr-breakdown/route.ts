import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { calculateMrrLive } from '@/lib/metrics'
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
 * GET /api/metrics/mrr-breakdown - MRR breakdown by category.
 *
 * Uses calculateMrrLive() as the single source of truth for the numbers,
 * then layers category mappings on top so total_mrr equals the main
 * /api/metrics card to the cent.
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
      instanceIds = instanceIdsParam.split(',').filter((id) => id.trim())
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

    const [
      liveMrr,
      { data: products },
      { data: productGroups },
      { data: mappings },
    ] = await Promise.all([
      calculateMrrLive(instanceIds),
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
    ])

    // --- Build lookup maps ---

    // product group id per product: `instance:productWhmcsId` → groupWhmcsId
    const productToGroupMap = new Map<string, number>()
    products?.forEach((p) => {
      productToGroupMap.set(`${p.instance_id}:${p.whmcs_id}`, p.gid)
    })

    // product group name: `instance:groupWhmcsId` → name
    const groupNameMap = new Map<string, string>()
    productGroups?.forEach((g) => {
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

    // --- Aggregate MRR by resolved group name + track category coverage ---
    const groupTotals = new Map<string, { mrr: number; count: number; color: string; hasCategory: boolean }>()
    let categorizedMRR = 0

    liveMrr.rows.hosting.forEach((service) => {
      if (service.monthly <= 0) return
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

      if (hasCategory) categorizedMRR += service.monthly

      const existing = groupTotals.get(resolvedName) || { mrr: 0, count: 0, color: resolvedColor, hasCategory }
      groupTotals.set(resolvedName, {
        mrr: existing.mrr + service.monthly,
        count: existing.count + 1,
        color: existing.color || resolvedColor,
        hasCategory: existing.hasCategory || hasCategory,
      })
    })

    liveMrr.rows.billable.forEach((item) => {
      if (item.monthly <= 0) return
      const key = `${item.instance_id}:${item.whmcs_id}`
      const cat = billableCategoryMap.get(key)
      const resolvedName = cat?.name ?? 'Uncategorized'
      const resolvedColor = cat?.color ?? ''
      const hasCategory = !!cat

      if (hasCategory) categorizedMRR += item.monthly

      const existing = groupTotals.get(resolvedName) || { mrr: 0, count: 0, color: resolvedColor, hasCategory }
      groupTotals.set(resolvedName, {
        mrr: existing.mrr + item.monthly,
        count: existing.count + 1,
        color: existing.color || resolvedColor,
        hasCategory: existing.hasCategory || hasCategory,
      })
    })

    liveMrr.rows.domains.forEach((domain) => {
      if (domain.monthly <= 0) return
      const resolvedName = 'Domains'
      const resolvedColor = '#06B6D4' // Cyan
      const existing = groupTotals.get(resolvedName) || { mrr: 0, count: 0, color: resolvedColor, hasCategory: false }
      groupTotals.set(resolvedName, {
        mrr: existing.mrr + domain.monthly,
        count: existing.count + 1,
        color: existing.color || resolvedColor,
        hasCategory: false,
      })
    })

    const totalMRR = liveMrr.total

    // --- Determine mode ---
    const uncategorizedMrrPct = totalMRR > 0
      ? Math.round(((totalMRR - categorizedMRR) / totalMRR) * 10000) / 100
      : 0
    // Use category mode when at least 50% of MRR is covered by categories
    const usingCategories = totalMRR > 0 && (categorizedMRR / totalMRR) >= 0.5

    // --- Sort and cap at 14 + Others ---
    let breakdown: GroupBreakdown[] = Array.from(groupTotals.entries())
      .map(([name, data]) => ({
        name,
        mrr: Math.round(data.mrr * 100) / 100,
        percentage: totalMRR > 0 ? Math.round((data.mrr / totalMRR) * 10000) / 100 : 0,
        count: data.count,
        color: data.color,
      }))
      .sort((a, b) => b.mrr - a.mrr)

    if (breakdown.length >= 15) {
      const top14 = breakdown.slice(0, 14)
      const others = breakdown.slice(14)
      const othersMrr = others.reduce((sum, i) => sum + i.mrr, 0)
      const othersCount = others.reduce((sum, i) => sum + i.count, 0)
      breakdown = [
        ...top14,
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
