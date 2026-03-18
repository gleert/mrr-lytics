import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'
import { requireSuperAdmin, getTenant } from '../_superadmin'

export const dynamic = 'force-dynamic'

interface RouteParams { params: Promise<{ tenantId: string }> }

/**
 * POST /api/admin/tenants/:id/impersonate
 * Generates a short-lived impersonation token for superadmin to view a tenant's dashboard.
 * The token expires in 1 hour and is audited.
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { userEmail } = await requireSuperAdmin()
    const { tenantId } = await params
    const { supabase, tenant } = await getTenant(tenantId)

    // Get the admin user of the target tenant to impersonate
    const { data: adminUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('tenant_id', tenantId)
      .eq('role', 'admin')
      .limit(1)
      .single()

    if (!adminUser) throw new Error('No admin user found for this tenant')

    // Create a Supabase admin client to generate a magic link / session
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Generate a one-time session for the tenant admin user
    const { data: sessionData, error: sessionError } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email: adminUser.email!,
      options: {
        redirectTo: `${process.env.DASHBOARD_URL}/?impersonating=${tenantId}`,
        data: {
          impersonated_by: userEmail,
          impersonation_tenant_id: tenantId,
          impersonation_tenant_name: tenant.name,
        },
      },
    })

    if (sessionError || !sessionData?.properties?.hashed_token) {
      throw new Error(sessionError?.message ?? 'Failed to generate impersonation link')
    }

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

    // Build the magic link URL
    const magicLink = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify?token=${sessionData.properties.hashed_token}&type=magiclink&redirect_to=${encodeURIComponent(`${process.env.DASHBOARD_URL}/?impersonating=${tenantId}`)}`

    return success({
      message: `Impersonation link generated for tenant "${tenant.name}"`,
      magic_link: magicLink,
      tenant_name: tenant.name,
      tenant_id: tenantId,
      impersonated_user: adminUser.email,
      expires_in: '1 hour',
    })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to generate impersonation link'))
  }
}
