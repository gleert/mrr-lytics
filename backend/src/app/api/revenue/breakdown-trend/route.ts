import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'
import { parseDateRange } from '@/utils/date-helpers'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>

const GROUP_COLORS = [
  '#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#EC4899', '#06B6D4', '#8B5CF6', '#F97316', '#14B8A6',
]

/**
 * GET /api/revenue/breakdown-trend
 *
 * Returns revenue over time broken down by category, source, or type.
 * Each data point has a date + one key per group with the revenue for that bucket.
 *
 * Always returns `categories_available` so the frontend can decide whether to
 * show the "By Category" tab regardless of which group_by is active.
 *
 * `categories_available = true` when ≥50% of total invoice revenue has a real
 * category mapping (product-level or group-level). Same threshold as mrr-breakdown.
 *
 * Query params:
 *   - group_by: 'category' | 'source' | 'type'  (default: 'source')
 *   - period: preset period string               (default: '30d')
 *   - instance_ids: comma-separated instance IDs
 */
export async function GET(request: NextRequest) {
  try {
    const headersList = await headers()
    const auth = getAuthContext(headersList)

    if (!auth) throw new UnauthorizedError('Authentication required')

    const { searchParams } = new URL(request.url)
    const instanceIdsParam = searchParams.get('instance_ids')
    const instanceIdParam = searchParams.get('instance_id')
    const groupBy = (searchParams.get('group_by') || 'source') as 'category' | 'source' | 'type'
    const period = searchParams.get('period') || '30d'

    let instanceIds: string[] = []
    if (instanceIdsParam) {
      instanceIds = instanceIdsParam.split(',').filter(id => id.trim())
    } else if (instanceIdParam) {
      instanceIds = [instanceIdParam]
    }

    if (instanceIds.length === 0) throw new Error('No instance specified')

    const { startDate, endDate, days } = parseDateRange(period, null, null)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get invoices in period (Paid + Unpaid)
    const { data: invoices, error: invoicesError } = await supabase
      .from('whmcs_invoices')
      .select('whmcs_id, total, datepaid, date, status')
      .in('instance_id', instanceIds)
      .in('status', ['Paid', 'Unpaid', 'Payment Pending'])
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString())
      .order('date', { ascending: true })

    if (invoicesError) {
      console.error('Invoices query error:', invoicesError)
      return success({ trend: [], groups: [], group_by: groupBy, categories_available: false }, { instance_ids: instanceIds })
    }

    if (!invoices || invoices.length === 0) {
      return success({ trend: [], groups: [], group_by: groupBy, categories_available: false }, { instance_ids: instanceIds })
    }

    // Get invoice items (in batches) + category lookup data — in parallel
    const invoiceWhmcsIds = invoices.map(i => i.whmcs_id)
    const BATCH_SIZE = 500
    const allItems: { invoice_id: number; type: string; amount: number; relid: number | null; instance_id: string }[] = []

    // Fetch items (sequential batches) + category maps (parallel)
    const [categoryMaps] = await Promise.all([
      buildCategoryMaps(supabase, instanceIds),
      (async () => {
        for (let i = 0; i < invoiceWhmcsIds.length; i += BATCH_SIZE) {
          const batch = invoiceWhmcsIds.slice(i, i + BATCH_SIZE)
          const { data: batchItems } = await supabase
            .from('whmcs_invoice_items')
            .select('invoice_id, type, amount, relid, instance_id')
            .in('instance_id', instanceIds)
            .in('invoice_id', batch)

          if (batchItems) {
            allItems.push(...batchItems.map(item => ({
              invoice_id: item.invoice_id as number,
              type: (item.type as string) || 'Other',
              amount: Number(item.amount) || 0,
              relid: item.relid as number | null,
              instance_id: item.instance_id as string,
            })))
          }
        }
      })(),
    ])

    // Build per-item resolver based on groupBy
    const resolver = buildResolver(groupBy, categoryMaps)

    // Build a map: invoice_id → Map<groupName, {revenue, hasCategory}>
    const invoiceGroups = new Map<number, Map<string, { revenue: number; hasCategory: boolean }>>()

    for (const item of allItems) {
      if (item.amount === 0) continue
      const { name: groupName, hasCategory } = resolver(item)
      const existing = invoiceGroups.get(item.invoice_id) || new Map<string, { revenue: number; hasCategory: boolean }>()
      const prev = existing.get(groupName) || { revenue: 0, hasCategory }
      existing.set(groupName, {
        revenue: prev.revenue + item.amount,
        hasCategory: prev.hasCategory || hasCategory,
      })
      invoiceGroups.set(item.invoice_id, existing)
    }

    // -----------------------------------------------------------------------
    // Compute categories_available: ≥50% of total revenue has a real category
    // This is computed regardless of the current groupBy, using categoryMaps.
    // -----------------------------------------------------------------------
    let totalRevenue = 0
    let categorizedRevenue = 0

    for (const invoice of invoices) {
      const groups = invoiceGroups.get(invoice.whmcs_id)
      if (!groups) {
        totalRevenue += Number(invoice.total) || 0
        continue
      }
      groups.forEach(({ revenue, hasCategory }) => {
        totalRevenue += revenue
        if (hasCategory) categorizedRevenue += revenue
      })
    }

    const categoriesAvailable = totalRevenue > 0 && (categorizedRevenue / totalRevenue) >= 0.5

    // -----------------------------------------------------------------------
    // Build temporal trend
    // -----------------------------------------------------------------------
    const aggregateByWeek = days > 90
    const getDateKey = (dateStr: string): string => {
      const date = new Date(dateStr)
      if (aggregateByWeek) {
        const dayOfWeek = date.getDay()
        const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
        const monday = new Date(date)
        monday.setDate(diff)
        return monday.toISOString().split('T')[0]
      }
      return date.toISOString().split('T')[0]
    }

    const allGroupNames = new Set<string>()
    const trendMap = new Map<string, Map<string, number>>()

    for (const invoice of invoices) {
      const key = getDateKey(invoice.datepaid || invoice.date)
      const groups = invoiceGroups.get(invoice.whmcs_id)

      if (!groups || groups.size === 0) {
        const total = Number(invoice.total) || 0
        const fallbackGroup = groupBy === 'type' ? 'Recurring' : 'Other'
        allGroupNames.add(fallbackGroup)
        const bucket = trendMap.get(key) || new Map<string, number>()
        bucket.set(fallbackGroup, (bucket.get(fallbackGroup) || 0) + total)
        trendMap.set(key, bucket)
        continue
      }

      const bucket = trendMap.get(key) || new Map<string, number>()
      groups.forEach(({ revenue }, groupName) => {
        allGroupNames.add(groupName)
        bucket.set(groupName, (bucket.get(groupName) || 0) + revenue)
      })
      trendMap.set(key, bucket)
    }

    // Fill timeline
    const sortedGroupNames = Array.from(allGroupNames).sort()
    const trend: Array<Record<string, string | number>> = []
    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      const key = getDateKey(currentDate.toISOString().split('T')[0])

      if (aggregateByWeek && trend.length > 0 && trend[trend.length - 1].date === key) {
        currentDate.setDate(currentDate.getDate() + 1)
        continue
      }

      const bucket = trendMap.get(key)
      const point: Record<string, string | number> = { date: key }
      let total = 0

      sortedGroupNames.forEach(name => {
        const val = bucket ? Math.round((bucket.get(name) || 0) * 100) / 100 : 0
        point[name] = val
        total += val
      })

      point.total = Math.round(total * 100) / 100
      trend.push(point)

      currentDate.setDate(currentDate.getDate() + (aggregateByWeek ? 7 : 1))
    }

    // Build group metadata with colors; apply category colors when available
    const groups = sortedGroupNames.map((name, index) => ({
      name,
      color: categoryMaps.categoryColorMap.get(name) || GROUP_COLORS[index % GROUP_COLORS.length],
    }))

    return success({
      trend,
      groups,
      group_by: groupBy,
      categories_available: categoriesAvailable,
      aggregation: aggregateByWeek ? 'week' : 'day',
      period: {
        type: period,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        days,
      },
    }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/revenue/breakdown-trend:', err)
    return error(err instanceof Error ? err : new Error('Failed to get revenue breakdown trend'))
  }
}

