import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'

export const dynamic = 'force-dynamic'

/**
 * GET /api/products - Get all products for user's instances with their category mappings
 * 
 * Query params:
 * - instance_ids: Comma-separated list of instance IDs (optional, defaults to all)
 * - include_hidden: Include hidden/retired products (optional, default false)
 */
export async function GET(request: Request) {
  try {
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')

    if (authType !== 'jwt' || !authId) {
      return error(new Error('This endpoint requires user authentication'), 401)
    }

    const { searchParams } = new URL(request.url)
    const instanceIdsParam = searchParams.get('instance_ids')
    const includeHidden = searchParams.get('include_hidden') === 'true'

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get user's tenants
    const { data: userTenants, error: tenantsError } = await supabase
      .from('user_tenants')
      .select('tenant_id')
      .eq('user_id', authId)

    if (tenantsError) {
      console.error('Error fetching user tenants:', tenantsError)
      return error(new Error('Failed to fetch tenants'), 500)
    }

    const tenantIds = userTenants?.map(ut => ut.tenant_id) || []

    if (tenantIds.length === 0) {
      return success({ products: [], product_groups: [] })
    }

    // Get user's instances
    const { data: instances, error: instancesError } = await supabase
      .from('whmcs_instances')
      .select('id, name, color')
      .in('tenant_id', tenantIds)

    if (instancesError) {
      console.error('Error fetching instances:', instancesError)
      return error(new Error('Failed to fetch instances'), 500)
    }

    let instanceIds = instances?.map(i => i.id) || []
    
    // Filter by specific instances if provided
    if (instanceIdsParam) {
      const requestedIds = instanceIdsParam.split(',').filter(id => id.trim())
      instanceIds = instanceIds.filter(id => requestedIds.includes(id))
    }

    if (instanceIds.length === 0) {
      return success({ products: [], product_groups: [] })
    }

    // Build products query
    let productsQuery = supabase
      .from('whmcs_products')
      .select('*')
      .in('instance_id', instanceIds)
      .order('name')

    if (!includeHidden) {
      productsQuery = productsQuery
        .or('hidden.is.null,hidden.eq.0')
        .or('retired.is.null,retired.eq.0')
    }

    const { data: products, error: productsError } = await productsQuery

    if (productsError) {
      console.error('Error fetching products:', productsError)
      return error(new Error('Failed to fetch products'), 500)
    }

    // Get product groups
    let groupsQuery = supabase
      .from('whmcs_product_groups')
      .select('*')
      .in('instance_id', instanceIds)
      .order('name')

    if (!includeHidden) {
      groupsQuery = groupsQuery.or('hidden.is.null,hidden.eq.0')
    }

    const { data: productGroups, error: groupsError } = await groupsQuery

    if (groupsError) {
      console.error('Error fetching product groups:', groupsError)
      return error(new Error('Failed to fetch product groups'), 500)
    }

    // Get category mappings for these products
    const { data: mappings, error: mappingsError } = await supabase
      .from('category_mappings')
      .select(`
        id,
        category_id,
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

    if (mappingsError) {
      console.error('Error fetching category mappings:', mappingsError)
      return error(new Error('Failed to fetch category mappings'), 500)
    }

    // Create lookup maps for mappings
    const productMappings = new Map<string, typeof mappings[0]>()
    const groupMappings = new Map<string, typeof mappings[0]>()
    
    mappings?.forEach(mapping => {
      const key = `${mapping.instance_id}:${mapping.whmcs_id}`
      if (mapping.mapping_type === 'product') {
        productMappings.set(key, mapping)
      } else if (mapping.mapping_type === 'product_group') {
        groupMappings.set(key, mapping)
      }
    })

    // Create instance lookup
    const instanceMap = new Map(instances?.map(i => [i.id, i]) || [])

    // Create product group lookup (for getting group name)
    const groupInfoMap = new Map<string, { name: string; whmcs_id: number }>(
      (productGroups || []).map(g => [`${g.instance_id}:${g.whmcs_id}`, { name: g.name, whmcs_id: g.whmcs_id }])
    )

    // Count products per group (for inheriting_products_count)
    const productsPerGroup = new Map<string, number>()
    ;(products || []).forEach(product => {
      if (product.gid) {
        const groupKey = `${product.instance_id}:${product.gid}`
        productsPerGroup.set(groupKey, (productsPerGroup.get(groupKey) || 0) + 1)
      }
    })

    // Enhance products with their mappings, instance info, and inheritance
    const enhancedProducts = (products || []).map(product => {
      const mappingKey = `${product.instance_id}:${product.whmcs_id}`
      const productMapping = productMappings.get(mappingKey)
      const instance = instanceMap.get(product.instance_id)
      
      // Get group info and group's category mapping
      const groupKey = product.gid ? `${product.instance_id}:${product.gid}` : null
      const groupMapping = groupKey ? groupMappings.get(groupKey) : null
      const groupInfo = groupKey ? groupInfoMap.get(groupKey) : null
      
      // Determine if category is inherited from group
      const hasOwnCategory = !!productMapping?.categories
      const hasGroupCategory = !!groupMapping?.categories
      const isCategoryInherited = !hasOwnCategory && hasGroupCategory
      
      return {
        ...product,
        instance_name: instance?.name,
        instance_color: instance?.color,
        // Direct category mapping (if product has its own)
        category: productMapping?.categories || null,
        category_mapping_id: productMapping?.id || null,
        // Inherited category from group
        inherited_category: groupMapping?.categories || null,
        is_category_inherited: isCategoryInherited,
        // Group info for UI
        group_name: groupInfo?.name || null,
        group_has_category: hasGroupCategory,
      }
    })

    // Count products that inherit category per group
    const inheritingProductsPerGroup = new Map<string, number>()
    enhancedProducts.forEach(product => {
      if (product.is_category_inherited && product.gid) {
        const groupKey = `${product.instance_id}:${product.gid}`
        inheritingProductsPerGroup.set(groupKey, (inheritingProductsPerGroup.get(groupKey) || 0) + 1)
      }
    })

    // Enhance product groups with their mappings and inheriting products count
    const enhancedGroups = (productGroups || []).map(group => {
      const mappingKey = `${group.instance_id}:${group.whmcs_id}`
      const mapping = groupMappings.get(mappingKey)
      const instance = instanceMap.get(group.instance_id)
      const groupKey = `${group.instance_id}:${group.whmcs_id}`
      
      return {
        ...group,
        instance_name: instance?.name,
        instance_color: instance?.color,
        category: mapping?.categories || null,
        category_mapping_id: mapping?.id || null,
        // Count of products in this group
        products_count: productsPerGroup.get(groupKey) || 0,
        // Count of products inheriting this group's category
        inheriting_products_count: inheritingProductsPerGroup.get(groupKey) || 0,
      }
    })

    return success({ 
      products: enhancedProducts, 
      product_groups: enhancedGroups 
    })
  } catch (err) {
    console.error('Error in GET /api/products:', err)
    return error(err instanceof Error ? err : new Error('Failed to get products'))
  }
}
