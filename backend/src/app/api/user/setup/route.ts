import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { success, error, created } from '@/utils/api-response'

export const dynamic = 'force-dynamic'

/**
 * POST /api/user/setup - Auto-provision tenant and user record for new users
 * 
 * Called after first login (Google OAuth or email signup).
 * Creates a personal tenant and links the user to it.
 * Idempotent: if user already has a tenant, returns existing data.
 */
export async function POST() {
  try {
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')
    const userEmail = headersList.get('x-user-email')

    if (authType !== 'jwt' || !authId) {
      return error(new Error('This endpoint requires user authentication'), 401)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Check if user already has a tenant (idempotent)
    const { data: existingTenants } = await supabase
      .from('user_tenants')
      .select('tenant_id')
      .eq('user_id', authId)

    if (existingTenants && existingTenants.length > 0) {
      // User already set up - return existing data
      const { data: tenants } = await supabase
        .rpc('get_user_tenants', { p_user_id: authId })

      return success({
        tenants: tenants || [],
        already_setup: true,
      })
    }

    // Get auth user info for display name
    const { data: { user: authUser }, error: authError } = await supabase.auth.admin.getUserById(authId)

    if (authError || !authUser) {
      console.error('Error fetching auth user:', authError)
      return error(new Error('Failed to fetch user info'), 500)
    }

    const fullName = authUser.user_metadata?.full_name
      || authUser.user_metadata?.name
      || userEmail?.split('@')[0]
      || 'My Organization'

    const email = authUser.email || userEmail || ''

    // Generate a unique slug from the name
    const baseSlug = fullName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50)

    const slug = `${baseSlug}-${Date.now().toString(36)}`

    // Create tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: `${fullName}'s Organization`,
        slug,
        status: 'active',
      })
      .select('id, name, slug, status')
      .single()

    if (tenantError || !tenant) {
      console.error('Error creating tenant:', tenantError)
      return error(new Error('Failed to create organization'), 500)
    }

    // Create user record in users table
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: authId,
        email,
        full_name: fullName,
        role: 'admin',
        tenant_id: tenant.id,
        is_active: true,
      })

    if (userError) {
      console.error('Error creating user record:', userError)
      // Rollback tenant
      await supabase.from('tenants').delete().eq('id', tenant.id)
      return error(new Error('Failed to create user record'), 500)
    }

    // Create user_tenants link
    const { error: linkError } = await supabase
      .from('user_tenants')
      .insert({
        user_id: authId,
        tenant_id: tenant.id,
        role: 'admin',
        is_default: true,
      })

    if (linkError) {
      console.error('Error linking user to tenant:', linkError)
      // Rollback
      await supabase.from('users').delete().eq('id', authId)
      await supabase.from('tenants').delete().eq('id', tenant.id)
      return error(new Error('Failed to link user to organization'), 500)
    }

    // Assign free plan subscription
    const { data: freePlan } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('slug', 'free')
      .single()

    if (freePlan) {
      await supabase
        .from('tenant_subscriptions')
        .insert({
          tenant_id: tenant.id,
          plan_id: freePlan.id,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
    }

    return created({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      user: {
        id: authId,
        email,
        full_name: fullName,
        role: 'admin',
      },
      already_setup: false,
    })
  } catch (err) {
    console.error('Error in POST /api/user/setup:', err)
    return error(err instanceof Error ? err : new Error('Failed to setup account'))
  }
}
