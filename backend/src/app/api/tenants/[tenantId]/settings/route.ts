import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'

export const dynamic = 'force-dynamic'

const VALID_CURRENCIES = ['EUR', 'USD', 'GBP'] as const
type Currency = typeof VALID_CURRENCIES[number]

const VALID_INVOICE_STATUSES = ['Paid', 'Unpaid', 'Payment Pending', 'Cancelled', 'Refunded', 'Collections', 'Draft'] as const

interface UpdateSettingsBody {
  currency?: Currency
  name?: string
  company_name?: string
  include_cancelled_invoices?: boolean
  revenue_invoice_statuses?: string[]
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

    // Store settings that live in the JSONB settings column. Fetch current
    // settings once so we merge instead of overwriting.
    const jsonbFieldsTouched =
      body.company_name !== undefined ||
      body.include_cancelled_invoices !== undefined ||
      body.revenue_invoice_statuses !== undefined

    if (jsonbFieldsTouched) {
      // Validate revenue_invoice_statuses if provided
      if (body.revenue_invoice_statuses !== undefined) {
        if (!Array.isArray(body.revenue_invoice_statuses)) {
          return error(new Error('revenue_invoice_statuses must be an array'), 400)
        }
        if (body.revenue_invoice_statuses.length === 0) {
          return error(new Error('At least one invoice status must be selected'), 400)
        }
        const invalid = body.revenue_invoice_statuses.filter(s => !VALID_INVOICE_STATUSES.includes(s as never))
        if (invalid.length > 0) {
          return error(new Error(`Invalid statuses: ${invalid.join(', ')}`), 400)
        }
      }

      const { data: currentTenant } = await supabase
        .from('tenants')
        .select('settings')
        .eq('id', tenantId)
        .single()
      const currentSettings = (currentTenant?.settings as Record<string, unknown>) || {}
      const mergedSettings: Record<string, unknown> = { ...currentSettings }

      if (body.company_name !== undefined) {
        mergedSettings.company_name = body.company_name.trim()
      }
      if (body.include_cancelled_invoices !== undefined) {
        mergedSettings.include_cancelled_invoices = Boolean(body.include_cancelled_invoices)
      }
      if (body.revenue_invoice_statuses !== undefined) {
        mergedSettings.revenue_invoice_statuses = body.revenue_invoice_statuses
      }

      updates.settings = mergedSettings
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

    const updatedSettings = (updatedTenant?.settings as Record<string, unknown>) || {}
    return success({
      tenant: {
        ...updatedTenant,
        company_name: updatedSettings.company_name ?? null,
        include_cancelled_invoices: Boolean(updatedSettings.include_cancelled_invoices),
        revenue_invoice_statuses: (updatedSettings.revenue_invoice_statuses as string[]) ?? null,
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
        include_cancelled_invoices: Boolean(settings.include_cancelled_invoices),
        revenue_invoice_statuses: (settings.revenue_invoice_statuses as string[]) ?? null,
      },
      user_role: userRecord.role,
    })
  } catch (err) {
    console.error('Error in GET /api/tenants/:tenantId/settings:', err)
    return error(err instanceof Error ? err : new Error('Failed to get tenant settings'))
  }
}
