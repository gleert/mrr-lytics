import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'
import { checkSubscriptionLimit } from '@/lib/subscription/limits'

export const dynamic = 'force-dynamic'

interface TeamMember {
  id: string
  user_id: string
  email: string
  full_name: string | null
  role: string
  is_default: boolean
  joined_at: string
  last_sign_in: string | null
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

    if (authType !== 'jwt' || !authId) {
      return error(new Error('Authentication required'), 401)
    }

    if (!tenantId) {
      return error(new Error('Tenant not found'), 400)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify user has access to this tenant
    const { data: access } = await supabase
      .from('user_tenants')
      .select('role')
      .eq('user_id', authId)
      .eq('tenant_id', tenantId)
      .single()

    if (!access) {
      return error(new Error('Access denied'), 403)
    }

    // Get all team members for this tenant
    const { data: members, error: membersError } = await supabase
      .from('user_tenants')
      .select(`
        id,
        user_id,
        role,
        is_default,
        created_at
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })

    if (membersError) {
      console.error('Error fetching team members:', membersError)
      return error(new Error('Failed to fetch team members'), 500)
    }

    // Get user details from auth.users for each member
    const userIds = members?.map(m => m.user_id) || []
    
    // Get user profiles from users table
    const { data: profiles } = await supabase
      .from('users')
      .select('id, email, full_name')
      .in('id', userIds)

    // Get auth user data for last sign in
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const authUserMap = new Map(
      authUsers?.users?.map(u => [u.id, u]) || []
    )

    const profileMap = new Map(
      profiles?.map(p => [p.id, p]) || []
    )

    // Combine data
    const teamMembers: TeamMember[] = (members || []).map(member => {
      const profile = profileMap.get(member.user_id)
      const authUser = authUserMap.get(member.user_id)
      
      return {
        id: member.id,
        user_id: member.user_id,
        email: profile?.email || authUser?.email || 'Unknown',
        full_name: profile?.full_name || authUser?.user_metadata?.full_name || null,
        role: member.role,
        is_default: member.is_default,
        joined_at: member.created_at,
        last_sign_in: authUser?.last_sign_in_at || null,
      }
    })

    // Get subscription limits for team members
    const limitCheck = await checkSubscriptionLimit(tenantId, 'team_members')

    return success({
      members: teamMembers,
      current_user_id: authId,
      current_user_role: access.role,
      limits: {
        current: limitCheck.current,
        max: limitCheck.limit,
        can_invite: limitCheck.allowed,
      },
    })
  } catch (err) {
    console.error('Error in GET /api/team:', err)
    return error(err instanceof Error ? err : new Error('Failed to get team members'))
  }
}

/**
 * POST /api/team - Invite a new team member
 * 
 * Body:
 * - email: string (required)
 * - role: 'admin' | 'member' (default: 'member')
 */
export async function POST(request: Request) {
  try {
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')
    const tenantId = headersList.get('x-tenant-id')

    if (authType !== 'jwt' || !authId) {
      return error(new Error('Authentication required'), 401)
    }

    if (!tenantId) {
      return error(new Error('Tenant not found'), 400)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify user is admin of this tenant
    const { data: access } = await supabase
      .from('user_tenants')
      .select('role')
      .eq('user_id', authId)
      .eq('tenant_id', tenantId)
      .single()

    if (!access || access.role !== 'admin') {
      return error(new Error('Only admins can invite team members'), 403)
    }

    // Check subscription limit
    const limitCheck = await checkSubscriptionLimit(tenantId, 'team_members')
    if (!limitCheck.allowed) {
      return error(
        new Error(`Team member limit reached. Your plan allows ${limitCheck.limit} members. Please upgrade to add more.`),
        403
      )
    }

    const body = await request.json()
    const { email, role = 'member' } = body

    if (!email || typeof email !== 'string') {
      return error(new Error('Email is required'), 400)
    }

    if (!['admin', 'member'].includes(role)) {
      return error(new Error('Role must be admin or member'), 400)
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check if user already exists in auth
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(
      u => u.email?.toLowerCase() === normalizedEmail
    )

    if (existingUser) {
      // Check if already a member of this tenant
      const { data: existingMember } = await supabase
        .from('user_tenants')
        .select('id')
        .eq('user_id', existingUser.id)
        .eq('tenant_id', tenantId)
        .single()

      if (existingMember) {
        return error(new Error('User is already a team member'), 400)
      }

      // Add existing user to tenant
      const { error: addError } = await supabase
        .from('user_tenants')
        .insert({
          user_id: existingUser.id,
          tenant_id: tenantId,
          role,
          is_default: false,
        })

      if (addError) {
        console.error('Error adding existing user to tenant:', addError)
        return error(new Error('Failed to add team member'), 500)
      }

      // Also add to users table if not exists
      await supabase
        .from('users')
        .upsert({
          id: existingUser.id,
          tenant_id: tenantId,
          email: normalizedEmail,
          full_name: existingUser.user_metadata?.full_name || null,
          role,
        }, { onConflict: 'id' })

      return success({
        message: 'Existing user added to team',
        member: {
          user_id: existingUser.id,
          email: normalizedEmail,
          role,
        },
      })
    }

    // Invite new user via Supabase Auth
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        data: {
          invited_to_tenant: tenantId,
          invited_role: role,
        },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/auth/callback?type=invite`,
      }
    )

    if (inviteError) {
      console.error('Error inviting user:', inviteError)
      return error(new Error('Failed to send invitation'), 500)
    }

    // Pre-create the user_tenants entry for when they accept
    // Note: The actual user record will be created when they complete signup
    if (inviteData.user) {
      await supabase
        .from('user_tenants')
        .insert({
          user_id: inviteData.user.id,
          tenant_id: tenantId,
          role,
          is_default: true, // Make this their default tenant
        })

      // Create user profile
      await supabase
        .from('users')
        .insert({
          id: inviteData.user.id,
          tenant_id: tenantId,
          email: normalizedEmail,
          role,
        })
    }

    return success({
      message: 'Invitation sent successfully',
      email: normalizedEmail,
      role,
    })
  } catch (err) {
    console.error('Error in POST /api/team:', err)
    return error(err instanceof Error ? err : new Error('Failed to invite team member'))
  }
}
