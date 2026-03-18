import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'

export const dynamic = 'force-dynamic'

const VALID_CURRENCIES = ['EUR', 'USD', 'GBP'] as const
type Currency = typeof VALID_CURRENCIES[number]

interface UpdateSettingsBody {
  currency?: Currency
  name?: string
  company_name?: string
}

/**
 * PATCH /api/tenants/:tenantId/settings - Update tenant settings
 * 
 * Body:
 * - currency: 'EUR' | 'USD' | 'GBP'
 * 
 * Requires admin role on the tenant.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')

    // Only JWT auth (dashboard users) can access this endpoint
    if (authType !== 'jwt' || !authId) {
      return error(new Error('This endpoint requires user authentication'), 401)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Check if user has admin role on this tenant (uses users table with tenant_id)
    const { data: userRecord, error: userTenantError } = await supabase
      .from('users')
      .select('role')
      .eq('id', authId)
      .eq('tenant_id', tenantId)
      .single()

    if (userTenantError || !userRecord) {
      return error(new Error('Tenant not found or access denied'), 404)
    }

    if (userRecord.role !== 'admin') {
      return error(new Error('Admin role required to update tenant settings'), 403)
    }

    // Parse body
    const body: UpdateSettingsBody = await request.json()

    // Validate currency if provided
    if (body.currency !== undefined) {
      if (!VALID_CURRENCIES.includes(body.currency)) {
        return error(new Error(`Invalid currency. Must be one of: ${VALID_CURRENCIES.join(', ')}`), 400)
      }
    }

    // Build update object
    const updates: Record<string, unknown> = {}
    if (body.currency) updates.currency = body.currency
    if (body.name !== undefined) updates.name = body.name.trim()

    // Store company_name in the settings JSONB field
    if (body.company_name !== undefined) {
      // Get current settings first
      const { data: currentTenant } = await supabase
        .from('tenants')
        .select('settings')
        .eq('id', tenantId)
        .single()
      const currentSettings = (currentTenant?.settings as Record<string, unknown>) || {}
      updates.settings = { ...currentSettings, company_name: body.company_name.trim() }
    }

    if (Object.keys(updates).length === 0) {
      return error(new Error('No valid fields to update'), 400)
    }

    // Update tenant
    const { data: updatedTenant, error: updateError } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', tenantId)
      .select('id, name, slug, currency, settings')
      .single()

    if (updateError) {
      console.error('Error updating tenant:', updateError)
      return error(new Error('Failed to update tenant settings'), 500)
    }

    return success({
      tenant: {
        ...updatedTenant,
        company_name: (updatedTenant?.settings as Record<string, unknown>)?.company_name ?? null,
      },
      message: 'Settings updated successfully',
    })
  } catch (err) {
    console.error('Error in PATCH /api/tenants/:tenantId/settings:', err)
    return error(err instanceof Error ? err : new Error('Failed to update tenant settings'))
  }
}

/**
 * GET /api/tenants/:tenantId/settings - Get tenant settings
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')

    if (authType !== 'jwt' || !authId) {
      return error(new Error('This endpoint requires user authentication'), 401)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Check if user has access to this tenant
    const { data: userRecord, error: userTenantError } = await supabase
      .from('users')
      .select('role')
      .eq('id', authId)
      .eq('tenant_id', tenantId)
      .single()

    if (userTenantError || !userRecord) {
      return error(new Error('Tenant not found or access denied'), 404)
    }

    // Get tenant settings
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, slug, currency, settings')
      .eq('id', tenantId)
      .single()

    if (tenantError || !tenant) {
      return error(new Error('Tenant not found'), 404)
    }

    const settings = (tenant.settings as Record<string, unknown>) || {}

    return success({
      tenant: {
        ...tenant,
        currency: tenant.currency || 'EUR',
        company_name: settings.company_name ?? null,
      },
      user_role: userRecord.role,
    })
  } catch (err) {
    console.error('Error in GET /api/tenants/:tenantId/settings:', err)
    return error(err instanceof Error ? err : new Error('Failed to get tenant settings'))
  }
}
