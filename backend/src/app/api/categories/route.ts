import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error, created } from '@/utils/api-response'

export const dynamic = 'force-dynamic'

/**
 * GET /api/categories - Get all categories for the current user's tenant
 */
export async function GET() {
  try {
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')

    if (authType !== 'jwt' || !authId) {
      return error(new Error('This endpoint requires user authentication'), 401)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get user's tenant(s)
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
      return success({ categories: [] })
    }

    // Get all categories for user's tenants with mapping counts
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select(`
        *,
        mappings_count:category_mappings(count)
      `)
      .in('tenant_id', tenantIds)
      .order('sort_order')
      .order('name')

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError)
      return error(new Error('Failed to fetch categories'), 500)
    }

    // Transform the response to flatten the count
    const transformedCategories = (categories || []).map(cat => ({
      ...cat,
      mappings_count: cat.mappings_count?.[0]?.count || 0,
    }))

    return success({ categories: transformedCategories })
  } catch (err) {
    console.error('Error in GET /api/categories:', err)
    return error(err instanceof Error ? err : new Error('Failed to get categories'))
  }
}

/**
 * POST /api/categories - Create a new category
 */
export async function POST(request: NextRequest) {
  try {
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')

    if (authType !== 'jwt' || !authId) {
      return error(new Error('This endpoint requires user authentication'), 401)
    }

    const body = await request.json()
    const { name, description, color, icon, sort_order, is_active = true } = body

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return error(new Error('Name is required'), 400)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get user's default tenant
    const { data: userTenant, error: tenantError } = await supabase
      .from('user_tenants')
      .select('tenant_id, role')
      .eq('user_id', authId)
      .order('is_default', { ascending: false })
      .limit(1)
      .single()

    if (tenantError || !userTenant) {
      return error(new Error('No tenant found for user'), 404)
    }

    // Check user has admin role
    if (userTenant.role !== 'admin') {
      return error(new Error('Only admins can create categories'), 403)
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // Create category
    const { data: category, error: createError } = await supabase
      .from('categories')
      .insert({
        tenant_id: userTenant.tenant_id,
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        color: color || '#7C3AED',
        icon: icon || 'category',
        sort_order: sort_order ?? 0,
        is_active,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating category:', createError)
      if (createError.code === '23505') {
        return error(new Error('A category with this name already exists'), 409)
      }
      return error(new Error('Failed to create category'), 500)
    }

    return created({ category })
  } catch (err) {
    console.error('Error in POST /api/categories:', err)
    return error(err instanceof Error ? err : new Error('Failed to create category'))
  }
}
