import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'

export const dynamic = 'force-dynamic'

/**
 * POST /api/user/accept-invite
 * Called after a user accepts an invitation link.
 * Assigns the user to the invited tenant with the specified role.
 */
export async function POST(request: Request) {
  try {
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')
    const userEmail = headersList.get('x-user-email')

    if (authType !== 'jwt' || !authId) {
      return error(new Error('Authentication required'), 401)
    }

    const body = await request.json()
    const { tenant_id, role = 'member' } = body

    if (!tenant_id) return error(new Error('tenant_id is required'), 400)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify the tenant exists
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, status')
      .eq('id', tenant_id)
      .single()

    if (tenantError || !tenant) {
      return error(new Error('Tenant not found'), 404)
    }

    if (tenant.status === 'suspended') {
      return error(new Error('This organization has been suspended'), 403)
    }

    // Get auth user info
    const { data: { user: authUser } } = await supabase.auth.admin.getUserById(authId)

    const fullName = authUser?.user_metadata?.full_name
      || authUser?.user_metadata?.name
      || userEmail?.split('@')[0]
      || null

    // Upsert user into the invited tenant
    const { error: upsertError } = await supabase
      .from('users')
      .upsert({
        id: authId,
        tenant_id,
        email: userEmail || authUser?.email || '',
        full_name: fullName,
        role: ['admin', 'member', 'viewer'].includes(role) ? role : 'member',
        is_active: true,
      }, { onConflict: 'id' })

    if (upsertError) {
      console.error('Error accepting invite:', upsertError)
      return error(new Error('Failed to join organization'), 500)
    }

    return success({
      message: `Successfully joined "${tenant.name}"`,
      tenant_id,
      tenant_name: tenant.name,
      role,
    })
  } catch (err) {
    console.error('Error in POST /api/user/accept-invite:', err)
    return error(err instanceof Error ? err : new Error('Failed to accept invitation'))
  }
}
