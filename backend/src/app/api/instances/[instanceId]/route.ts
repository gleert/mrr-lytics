import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const updateInstanceSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  whmcs_url: z.string().url('Must be a valid URL').max(500).optional(),
  api_token: z.string().min(1).max(500).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color').optional(),
  sync_enabled: z.boolean().optional(),
  sync_interval_hours: z.number().int().min(1).max(168).optional(),
  status: z.enum(['active', 'paused']).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field is required' })

interface RouteParams {
  params: Promise<{ instanceId: string }>
}

/**
 * GET /api/instances/[instanceId] - Get a specific instance
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { instanceId } = await params
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

    // Verify user has access to this instance
    const hasAccess = await verifyInstanceAccess(supabase, authId, instanceId)
    if (!hasAccess) {
      return error(new Error('Instance not found or access denied'), 404)
    }

    const { data: instance, error: fetchError } = await supabase
      .from('whmcs_instances')
      .select('*')
      .eq('id', instanceId)
      .single()

    if (fetchError) {
      return error(new Error('Failed to fetch instance'), 500)
    }

    return success({ instance })
  } catch (err) {
    console.error('Error in GET /api/instances/[instanceId]:', err)
    return error(err instanceof Error ? err : new Error('Failed to get instance'))
  }
}

/**
 * PATCH /api/instances/[instanceId] - Update an instance
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { instanceId } = await params
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')

    if (authType !== 'jwt' || !authId) {
      return error(new Error('This endpoint requires user authentication'), 401)
    }

    const body = await request.json()
    const parsed = updateInstanceSchema.safeParse(body)

    if (!parsed.success) {
      return error(new Error(parsed.error.issues.map((e: { message: string }) => e.message).join(', ')), 400)
    }

    const { api_token, ...validFields } = parsed.data
    const updates: Record<string, unknown> = { ...validFields }

    // Handle api_token separately (maps to whmcs_api_secret)
    if (api_token) {
      updates.whmcs_api_secret = api_token
    }

    // Update slug if name changed
    if (updates.name) {
      updates.slug = (updates.name as string)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify user has admin access to this instance
    const hasAccess = await verifyInstanceAccess(supabase, authId, instanceId, true)
    if (!hasAccess) {
      return error(new Error('Instance not found or access denied'), 404)
    }

    const { data: instance, error: updateError } = await supabase
      .from('whmcs_instances')
      .update(updates)
      .eq('id', instanceId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating instance:', updateError)
      if (updateError.code === '23505') {
        return error(new Error('An instance with this name already exists'), 409)
      }
      return error(new Error('Failed to update instance'), 500)
    }

    return success({ instance })
  } catch (err) {
    console.error('Error in PATCH /api/instances/[instanceId]:', err)
    return error(err instanceof Error ? err : new Error('Failed to update instance'))
  }
}

/**
 * DELETE /api/instances/[instanceId] - Delete an instance
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { instanceId } = await params
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

    // Verify user has admin access to this instance
    const hasAccess = await verifyInstanceAccess(supabase, authId, instanceId, true)
    if (!hasAccess) {
      return error(new Error('Instance not found or access denied'), 404)
    }

    // Delete instance (cascade will delete related data)
    const { error: deleteError } = await supabase
      .from('whmcs_instances')
      .delete()
      .eq('id', instanceId)

    if (deleteError) {
      console.error('Error deleting instance:', deleteError)
      return error(new Error('Failed to delete instance'), 500)
    }

    return success({ deleted: true })
  } catch (err) {
    console.error('Error in DELETE /api/instances/[instanceId]:', err)
    return error(err instanceof Error ? err : new Error('Failed to delete instance'))
  }
}

/**
 * Verify user has access to an instance (via tenant membership)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyInstanceAccess(
  supabase: any,
  userId: string,
  instanceId: string,
  requireAdmin = false
): Promise<boolean> {
  // Get instance's tenant
  const { data: instance } = await supabase
    .from('whmcs_instances')
    .select('tenant_id')
    .eq('id', instanceId)
    .single()

  if (!instance) return false

  // Check user has access to that tenant
  const query = supabase
    .from('user_tenants')
    .select('role')
    .eq('user_id', userId)
    .eq('tenant_id', instance.tenant_id)
    .single()

  const { data: userTenant } = await query

  if (!userTenant) return false
  if (requireAdmin && userTenant.role !== 'admin') return false

  return true
}