// ---------------------------------------------------------------------------
// Category lookup maps — built once, used by resolver + coverage calculation
// ---------------------------------------------------------------------------
interface CategoryMaps {
  serviceToProductMap: Map<string, number>       // `inst:serviceId` → packageId
  productToGroupMap: Map<string, number>          // `inst:productId` → groupId
  groupNameMap: Map<string, string>               // `inst:groupId`   → group name
  productCategoryMap: Map<string, string>         // `inst:productId` → category name
  groupCategoryMap: Map<string, string>           // `inst:groupId`   → category name
  categoryColorMap: Map<string, string>           // category name    → color
}

async function buildCategoryMaps(
  supabase: AnySupabaseClient,
  instanceIds: string[]
): Promise<CategoryMaps> {
  const [
    { data: products },
    { data: productGroups },
    { data: mappings },
    { data: hostingServices },
  ] = await Promise.all([
    supabase.from('whmcs_products').select('whmcs_id, gid, instance_id').in('instance_id', instanceIds),
    supabase.from('whmcs_product_groups').select('whmcs_id, name, instance_id').in('instance_id', instanceIds),
    supabase.from('category_mappings').select('instance_id, mapping_type, whmcs_id, categories(id, name, color)').in('instance_id', instanceIds),
    supabase.from('whmcs_hosting').select('whmcs_id, packageid, instance_id').in('instance_id', instanceIds),
  ])

  const groupNameMap = new Map<string, string>()
  productGroups?.forEach(g => {
    groupNameMap.set(`${g.instance_id}:${g.whmcs_id}`, g.name || 'Unknown Group')
  })

  const productToGroupMap = new Map<string, number>()
  products?.forEach(p => {
    productToGroupMap.set(`${p.instance_id}:${p.whmcs_id}`, p.gid)
  })

  const productCategoryMap = new Map<string, string>()
  const groupCategoryMap = new Map<string, string>()
  const categoryColorMap = new Map<string, string>()

  mappings?.forEach((m: any) => {
    if (!m.categories) return
    const key = `${m.instance_id}:${m.whmcs_id}`
    const catName = m.categories.name as string
    const catColor = m.categories.color as string
    if (m.mapping_type === 'product') productCategoryMap.set(key, catName)
    else if (m.mapping_type === 'product_group') groupCategoryMap.set(key, catName)
    if (catColor) categoryColorMap.set(catName, catColor)
  })

  const serviceToProductMap = new Map<string, number>()
  hostingServices?.forEach(s => {
    serviceToProductMap.set(`${s.instance_id}:${s.whmcs_id}`, s.packageid as number)
  })

  return { serviceToProductMap, productToGroupMap, groupNameMap, productCategoryMap, groupCategoryMap, categoryColorMap }
}

