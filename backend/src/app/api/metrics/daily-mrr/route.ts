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

    // Get all active hosting services with their products
    const { data: hostingServices, error: hostingError } = await supabase
      .from('whmcs_hosting')
      .select(`
        id,
        instance_id,
        whmcs_id,
        packageid,
        amount,
        billingcycle,
        domainstatus,
        regdate,
        nextduedate,
        terminationdate,
        monthly_amount
      `)
      .in('instance_id', instanceIds)
      .in('domainstatus', ['Active', 'Suspended'])

    if (hostingError) {
      console.error('Hosting query error:', hostingError)
      throw new Error('Failed to fetch hosting data')
    }

    // Get category mappings for these instances
    const { data: categoryMappings, error: mappingsError } = await supabase
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
      .eq('mapping_type', 'product')

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

    // Generate daily data points
    const dailyData: DailyMRRPoint[] = []
    const categoryColors: Record<string, string> = {}
    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0]
      const categoryTotals: Record<string, number> = {}
      let totalMRR = 0
      let pendingChurn = 0

      hostingServices?.forEach(service => {
        const amount = service.monthly_amount || toMonthlyAmount(
          Number(service.amount) || 0,
          service.billingcycle || 'monthly'
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
