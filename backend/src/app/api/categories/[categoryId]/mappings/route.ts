import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error, created, noContent } from '@/utils/api-response'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ categoryId: string }>
}

/**
 * POST /api/categories/[categoryId]/mappings - Add a mapping to a category
 * 
 * Body:
 * - instance_id: UUID of the WHMCS instance
 * - mapping_type: 'product' | 'product_group'
 * - whmcs_id: The WHMCS ID of the product or group
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { categoryId } = await params
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')

    if (authType !== 'jwt' || !authId) {
      return error(new Error('This endpoint requires user authentication'), 401)
    }

    const body = await request.json()
    const { instance_id, mapping_type, whmcs_id } = body

    // Validate required fields
    if (!instance_id || !mapping_type || whmcs_id === undefined) {
      return error(new Error('instance_id, mapping_type, and whmcs_id are required'), 400)
    }

    if (!['product', 'product_group', 'billable_item'].includes(mapping_type)) {
      return error(new Error('mapping_type must be "product", "product_group", or "billable_item"'), 400)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify user has access to the category's tenant
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
      return error(new Error('Only admins can manage category mappings'), 403)
    }

    // Verify category belongs to user's tenant
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id, tenant_id')
      .eq('id', categoryId)
      .eq('tenant_id', userTenant.tenant_id)
      .single()

    if (categoryError || !category) {
      return error(new Error('Category not found'), 404)
    }

    // Verify instance belongs to user's tenant
    const { data: instance, error: instanceError } = await supabase
      .from('whmcs_instances')
      .select('id')
      .eq('id', instance_id)
      .eq('tenant_id', userTenant.tenant_id)
      .single()

    if (instanceError || !instance) {
      return error(new Error('Instance not found'), 404)
    }

    // Remove any existing mapping for this item (can only be in one category)
    await supabase
      .from('category_mappings')
      .delete()
      .eq('instance_id', instance_id)
      .eq('mapping_type', mapping_type)
      .eq('whmcs_id', whmcs_id)

    // Create the new mapping
    const { data: mapping, error: createError } = await supabase
      .from('category_mappings')
      .insert({
        category_id: categoryId,
        instance_id,
        mapping_type,
        whmcs_id,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating mapping:', createError)
      return error(new Error('Failed to create mapping'), 500)
    }

    return created({ mapping })
  } catch (err) {
    console.error('Error in POST /api/categories/[categoryId]/mappings:', err)
    return error(err instanceof Error ? err : new Error('Failed to create mapping'))
  }
}

/**
 * DELETE /api/categories/[categoryId]/mappings - Remove a mapping
 * 
 * Query params:
 * - instance_id: UUID of the WHMCS instance
 * - mapping_type: 'product' | 'product_group'
 * - whmcs_id: The WHMCS ID of the product or group
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { categoryId } = await params
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')

    if (authType !== 'jwt' || !authId) {
      return error(new Error('This endpoint requires user authentication'), 401)
    }

    const { searchParams } = new URL(request.url)
    const instanceId = searchParams.get('instance_id')
    const mappingType = searchParams.get('mapping_type')
    const whmcsId = searchParams.get('whmcs_id')

    if (!instanceId || !mappingType || !whmcsId) {
      return error(new Error('instance_id, mapping_type, and whmcs_id are required'), 400)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify user has access
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
      return error(new Error('Only admins can manage category mappings'), 403)
    }

    // Delete the mapping
    const { error: deleteError } = await supabase
      .from('category_mappings')
      .delete()
      .eq('category_id', categoryId)
      .eq('instance_id', instanceId)
      .eq('mapping_type', mappingType)
      .eq('whmcs_id', Number(whmcsId))

    if (deleteError) {
      console.error('Error deleting mapping:', deleteError)
      return error(new Error('Failed to delete mapping'), 500)
    }

    return noContent()
  } catch (err) {
    console.error('Error in DELETE /api/categories/[categoryId]/mappings:', err)
    return error(err instanceof Error ? err : new Error('Failed to delete mapping'))
  }
}
