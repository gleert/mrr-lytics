import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'
import { checkSubscriptionLimit, TrialExpiredError } from '@/lib/subscription/limits'

export const dynamic = 'force-dynamic'

interface TeamMember {
  id: string
  user_id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: string
  joined_at: string
  last_sign_in: string | null
}

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * GET /api/team - Get all team members for the current tenant
 */
export async function GET() {
  try {
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')
    const tenantId = headersList.get('x-tenant-id')

    if (authType !== 'jwt' || !authId) return error(new Error('Authentication required'), 401)
    if (!tenantId) return error(new Error('Tenant not found'), 400)

    const supabase = makeSupabase()

    // Verify user has access to this tenant
    const { data: currentUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', authId)
      .eq('tenant_id', tenantId)
      .single()

    if (!currentUser) return error(new Error('Access denied'), 403)

    // Get all users in this tenant
    const { data: members, error: membersError } = await supabase
      .from('users')
      .select('id, email, full_name, role, is_active, created_at, last_login_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })

    if (membersError) return error(new Error('Failed to fetch team members'), 500)

    // Get last sign in from auth.users
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const authUserMap = new Map(authUsers?.users?.map(u => [u.id, u]) || [])

    const teamMembers: TeamMember[] = (members || []).map(m => ({
      id: m.id,
      user_id: m.id,
      email: m.email || authUserMap.get(m.id)?.email || 'Unknown',
      full_name: m.full_name || authUserMap.get(m.id)?.user_metadata?.full_name || null,
      avatar_url: authUserMap.get(m.id)?.user_metadata?.avatar_url || null,
      role: m.role,
      joined_at: m.created_at,
      last_sign_in: authUserMap.get(m.id)?.last_sign_in_at || m.last_login_at || null,
    }))

    const limitCheck = await checkSubscriptionLimit(tenantId, 'team_members')

    return success({
      members: teamMembers,
      current_user_id: authId,
      current_user_role: currentUser.role,
      limits: {
        current: limitCheck.current,
        max: limitCheck.limit,
        can_invite: limitCheck.allowed,
      },
    })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to get team members'))
  }
}

/**
 * POST /api/team - Invite a new team member
 */
export async function POST(request: Request) {
  try {
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')
    const tenantId = headersList.get('x-tenant-id')

    if (authType !== 'jwt' || !authId) return error(new Error('Authentication required'), 401)
    if (!tenantId) return error(new Error('Tenant not found'), 400)

    const supabase = makeSupabase()

    // Verify user is admin of this tenant
    const { data: currentUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', authId)
      .eq('tenant_id', tenantId)
      .single()

    if (!currentUser || currentUser.role !== 'admin') {
      return error(new Error('Only admins can invite team members'), 403)
    }

    // Check subscription limit
    let limitCheck
    try {
      limitCheck = await checkSubscriptionLimit(tenantId, 'team_members')
    } catch (limitErr) {
      if (limitErr instanceof TrialExpiredError) {
        return error(limitErr, 402)
      }
      console.error('[team/invite] subscription check failed:', limitErr)
      // Don't block invites if subscription check fails
      limitCheck = { allowed: true, current: 0, limit: 999 }
    }
    if (!limitCheck.allowed) {
      return error(
        new Error(`Team member limit reached. Your plan allows ${limitCheck.limit} members.`),
        403
      )
    }

    const body = await request.json()
    const { email, role = 'viewer' } = body

    if (!email || typeof email !== 'string') return error(new Error('Email is required'), 400)
    if (!['admin', 'viewer'].includes(role)) return error(new Error('Invalid role. Allowed: admin, viewer'), 400)

    const normalizedEmail = email.toLowerCase().trim()
    console.log('[team/invite] Inviting:', normalizedEmail, 'to tenant:', tenantId, 'as:', role)

    // Check if user already exists in auth
    const { data: authUsersData, error: listError } = await supabase.auth.admin.listUsers()
    if (listError) {
      console.error('[team/invite] listUsers error:', listError)
    }
    const existingAuthUser = authUsersData?.users?.find(
      u => u.email?.toLowerCase() === normalizedEmail
    )

    if (existingAuthUser) {
      // Check if already a member of this tenant
      const { data: existingMember } = await supabase
        .from('users')
        .select('id')
        .eq('id', existingAuthUser.id)
        .eq('tenant_id', tenantId)
        .single()

      if (existingMember) {
        return error(new Error('User is already a team member'), 400)
      }

      // Check if user already has a different tenant (they'd need a second users record)
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, tenant_id')
        .eq('id', existingAuthUser.id)
        .single()

      if (existingUser && existingUser.tenant_id) {
        // User belongs to another tenant - can't add them to two tenants in this schema
        // Instead, we invite them as a new user with a different approach
        // For now, update their tenant_id (single-tenant model)
        const { error: updateError } = await supabase
          .from('users')
          .update({ tenant_id: tenantId, role })
          .eq('id', existingAuthUser.id)

        if (updateError) {
          console.error('[team/invite] update existing user error:', updateError)
          return error(new Error(`Failed to reassign user: ${updateError.message}`), 500)
        }

        // Also add to user_tenants for multi-tenant access
        await supabase
          .from('user_tenants')
          .upsert({
            user_id: existingAuthUser.id,
            tenant_id: tenantId,
            role,
            is_default: false,
          }, { onConflict: 'user_id,tenant_id' })
      } else {
        // Create new user record for this tenant
        const { error: insertError } = await supabase
          .from('users')
          .upsert({
            id: existingAuthUser.id,
            tenant_id: tenantId,
            email: normalizedEmail,
            full_name: existingAuthUser.user_metadata?.full_name || null,
            role,
            is_active: true,
          }, { onConflict: 'id' })

        if (insertError) {
          console.error('[team/invite] upsert user error:', insertError)
          return error(new Error(`Failed to create user record: ${insertError.message}`), 500)
        }

        // Also add to user_tenants for multi-tenant access
        await supabase
          .from('user_tenants')
          .upsert({
            user_id: existingAuthUser.id,
            tenant_id: tenantId,
            role,
            is_default: true,
          }, { onConflict: 'user_id,tenant_id' })
      }

      return success({
        message: 'User added to team',
        member: { user_id: existingAuthUser.id, email: normalizedEmail, role },
      })
    }

    // Invite new user via Supabase Auth magic link
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        data: {
          invited_to_tenant: tenantId,
          invited_role: role,
        },
        redirectTo: `${process.env.DASHBOARD_URL || 'https://app.mrrlytics.com'}/auth/callback?type=invite&tenant=${tenantId}&role=${role}`,
      }
    )

    if (inviteError) {
      console.error('Error inviting user:', JSON.stringify(inviteError))
      // Common Supabase invite errors
      if (inviteError.message?.includes('already registered')) {
        return error(new Error('This email is already registered'), 400)
      }
      if (inviteError.message?.includes('rate limit')) {
        return error(new Error('Too many invitations. Please wait a few minutes.'), 429)
      }
      return error(new Error(`Failed to send invitation: ${inviteError.message}`), 500)
    }

    // Pre-create user record so they show up in team immediately
    if (inviteData?.user) {
      await supabase
        .from('users')
        .upsert({
          id: inviteData.user.id,
          tenant_id: tenantId,
          email: normalizedEmail,
          role,
          is_active: false, // Not active until they accept
        }, { onConflict: 'id' })

      // Also pre-create user_tenants entry
      await supabase
        .from('user_tenants')
        .upsert({
          user_id: inviteData.user.id,
          tenant_id: tenantId,
          role,
          is_default: true,
        }, { onConflict: 'user_id,tenant_id' })
    }

    return success({
      message: 'Invitation sent successfully',
      email: normalizedEmail,
      role,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('Error in POST /api/team:', { message, stack })
    return error(new Error(`Failed to add team member: ${message}`))
  }
}
