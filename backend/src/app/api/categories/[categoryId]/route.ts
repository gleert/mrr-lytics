import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error, noContent } from '@/utils/api-response'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ categoryId: string }>
}

/**
 * GET /api/categories/[categoryId] - Get a specific category
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { categoryId } = await params
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

    // Get user's tenants
    const { data: userTenants, error: tenantsError } = await supabase
      .from('user_tenants')
      .select('tenant_id')
      .eq('user_id', authId)

    if (tenantsError) {
      return error(new Error('Failed to fetch tenants'), 500)
    }

    const tenantIds = userTenants?.map(ut => ut.tenant_id) || []

    // Get category with mappings
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select(`
        *,
        category_mappings (
          id,
          instance_id,
          mapping_type,
          whmcs_id,
          created_at
        )
      `)
      .eq('id', categoryId)
      .in('tenant_id', tenantIds)
      .single()

    if (categoryError) {
      if (categoryError.code === 'PGRST116') {
        return error(new Error('Category not found'), 404)
      }
      console.error('Error fetching category:', categoryError)
      return error(new Error('Failed to fetch category'), 500)
    }

    return success({ category })
  } catch (err) {
    console.error('Error in GET /api/categories/[categoryId]:', err)
    return error(err instanceof Error ? err : new Error('Failed to get category'))
  }
}

/**
 * PATCH /api/categories/[categoryId] - Update a category
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { categoryId } = await params
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')

    if (authType !== 'jwt' || !authId) {
      return error(new Error('This endpoint requires user authentication'), 401)
    }

    const body = await request.json()
    const { name, description, color, icon, sort_order, is_active } = body

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get user's tenant with admin check
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

    if (userTenant.role !== 'admin') {
      return error(new Error('Only admins can update categories'), 403)
    }

    // Verify category belongs to user's tenant
    const { data: existingCategory, error: verifyError } = await supabase
      .from('categories')
      .select('id, tenant_id')
      .eq('id', categoryId)
      .eq('tenant_id', userTenant.tenant_id)
      .single()

    if (verifyError || !existingCategory) {
      return error(new Error('Category not found'), 404)
    }

    // Build update object
    const updates: Record<string, unknown> = {}
    
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return error(new Error('Name cannot be empty'), 400)
      }
      updates.name = name.trim()
      updates.slug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
    }
    
    if (description !== undefined) {
      updates.description = description?.trim() || null
    }
    
    if (color !== undefined) {
      updates.color = color
    }
    
    if (icon !== undefined) {
      updates.icon = icon
    }
    
    if (sort_order !== undefined) {
      updates.sort_order = sort_order
    }
    
    if (is_active !== undefined) {
      updates.is_active = is_active
    }

    if (Object.keys(updates).length === 0) {
      return error(new Error('No valid fields to update'), 400)
    }

    // Update category
    const { data: category, error: updateError } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', categoryId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating category:', updateError)
      if (updateError.code === '23505') {
        return error(new Error('A category with this name already exists'), 409)
      }
      return error(new Error('Failed to update category'), 500)
    }

    return success({ category })
  } catch (err) {
    console.error('Error in PATCH /api/categories/[categoryId]:', err)
    return error(err instanceof Error ? err : new Error('Failed to update category'))
  }
}

/**
 * DELETE /api/categories/[categoryId] - Delete a category
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { categoryId } = await params
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

    // Get user's tenant with admin check
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

    if (userTenant.role !== 'admin') {
      return error(new Error('Only admins can delete categories'), 403)
    }

    // Verify category belongs to user's tenant
    const { data: existingCategory, error: verifyError } = await supabase
      .from('categories')
      .select('id, tenant_id')
      .eq('id', categoryId)
      .eq('tenant_id', userTenant.tenant_id)
      .single()

    if (verifyError || !existingCategory) {
      return error(new Error('Category not found'), 404)
    }

    // Delete category (cascades to mappings)
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId)

    if (deleteError) {
      console.error('Error deleting category:', deleteError)
      return error(new Error('Failed to delete category'), 500)
    }

    return noContent()
  } catch (err) {
    console.error('Error in DELETE /api/categories/[categoryId]:', err)
    return error(err instanceof Error ? err : new Error('Failed to delete category'))
  }
}
