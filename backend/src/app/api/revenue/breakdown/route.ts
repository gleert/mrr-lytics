import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'
import { parseDateRange } from '@/utils/date-helpers'
import {
  fetchRecurringBillableSet,
  isRecurringItem,
} from '@/lib/metrics/revenue-classification'
import { getRevenueInvoiceStatuses } from '@/lib/tenants/settings'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>

/**
 * GET /api/revenue/breakdown - Get revenue breakdown by different dimensions
 * 
 * Query params:
 * - group_by: 'category' | 'source' | 'type' (default: 'category')
 * - instance_ids: Comma-separated list of instance IDs
 * - period: Preset period
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
    const groupBy = searchParams.get('group_by') || 'category'
    const period = searchParams.get('period') || '30d'
    const startDateParam = searchParams.get('start_date')
    const endDateParam = searchParams.get('end_date')

    let instanceIds: string[] = []
    if (instanceIdsParam) {
      instanceIds = instanceIdsParam.split(',').filter(id => id.trim())
    } else if (instanceIdParam) {
      instanceIds = [instanceIdParam]
    }

    if (instanceIds.length === 0) {
      throw new Error('No instance specified')
    }

    const { startDate, endDate } = parseDateRange(period, startDateParam, endDateParam)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const revenueStatuses = await getRevenueInvoiceStatuses(supabase, auth.tenant_id)

    // Get invoices in period
    const { data: invoices, error: invoicesError } = await supabase
      .from('whmcs_invoices')
      .select('whmcs_id')
      .in('instance_id', instanceIds)
      .in('status', revenueStatuses)
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString())
      .limit(10000)

    if (invoicesError) {
      console.error('Invoices query error:', invoicesError)
      // Return empty breakdown instead of failing
      return success({ breakdown: [], group_by: groupBy, _notice: 'No data synced yet' }, { instance_ids: instanceIds })
    }

    const invoiceWhmcsIds = invoices?.map(i => i.whmcs_id) || []

    if (invoiceWhmcsIds.length === 0) {
      return success({ breakdown: [], group_by: groupBy })
    }

    // Get invoice items with related data
    // Process in batches if too many invoices to avoid query limits
    type InvoiceItem = {
      type: string
      amount: number
      description: string
      relid: number | null
      instance_id: string
    }
    let invoiceItems: InvoiceItem[] = []
    const BATCH_SIZE = 500

    for (let i = 0; i < invoiceWhmcsIds.length; i += BATCH_SIZE) {
      const batch = invoiceWhmcsIds.slice(i, i + BATCH_SIZE)
      const { data: batchItems, error: itemsError } = await supabase
        .from('whmcs_invoice_items')
        .select('type, amount, description, relid, instance_id')
        .in('instance_id', instanceIds)
        .in('invoice_id', batch)

      if (itemsError) {
        console.error('Invoice items query error:', itemsError)
        throw new Error('Failed to fetch invoice items')
      }

      if (batchItems) {
        // Convert nullable fields to non-null with defaults
        const normalized = batchItems.map(item => ({
          type: item.type || 'Other',
          amount: Number(item.amount) || 0,
          description: item.description || '',
          relid: item.relid,
          instance_id: item.instance_id,
        }))
        invoiceItems.push(...normalized)
      }
    }

    // Load recurring billable item set once — reused for getBreakdownByType
    const recurringBillableSet = await fetchRecurringBillableSet(supabase, instanceIds)

    let breakdown: { name: string; value: number; color?: string }[] = []

    switch (groupBy) {
      case 'category':
        breakdown = await getBreakdownByCategory(supabase, invoiceItems || [], instanceIds)
        break
      case 'source':
        breakdown = getBreakdownBySource(invoiceItems || [])
        break
      case 'type':
        breakdown = getBreakdownByType(invoiceItems || [], recurringBillableSet)
        break
      default:
        breakdown = await getBreakdownByCategory(supabase, invoiceItems || [], instanceIds)
    }

    // Sort by value descending
    breakdown.sort((a, b) => b.value - a.value)

    return success({ breakdown, group_by: groupBy }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/revenue/breakdown:', err)
    return error(err instanceof Error ? err : new Error('Failed to get revenue breakdown'))
  }
}

/**
 * Group revenue by custom categories (with fallback to WHMCS product groups)
 * 
 * Priority:
 * 1. Custom category mapping for the product
 * 2. Custom category mapping for the product group
 * 3. WHMCS product group name
 * 4. Item type (Domains, Setup Fees, etc.)
 */