// ---------------------------------------------------------------------------
// Resolver — maps each invoice item → { name, hasCategory }
// hasCategory=true only when a real category mapping was used (not a fallback)
// ---------------------------------------------------------------------------
interface ResolvedGroup { name: string; hasCategory: boolean }

function buildResolver(
  groupBy: 'category' | 'source' | 'type',
  maps: CategoryMaps
): (item: { type: string; relid: number | null; instance_id: string }) => ResolvedGroup {

  if (groupBy === 'source') {
    const sourceMapping: Record<string, string> = {
      Hosting: 'Hosting', Domain: 'Domains', DomainRenew: 'Domains',
      DomainRegister: 'Domains', DomainTransfer: 'Domains',
      Addon: 'Addons', Setup: 'Setup Fees', PromoHosting: 'Promotions',
      Item: 'Other Items', Invoice: 'Manual Charges', LateFee: 'Late Fees', Upgrade: 'Upgrades',
    }
    return (item) => ({ name: sourceMapping[item.type] || 'Other', hasCategory: false })
  }

  if (groupBy === 'type') {
    const recurringTypes = ['Hosting', 'DomainRenew', 'Domain']
    return (item) => ({ name: recurringTypes.includes(item.type) ? 'Recurring' : 'One-time', hasCategory: false })
  }

  // groupBy === 'category'
  const { serviceToProductMap, productToGroupMap, groupNameMap, productCategoryMap, groupCategoryMap } = maps

  return (item): ResolvedGroup => {
    if (item.type === 'Hosting' && item.relid) {
      const packageId = serviceToProductMap.get(`${item.instance_id}:${item.relid}`)
      if (packageId !== undefined) {
        const productKey = `${item.instance_id}:${packageId}`

        const productCat = productCategoryMap.get(productKey)
        if (productCat) return { name: productCat, hasCategory: true }

        const groupId = productToGroupMap.get(productKey)
        if (groupId !== undefined) {
          const groupKey = `${item.instance_id}:${groupId}`
          const groupCat = groupCategoryMap.get(groupKey)
          if (groupCat) return { name: groupCat, hasCategory: true }
          // Fallback to WHMCS group name — NOT a real category
          return { name: groupNameMap.get(groupKey) || 'Unknown Group', hasCategory: false }
        }
      }
    }

    if (item.type === 'Domain' || item.type === 'DomainRenew' || item.type === 'DomainRegister')
      return { name: 'Domains', hasCategory: false }
    if (item.type === 'Setup') return { name: 'Setup Fees', hasCategory: false }
    if (item.type === 'Addon') return { name: 'Addons', hasCategory: false }
    return { name: 'Other', hasCategory: false }
  }
}
