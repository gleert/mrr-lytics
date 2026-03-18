import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { success, error } from '@/utils/api-response'
import { requireSuperAdmin, getTenant } from '../_superadmin'
import { SignJWT } from 'jose'

export const dynamic = 'force-dynamic'

interface RouteParams { params: Promise<{ tenantId: string }> }

/**
 * POST /api/admin/tenants/:id/impersonate
 *
 * Generates a short-lived impersonation JWT (1 hour) that the dashboard uses
 * to make API calls as if it were the tenant admin — WITHOUT changing the
 * superadmin's Supabase session in the browser.
 *
 * The token is passed as ?impersonate_token=... and stored in sessionStorage
 * so the superadmin's localStorage session is untouched.
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { userEmail } = await requireSuperAdmin()
    const { tenantId } = await params
    const { supabase, tenant } = await getTenant(tenantId)

    // Get the admin user of the target tenant
    const { data: adminUser } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('tenant_id', tenantId)
      .eq('role', 'admin')
      .limit(1)
      .single()

    if (!adminUser) throw new Error('No admin user found for this tenant')

    // Generate a signed JWT with tenant context
    const secret = new TextEncoder().encode(
      process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-secret'
    )

    const token = await new SignJWT({
      sub: adminUser.id,
      email: adminUser.email,
      tenant_id: tenantId,
      tenant_name: tenant.name,
      role: 'admin',
      impersonated_by: userEmail,
      type: 'impersonation',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secret)

    // Log the impersonation event
    await supabase.from('subscription_events').insert({
      tenant_id: tenantId,
      subscription_id: null,
      event_type: 'impersonation',
      from_plan_id: null,
      to_plan_id: null,
      metadata: {
        impersonated_by: userEmail,
        impersonated_user: adminUser.email,
        tenant_name: tenant.name,
      },
    })

    const dashboardUrl = process.env.DASHBOARD_URL || 'https://app.mrrlytics.com'
    const impersonateUrl = `${dashboardUrl}/?impersonate_token=${token}&impersonating=${tenantId}`

    return success({
      message: `Impersonation link generated for tenant "${tenant.name}"`,
      impersonate_url: impersonateUrl,
      // Keep magic_link for backwards compat with existing UI
      magic_link: impersonateUrl,
      tenant_name: tenant.name,
      tenant_id: tenantId,
      impersonated_user: adminUser.email,
      expires_in: '1 hour',
    })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to generate impersonation link'))
  }
}
