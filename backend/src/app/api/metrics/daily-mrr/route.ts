import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'

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

    const days = Math.min(90, Math.max(30, parseInt(daysParam, 10) || 30))

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get all active hosting services + billable items in parallel
    const [
      { data: hostingServices, error: hostingError },
      { data: billableItems },
      { data: categoryMappings, error: mappingsError },
      { data: billableMappings },
    ] = await Promise.all([
      supabase
        .from('whmcs_hosting')
        .select('id, instance_id, whmcs_id, packageid, amount, billingcycle, domainstatus, regdate, nextduedate, terminationdate')
        .in('instance_id', instanceIds)
        .in('domainstatus', ['Active', 'Suspended']),
      supabase
        .from('whmcs_billable_items')
        .select('instance_id, whmcs_id, amount, recurcycle, recurfor, invoicecount')
        .in('instance_id', instanceIds)
        .eq('invoice_action', 4)
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

    // Pre-compute billable items MRR per category (constant across all days)
    // Filter in JS: column-to-column OR comparisons don't work in PostgREST .or()
    const activeBillableItems = (billableItems ?? []).filter(
      item => (item.recurfor ?? 0) === 0 || (item.invoicecount ?? 0) < (item.recurfor ?? 0)
    )
    const billableDailyMRR: Array<{ monthlyMrr: number; category: { name: string; color: string } }> = []
    activeBillableItems.forEach(item => {
      const monthlyMrr = toMonthlyAmount(Number(item.amount) || 0, item.recurcycle || '')
      if (monthlyMrr === 0) return
      const key = `${item.instance_id}:${item.whmcs_id}`
      const cat = billableCategoryMap.get(key) ?? { name: 'Uncategorized', color: '#6B7280' }
      categoryColors[cat.name] = cat.color
      billableDailyMRR.push({ monthlyMrr, category: cat })
    })
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

      // Add recurring billable items (active items are constant across all days in range)
      billableDailyMRR.forEach(({ monthlyMrr, category }) => {
        categoryTotals[category.name] = (categoryTotals[category.name] || 0) + monthlyMrr
        totalMRR += monthlyMrr
      })

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