async function getBreakdownByCategory(
  supabase: AnySupabaseClient,
  items: Array<{ type: string; amount: number; description: string; relid: number | null }>,
  instanceIds: string[]
): Promise<{ name: string; value: number; color?: string }[]> {
  // Get all products with their WHMCS IDs
  const { data: products } = await supabase
    .from('whmcs_products')
    .select('id, whmcs_id, name, gid, instance_id')
    .in('instance_id', instanceIds)

  const { data: productGroups } = await supabase
    .from('whmcs_product_groups')
    .select('id, whmcs_id, name, instance_id')
    .in('instance_id', instanceIds)

  // Get custom category mappings
  const { data: categoryMappings } = await supabase
    .from('category_mappings')
    .select(`
      instance_id,
      mapping_type,
      whmcs_id,
      categories (
        id,
        name,
        color
      )
    `)
    .in('instance_id', instanceIds)

  // Create lookup maps for products (by instance_id:whmcs_id)
  const productMap = new Map<string, { whmcs_id: number; gid: number | null; instance_id: string }>(
    products?.map(p => [`${p.instance_id}:${p.whmcs_id}`, { whmcs_id: p.whmcs_id, gid: p.gid, instance_id: p.instance_id }]) || []
  )
  
  // Map from product group (instance_id:whmcs_id) to group name
  const groupMap = new Map<string, string>(
    productGroups?.map(g => [`${g.instance_id}:${g.whmcs_id}`, g.name]) || []
  )

  // Create lookup maps for category mappings
  // Key format: instance_id:mapping_type:whmcs_id
  const productCategoryMap = new Map<string, { name: string; color: string }>()
  const groupCategoryMap = new Map<string, { name: string; color: string }>()
  
  categoryMappings?.forEach(mapping => {
    // categories is a single joined object (not an array) due to the FK relationship
    const cat = mapping.categories as unknown as { id: string; name: string; color: string } | null
    if (!cat) return
    
    const key = `${mapping.instance_id}:${mapping.whmcs_id}`
    if (mapping.mapping_type === 'product') {
      productCategoryMap.set(key, { name: cat.name, color: cat.color })
    } else if (mapping.mapping_type === 'product_group') {
      groupCategoryMap.set(key, { name: cat.name, color: cat.color })
    }
  })

  // Get hosting services to map relid to product whmcs_id
  const { data: hostingServices } = await supabase
    .from('whmcs_hosting')
    .select('whmcs_id, packageid, instance_id')
    .in('instance_id', instanceIds)

  // Map from hosting service whmcs_id to product whmcs_id (packageid)
  const serviceToProductMap = new Map<string, { packageid: number; instance_id: string }>(
    hostingServices?.map(s => [`${s.instance_id}:${s.whmcs_id}`, { packageid: s.packageid, instance_id: s.instance_id }]) || []
  )

  // Map from product whmcs_id to product info
  const whmcsIdToProductMap = new Map<string, { gid: number | null; instance_id: string }>(
    products?.map(p => [`${p.instance_id}:${p.whmcs_id}`, { gid: p.gid, instance_id: p.instance_id }]) || []
  )

  const categoryTotals = new Map<string, { value: number; color?: string }>()

  const addToCategory = (categoryName: string, amount: number, color?: string) => {
    const existing = categoryTotals.get(categoryName)
    if (existing) {
      existing.value += amount
    } else {
      categoryTotals.set(categoryName, { value: amount, color })
    }
  }

  // We need instance_id context for each item - get invoice items with instance info
  const { data: invoiceItemsWithInstance } = await supabase
    .from('whmcs_invoice_items')
    .select('whmcs_id, type, amount, relid, instance_id')
    .in('instance_id', instanceIds)

  // Create a map for quick lookup
  const itemInstanceMap = new Map<number, string>()
  invoiceItemsWithInstance?.forEach(i => {
    if (i.whmcs_id) itemInstanceMap.set(i.whmcs_id, i.instance_id)
  })

  items.forEach(item => {
    const amount = Number(item.amount) || 0
    if (amount === 0) return

    let categoryName = 'Other'
    let categoryColor: string | undefined

    if (item.type === 'Hosting' && item.relid) {
      // Try to find the category for this hosting item
      // We need to find which instance this belongs to - we'll check all instances
      for (const instanceId of instanceIds) {
        const serviceKey = `${instanceId}:${item.relid}`
        const serviceInfo = serviceToProductMap.get(serviceKey)
        
        if (serviceInfo) {
          const productKey = `${instanceId}:${serviceInfo.packageid}`
          
          // 1. Check for direct product category mapping
          const productCategory = productCategoryMap.get(productKey)
          if (productCategory) {
            categoryName = productCategory.name
            categoryColor = productCategory.color
            break
          }
          
          // 2. Check for product group category mapping
          const productInfo = whmcsIdToProductMap.get(productKey)
          if (productInfo?.gid) {
            const groupKey = `${instanceId}:${productInfo.gid}`
            const groupCategory = groupCategoryMap.get(groupKey)
            if (groupCategory) {
              categoryName = groupCategory.name
              categoryColor = groupCategory.color
              break
            }
            
            // 3. Fallback to WHMCS product group name
            const groupName = groupMap.get(groupKey)
            if (groupName) {
              categoryName = groupName
              break
            }
          }
        }
      }
    } else if (item.type === 'Domain' || item.type === 'DomainRenew' || item.type === 'DomainRegister') {
      categoryName = 'Domains'
    } else if (item.type === 'Setup') {
      categoryName = 'Setup Fees'
    } else if (item.type === 'Addon') {
      categoryName = 'Addons'
    }

    addToCategory(categoryName, amount, categoryColor)
  })

  return Array.from(categoryTotals.entries()).map(([name, data]) => ({
    name,
    value: Math.round(data.value * 100) / 100,
    color: data.color,
  }))
}

