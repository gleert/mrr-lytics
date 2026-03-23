import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'
import { checkSubscriptionLimit, SubscriptionLimitError } from '@/lib/subscription'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createInstanceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less').trim(),
  whmcs_url: z.string().url('Must be a valid URL').max(500),
  api_token: z.string().min(1, 'API token is required').max(500),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color').optional(),
  sync_enabled: z.boolean().optional().default(true),
  sync_interval_hours: z.number().int().min(1).max(168).optional().default(24),
})

/**
 * GET /api/instances - Get all WHMCS instances for the current user's tenant
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
      return success({ instances: [] })
    }

    // Get all instances for user's tenants
    const { data: instances, error: instancesError } = await supabase
      .from('whmcs_instances')
      .select('*')
      .in('tenant_id', tenantIds)
      .order('name')

    if (instancesError) {
      console.error('Error fetching instances:', instancesError)
      return error(new Error('Failed to fetch instances'), 500)
    }

    return success({ instances: instances || [] })
  } catch (err) {
    console.error('Error in GET /api/instances:', err)
    return error(err instanceof Error ? err : new Error('Failed to get instances'))
  }
}

/**
 * POST /api/instances - Create a new WHMCS instance
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
    const parsed = createInstanceSchema.safeParse(body)

    if (!parsed.success) {
      return error(new Error(parsed.error.issues.map((e: { message: string }) => e.message).join(', ')), 400)
    }

    const { name, whmcs_url, api_token, color, sync_enabled, sync_interval_hours } = parsed.data

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get user's default tenant (or first tenant)
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
      return error(new Error('Only admins can create instances'), 403)
    }

    // Check subscription limit for instances
    const limitCheck = await checkSubscriptionLimit(userTenant.tenant_id, 'instances')
    if (!limitCheck.allowed) {
      return error(
        new SubscriptionLimitError('instances', limitCheck.limit, limitCheck.current, limitCheck.planId),
        402 // Payment Required
      )
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // Create instance with API token
    const { data: instance, error: createError } = await supabase
      .from('whmcs_instances')
      .insert({
        tenant_id: userTenant.tenant_id,
        name,
        slug,
        whmcs_url,
        whmcs_api_secret: api_token, // Store the token
        color: color || '#7C3AED',
        sync_enabled,
        sync_interval_hours,
        status: 'active',
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating instance:', createError)
      if (createError.code === '23505') {
        return error(new Error('An instance with this name already exists'), 409)
      }
      return error(new Error('Failed to create instance'), 500)
    }

    return success({ instance })
  } catch (err) {
    console.error('Error in POST /api/instances:', err)
    return error(err instanceof Error ? err : new Error('Failed to create instance'))
  }
}
