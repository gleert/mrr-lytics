import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'
import {
  toMonthlyAmount,
  getCycleMonths,
  billableActiveAt,
  hostingActiveInMonth,
  domainActiveInMonth,
  domainMonthlyMrr,
  applyDerivedTerminations,
} from '@/lib/metrics/committed-mrr'
import { buildMonthWindow, monthStartOf, monthEndOf } from '@/lib/metrics/month-window'

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

    // Date range: the last 12 calendar months, ending with the current one. Built
    // via buildMonthWindow, NOT setMonth+setDate(1) -- see month-window.ts for why
    // the naive version shifts the window forward a month on the 29th-31st.
    const { start: startDate, keys: monthKeys } = buildMonthWindow(12)

    // --- Fetch all needed data in parallel ---
    const mdSinceStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`
    const [
      { data: hostingServices, error: hostingError },
      { data: products },
      { data: productGroups },
      { data: mappings },
      { data: billableItems },
      { data: domainServices },
      { data: metricsDaily },
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
        .select('instance_id, whmcs_id, amount, recurcycle, recur, invoicecount, recurfor, duedate, invoice_action, cancelled_at')
        .in('instance_id', instanceIds)
        .gt('invoicecount', 0)
        .limit(10000),
      supabase
        .from('whmcs_domains')
        .select('recurringamount, registrationperiod, registrationdate, expirydate')
        .in('instance_id', instanceIds)
        .eq('status', 'Active'),
      // Ground-truth committed MRR per day (same source as the daily-MRR chart and
      // the live KPI). Used to anchor each month's TOTAL so the by-category line
      // reconciles exactly with the daily chart; categories are scaled to it.
      supabase
        .from('metrics_daily')
        .select('instance_id, date, mrr')
        .in('instance_id', instanceIds)
        .gte('date', mdSinceStr)
        .order('date', { ascending: true })
        .limit(100000),
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

    type BillableItemWithStart = {
      startDate: Date
      cycleMonths: number
      recurfor: number
      invoiceAction: number
      cancelledAt: Date | null
      dueDate: Date
      monthlyMrr: number
      instance_id?: string
      whmcs_id?: number
      derivedTerm?: Date | null
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
        invoiceAction: item.invoice_action ?? 0,
        cancelledAt: item.cancelled_at ? new Date(item.cancelled_at) : null,
        dueDate,
        monthlyMrr,
        instance_id: item.instance_id,
        whmcs_id: item.whmcs_id,
        categoryName: cat?.name ?? 'Uncategorized',
        categoryColor: cat?.color ?? '',
      }]
    })

    const now = new Date()
    const nowTs = now.getTime()
    // Recover real churn dates for undated cancellations (e.g. the €5125 Magento
    // retainer) so the by-category line keeps them active up to their true churn
    // day and matches the daily-MRR chart, instead of dropping them from every
    // past month via the coarse future-lapse guard.
    await applyDerivedTerminations(supabase, billableWithStart, now)

    // Per-instance metrics_daily series (sorted asc) for total anchoring.
    const mdByInstance = new Map<string, { date: string; mrr: number }[]>()
    for (const r of metricsDaily ?? []) {
      const list = mdByInstance.get(r.instance_id)
      const row = { date: r.date as string, mrr: Number(r.mrr) || 0 }
      if (list) list.push(row)
      else mdByInstance.set(r.instance_id, [row])
    }
    // Ground-truth committed MRR as of a month-end: sum across instances of each
    // instance's latest snapshot on/before that date. Returns null when NO
    // instance has a snapshot in range (then we keep the raw reconstruction).
    const trueTotalAsOf = (monthEndStr: string): number | null => {
      let sum = 0
      let any = false
      for (const list of mdByInstance.values()) {
        let val: number | null = null
        for (const row of list) {
          if (row.date <= monthEndStr) val = row.mrr
          else break
        }
        if (val !== null) { sum += val; any = true }
      }
      return any ? sum : null
    }

    // Generate 12 months of data
    const monthlyData: MonthlyDataPoint[] = []
    const groupTotals = new Map<string, { total: number; color: string }>()
    // Category → color, resolved as we go; folded into groupTotals after scaling.
    const groupColor = new Map<string, string>()

    // Track category coverage across all months (use last month as representative)
    let lastMonthCategorizedMRR = 0
    let lastMonthTotalMRR = 0

    for (let i = 0; i < 12; i++) {
      const monthDate = monthStartOf(startDate, i)
      // End-of-day on the last day, so a service registered on the 31st still
      // counts. The old version inherited the request's time-of-day here.
      const monthEnd = monthEndOf(startDate, i)

      // Local calendar month, NOT toISOString(): for a local time whose UTC
      // equivalent lands on the previous day (e.g. 00:30 in UTC+2), toISOString
      // would label the month one behind.
      const monthKey = monthKeys[i]
      const groupMRR: Record<string, number> = {}
      let totalMRR = 0
      let categorizedMRR = 0

      hostingServices?.forEach(service => {
        // Active during this month? (Suspended excluded to match mv_mrr_current)
        if (!hostingActiveInMonth(service, monthDate, monthEnd)) {
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
        if (resolvedColor && !groupColor.get(resolvedName)) groupColor.set(resolvedName, resolvedColor)
      })

      // Add recurring billable items active during this month
      billableWithStart.forEach(item => {
        if (!billableActiveAt(item, monthEnd, nowTs)) return

        groupMRR[item.categoryName] = (groupMRR[item.categoryName] || 0) + item.monthlyMrr
        totalMRR += item.monthlyMrr
        categorizedMRR += item.categoryName !== 'Uncategorized' ? item.monthlyMrr : 0

        if (item.categoryColor && !groupColor.get(item.categoryName)) groupColor.set(item.categoryName, item.categoryColor)
      })

      // Add domain recurring revenue active during this month
      domainServices?.forEach(domain => {
        if (!domainActiveInMonth(domain, monthDate, monthEnd)) return

        const monthlyMrr = domainMonthlyMrr(domain)
        if (monthlyMrr === 0) return

        const groupName = 'Domains'
        groupMRR[groupName] = (groupMRR[groupName] || 0) + monthlyMrr
        totalMRR += monthlyMrr
        if (!groupColor.get(groupName)) groupColor.set(groupName, '#06B6D4')
      })

      // Use last month for category coverage calculation. Computed pre-scaling —
      // scaling is uniform so the categorized/total ratio is unchanged.
      if (i === 11) {
        lastMonthCategorizedMRR = categorizedMRR
        lastMonthTotalMRR = totalMRR
      }

      // Anchor the month TOTAL to metrics_daily (ground truth) and scale every
      // category proportionally, so the line reconciles exactly with the daily-MRR
      // chart and the live KPI. Cancelled hosting/domains and other reconstruction
      // gaps are absorbed into the total instead of silently missing. When no
      // snapshot exists for the month, keep the raw reconstruction.
      const meY = monthEnd.getFullYear()
      const meM = String(monthEnd.getMonth() + 1).padStart(2, '0')
      const meD = String(monthEnd.getDate()).padStart(2, '0')
      const trueTotal = trueTotalAsOf(`${meY}-${meM}-${meD}`)
      const factor = (trueTotal !== null && totalMRR > 0) ? trueTotal / totalMRR : 1
      const finalTotal = (trueTotal !== null && totalMRR > 0) ? trueTotal : totalMRR
      for (const name of Object.keys(groupMRR)) {
        const scaled = groupMRR[name] * factor
        groupMRR[name] = scaled
        const existing = groupTotals.get(name)
        if (!existing) groupTotals.set(name, { total: scaled, color: groupColor.get(name) || '' })
        else {
          existing.total += scaled
          if (!existing.color && groupColor.get(name)) existing.color = groupColor.get(name)!
        }
      }

      monthlyData.push({
        month: monthKey,
        total: Math.round(finalTotal * 100) / 100,
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