/**
 * Group revenue by source (Hosting, Domains, Addons, etc.)
 */
function getBreakdownBySource(
  items: Array<{ type: string; amount: number; description: string; relid: number | null }>
): { name: string; value: number }[] {
  const sourceTotals = new Map<string, number>()

  const sourceMapping: Record<string, string> = {
    'Hosting': 'Hosting',
    'Domain': 'Domains',
    'DomainRenew': 'Domains',
    'DomainRegister': 'Domains',
    'DomainTransfer': 'Domains',
    'Addon': 'Addons',
    'Setup': 'Setup Fees',
    'PromoHosting': 'Promotions',
    'Item': 'Other Items',
    'Invoice': 'Manual Charges',
    'LateFee': 'Late Fees',
    'Upgrade': 'Upgrades',
  }

  items.forEach(item => {
    const amount = Number(item.amount) || 0
    const sourceName = sourceMapping[item.type] || 'Other'
    sourceTotals.set(sourceName, (sourceTotals.get(sourceName) || 0) + amount)
  })

  return Array.from(sourceTotals.entries()).map(([name, value]) => ({
    name,
    value: Math.round(value * 100) / 100,
  }))
}

/**
 * Group revenue by type (Recurring vs One-time)
 */
function getBreakdownByType(
  items: Array<{
    type: string
    amount: number
    description: string
    relid: number | null
    instance_id: string
  }>,
  recurringBillableSet: Set<string>,
): { name: string; value: number }[] {
  let recurring = 0
  let onetime = 0

  items.forEach(item => {
    const amount = Number(item.amount) || 0
    if (isRecurringItem(item.type, item.relid, item.instance_id, recurringBillableSet)) {
      recurring += amount
    } else {
      onetime += amount
    }
  })

  return [
    { name: 'Recurring', value: Math.round(recurring * 100) / 100 },
    { name: 'One-time', value: Math.round(onetime * 100) / 100 },
  ].filter(item => item.value > 0)
}
