import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

interface RevenueTransaction {
  id: string
  date: string
  invoice_id: number
  invoice_num: string
  invoice_status: string
  invoice_total: number
  client_id: number
  client_name: string
  category: string | null
  product_name: string
  type: string
  amount: number
}

/**
 * GET /api/revenue/transactions - Get paginated revenue transactions with filters
 * 
 * Query params:
 * - instance_ids: Comma-separated list of WHMCS instance IDs
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - search: Search term for client name, product, or invoice number
 * - type: Filter by item type (Hosting, Domain, Addon, etc.)
 * - category: Filter by category ID
 * - source: Filter by source (recurring, onetime)
 * - amount_min: Minimum amount filter
 * - amount_max: Maximum amount filter
 * - start_date: Start date filter (ISO format)
 * - end_date: End date filter (ISO format)
 * - status: Filter by invoice status (Paid, Unpaid, Cancelled, Refunded, Collections, all) - default: all
 * - sort_by: Sort field (date, amount, client_name) - default: date
 * - sort_order: Sort order (asc, desc) - default: desc
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

    // Parse pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(5000, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const offset = (page - 1) * limit

    // Parse filters
    const search = searchParams.get('search')?.trim() || null
    const type = searchParams.get('type') || null
    const category = searchParams.get('category') || null
    const source = searchParams.get('source') || null // 'recurring' or 'onetime'
    const amountMin = searchParams.get('amount_min') ? parseFloat(searchParams.get('amount_min')!) : null
    const amountMax = searchParams.get('amount_max') ? parseFloat(searchParams.get('amount_max')!) : null
    const startDate = searchParams.get('start_date') || null
    const endDate = searchParams.get('end_date') || null
    const statusFilter = searchParams.get('status') || 'all'

    // Parse sorting
    const sortBy = searchParams.get('sort_by') || 'date'
    const sortOrder = searchParams.get('sort_order') || 'desc'

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Use a database view or RPC approach - query invoice_items and filter by invoice status via subquery
    // For now, we'll use a simpler approach: fetch items with their invoice data using a stored procedure or view
    
    // Alternative approach: Use raw SQL via RPC or query items first then filter
    // Let's query invoice items directly and fetch invoice data separately for the page
    
    // Build items query with filters
    let itemsQuery = supabase
      .from('whmcs_invoice_items')
      .select('id, instance_id, invoice_id, client_id, type, relid, description, amount', { count: 'exact' })
      .in('instance_id', instanceIds)

    // Apply filters
    if (type) {
      itemsQuery = itemsQuery.eq('type', type)
    }

    if (amountMin !== null) {
      itemsQuery = itemsQuery.gte('amount', amountMin)
    }

    if (amountMax !== null) {
      itemsQuery = itemsQuery.lte('amount', amountMax)
    }

    // Source filter (recurring vs onetime)
    if (source === 'recurring') {
      itemsQuery = itemsQuery.in('type', ['Hosting', 'Domain', 'DomainRegister', 'DomainTransfer'])
    } else if (source === 'onetime') {
      itemsQuery = itemsQuery.in('type', ['Item', 'Addon', 'PromoHosting', 'PromoDomain', 'Invoice', 'Late Fee', 'Setup'])
    }

    // Apply sorting by amount if requested
    if (sortBy === 'amount') {
      itemsQuery = itemsQuery.order('amount', { ascending: sortOrder === 'asc' })
    } else {
      itemsQuery = itemsQuery.order('invoice_id', { ascending: false })
    }

    // Fetch enough items to have data after filtering
    // We fetch more because we need to filter by paid status client-side
    itemsQuery = itemsQuery.limit(500)

    const { data: allItems, error: itemsError } = await itemsQuery

    if (itemsError) {
      console.error('Invoice items query error:', itemsError)
      return success({
        transactions: [],
        pagination: { page, limit, total: 0, total_pages: 0 },
        filters: { types: [], categories: [], sources: ['recurring', 'onetime'] },
      }, { instance_ids: instanceIds })
    }

    if (!allItems || allItems.length === 0) {
      const { data: allCategories } = await supabase
        .from('categories')
        .select('id, name')
        .eq('is_active', true)
        .order('sort_order')

      return success({
        transactions: [],
        pagination: { page, limit, total: 0, total_pages: 0 },
        filters: { types: [], categories: allCategories || [], sources: ['recurring', 'onetime'] },
      }, { instance_ids: instanceIds })
    }

    // Get unique invoice IDs from the items we fetched
    const invoiceIds = [...new Set(allItems.map(i => i.invoice_id))]

    // Fetch invoice data for these specific invoices (limited set)
    const { data: invoices, error: invoicesError } = await supabase
      .from('whmcs_invoices')
      .select('whmcs_id, instance_id, invoicenum, date, datepaid, status, total')
      .in('instance_id', instanceIds)
      .in('whmcs_id', invoiceIds)

    if (invoicesError) {
      console.error('Invoices query error:', invoicesError)
    }

    // Create invoice lookup map
    const invoiceMap = new Map<string, { whmcs_id: number; invoicenum: string; date: string; datepaid: string; status: string; total: number }>()
    const matchingInvoiceKeys = new Set<string>()

    invoices?.forEach(inv => {
      const key = `${inv.instance_id}:${inv.whmcs_id}`
      invoiceMap.set(key, inv)

      // Filter by status
      if (statusFilter !== 'all' && inv.status !== statusFilter) return

      // Apply date filters (use datepaid for Paid, date for others)
      const refDate = inv.status === 'Paid' ? inv.datepaid : inv.date
      if (startDate && refDate && refDate < startDate) return
      if (endDate && refDate && refDate > endDate) return

      matchingInvoiceKeys.add(key)
    })

    // Filter items to those with matching invoices
    const items = allItems.filter(item => {
      const key = `${item.instance_id}:${item.invoice_id}`
      return matchingInvoiceKeys.has(key)
    })

    // Get total count for pagination (approximate since we're filtering client-side)
    const count = items.length

    // Get unique client IDs for lookups
    const clientIds = [...new Set(items?.map(i => i.client_id) || [])]

    // For Hosting items, relid points to whmcs_hosting, not whmcs_products directly
    const hostingTypes = ['Hosting']
    const hostingRelIds = [...new Set(items?.filter(i => hostingTypes.includes(i.type) && i.relid).map(i => i.relid) || [])]

    // Fetch client names
    const { data: clients } = await supabase
      .from('whmcs_clients')
      .select('whmcs_id, instance_id, firstname, lastname, companyname')
      .in('instance_id', instanceIds)
      .in('whmcs_id', clientIds.length > 0 ? clientIds : [0])

    // Fetch hosting records to resolve relid → packageid → product
    const { data: hostings } = await supabase
      .from('whmcs_hosting')
      .select('whmcs_id, instance_id, packageid')
      .in('instance_id', instanceIds)
      .in('whmcs_id', hostingRelIds.length > 0 ? hostingRelIds : [0])

    // Build hosting → product ID map
    const hostingMap = new Map<string, number>()
    hostings?.forEach(h => {
      const key = `${h.instance_id}:${h.whmcs_id}`
      if (h.packageid) hostingMap.set(key, h.packageid)
    })

    // Collect actual product IDs from hosting lookups
    const productIds = [...new Set(hostings?.map(h => h.packageid).filter(Boolean) || [])]

    // Fetch product names and categories
    const { data: products } = await supabase
      .from('whmcs_products')
      .select('whmcs_id, instance_id, name, gid')
      .in('instance_id', instanceIds)
      .in('whmcs_id', productIds.length > 0 ? productIds : [0])

    // Fetch product groups for category names
    const groupIds = [...new Set(products?.map(p => p.gid).filter(Boolean) || [])]
    const { data: groups } = await supabase
      .from('whmcs_product_groups')
      .select('whmcs_id, instance_id, name')
      .in('instance_id', instanceIds)
      .in('whmcs_id', groupIds.length > 0 ? groupIds : [0])

    // Fetch categories mapping
    const { data: categoryMappings } = await supabase
      .from('category_mappings')
      .select('product_id, instance_id, categories(id, name)')
      .in('instance_id', instanceIds)

    // Build lookup maps
    const clientMap = new Map<string, string>()
    clients?.forEach(client => {
      const key = `${client.instance_id}:${client.whmcs_id}`
      const name = client.companyname || `${client.firstname || ''} ${client.lastname || ''}`.trim() || 'Unknown'
      clientMap.set(key, name)
    })

    const productMap = new Map<string, { name: string; gid: number | null }>()
    products?.forEach(product => {
      const key = `${product.instance_id}:${product.whmcs_id}`
      productMap.set(key, { name: product.name || 'Unknown Product', gid: product.gid })
    })

    const groupMap = new Map<string, string>()
    groups?.forEach(group => {
      const key = `${group.instance_id}:${group.whmcs_id}`
      groupMap.set(key, group.name || 'Unknown Group')
    })

    const categoryMap = new Map<string, string>()
    categoryMappings?.forEach(mapping => {
      const key = `${mapping.instance_id}:${mapping.product_id}`
      if (mapping.categories && typeof mapping.categories === 'object' && 'name' in mapping.categories) {
        categoryMap.set(key, (mapping.categories as { name: string }).name)
      }
    })

    // Transform results
    let transactions: RevenueTransaction[] = (items || []).map(item => {
      const clientKey = `${item.instance_id}:${item.client_id}`
      const invoiceKey = `${item.instance_id}:${item.invoice_id}`
      const invoice = invoiceMap.get(invoiceKey)

      let productName = item.description || 'Unknown'
      let categoryName: string | null = null

      if (item.type === 'Hosting' && item.relid) {
        // Hosting: relid → whmcs_hosting → packageid → whmcs_products
        const hostingKey = `${item.instance_id}:${item.relid}`
        const packageId = hostingMap.get(hostingKey)
        if (packageId) {
          const productKey = `${item.instance_id}:${packageId}`
          const product = productMap.get(productKey)
          if (product?.name) productName = product.name

          // Category from mapping or product group
          categoryName = categoryMap.get(productKey) || null
          if (!categoryName && product?.gid) {
            const groupKey = `${item.instance_id}:${product.gid}`
            categoryName = groupMap.get(groupKey) || null
          }
        }
      } else if (item.type === 'Domain' || item.type === 'DomainRegister' || item.type === 'DomainTransfer') {
        categoryName = 'Domains'
      } else if (item.type === 'Setup') {
        categoryName = 'Setup Fees'
      }
      // For Item, Addon, Invoice, Late Fee, etc.: use description as product name (already set above)

      return {
        id: item.id,
        date: invoice?.status === 'Paid' ? (invoice.datepaid || invoice.date || '') : (invoice?.date || ''),
        invoice_id: invoice?.whmcs_id || item.invoice_id,
        invoice_num: invoice?.invoicenum || String(item.invoice_id),
        invoice_status: invoice?.status || 'Unknown',
        invoice_total: Number(invoice?.total) || 0,
        client_id: item.client_id,
        client_name: clientMap.get(clientKey) || 'Unknown Client',
        category: categoryName,
        product_name: productName,
        type: item.type || 'Other',
        amount: Number(item.amount) || 0,
      }
    })

    // Sort by date if needed (client-side since dates come from invoice lookup)
    if (sortBy === 'date') {
      transactions.sort((a, b) => {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
      })
    }

    // Apply search filter (client-side since we need to search across joined data)
    if (search) {
      const searchLower = search.toLowerCase()
      transactions = transactions.filter(t =>
        t.client_name.toLowerCase().includes(searchLower) ||
        t.product_name.toLowerCase().includes(searchLower) ||
        t.invoice_num.toLowerCase().includes(searchLower) ||
        (t.category && t.category.toLowerCase().includes(searchLower))
      )
    }

    // Apply category filter (client-side since categories come from mapping)
    if (category) {
      transactions = transactions.filter(t => t.category === category)
    }

    // Calculate total after all filters
    const totalFiltered = transactions.length

    // Apply pagination (client-side)
    const paginatedTransactions = transactions.slice(offset, offset + limit)

    // Get unique values for filter options
    const { data: typeOptions } = await supabase
      .from('whmcs_invoice_items')
      .select('type')
      .in('instance_id', instanceIds)
      .not('type', 'is', null)
      .limit(100)

    const uniqueTypes = [...new Set(typeOptions?.map(t => t.type).filter(Boolean) || [])]

    const { data: allCategories } = await supabase
      .from('categories')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order')

    const totalPages = totalFiltered ? Math.ceil(totalFiltered / limit) : 0

    return success({
      transactions: paginatedTransactions,
      pagination: {
        page,
        limit,
        total: totalFiltered,
        total_pages: totalPages,
      },
      filters: {
        types: uniqueTypes,
        categories: allCategories || [],
        sources: ['recurring', 'onetime'],
      },
    }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/revenue/transactions:', err)
    return error(err instanceof Error ? err : new Error('Failed to get transactions'))
  }
}
