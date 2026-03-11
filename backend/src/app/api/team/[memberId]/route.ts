import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ memberId: string }>
}

/**
 * PATCH /api/team/[memberId] - Update a team member's role
 * 
 * Body:
 * - role: 'admin' | 'member'
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { memberId } = await params
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

    // Verify current user is admin of this tenant
    const { data: access } = await supabase
      .from('user_tenants')
      .select('role')
      .eq('user_id', authId)
      .eq('tenant_id', tenantId)
      .single()

    if (!access || access.role !== 'admin') {
      return error(new Error('Only admins can update team members'), 403)
    }

    // Get the member to update
    const { data: member, error: memberError } = await supabase
      .from('user_tenants')
      .select('id, user_id, role')
      .eq('id', memberId)
      .eq('tenant_id', tenantId)
      .single()

    if (memberError || !member) {
      return error(new Error('Team member not found'), 404)
    }

    // Prevent user from changing their own role
    if (member.user_id === authId) {
      return error(new Error('You cannot change your own role'), 400)
    }

    const body = await request.json()
    const { role } = body

    if (!role || !['admin', 'member'].includes(role)) {
      return error(new Error('Role must be admin or member'), 400)
    }

    // Check if this would remove the last admin
    if (member.role === 'admin' && role === 'member') {
      const { count } = await supabase
        .from('user_tenants')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('role', 'admin')

      if (count && count <= 1) {
        return error(new Error('Cannot demote the last admin. Promote another admin first.'), 400)
      }
    }

    // Update the role
    const { error: updateError } = await supabase
      .from('user_tenants')
      .update({ role })
      .eq('id', memberId)

    if (updateError) {
      console.error('Error updating member role:', updateError)
      return error(new Error('Failed to update member role'), 500)
    }

    // Also update in users table
    await supabase
      .from('users')
      .update({ role })
      .eq('id', member.user_id)
      .eq('tenant_id', tenantId)

    return success({
      message: 'Member role updated successfully',
      member_id: memberId,
      new_role: role,
    })
  } catch (err) {
    console.error('Error in PATCH /api/team/[memberId]:', err)
    return error(err instanceof Error ? err : new Error('Failed to update team member'))
  }
}

/**
 * DELETE /api/team/[memberId] - Remove a team member
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { memberId } = await params
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

    // Verify current user is admin of this tenant
    const { data: access } = await supabase
      .from('user_tenants')
      .select('role')
      .eq('user_id', authId)
      .eq('tenant_id', tenantId)
      .single()

    if (!access || access.role !== 'admin') {
      return error(new Error('Only admins can remove team members'), 403)
    }

    // Get the member to remove
    const { data: member, error: memberError } = await supabase
      .from('user_tenants')
      .select('id, user_id, role')
      .eq('id', memberId)
      .eq('tenant_id', tenantId)
      .single()

    if (memberError || !member) {
      return error(new Error('Team member not found'), 404)
    }

    // Prevent user from removing themselves
    if (member.user_id === authId) {
      return error(new Error('You cannot remove yourself from the team'), 400)
    }

    // Check if this would remove the last admin
    if (member.role === 'admin') {
      const { count } = await supabase
        .from('user_tenants')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('role', 'admin')

      if (count && count <= 1) {
        return error(new Error('Cannot remove the last admin'), 400)
      }
    }

    // Remove from user_tenants
    const { error: deleteError } = await supabase
      .from('user_tenants')
      .delete()
      .eq('id', memberId)

    if (deleteError) {
      console.error('Error removing member:', deleteError)
      return error(new Error('Failed to remove team member'), 500)
    }

    // Check if user has other tenants, if not, we might want to keep them in users table
    // but with a different tenant_id or null
    const { data: otherTenants } = await supabase
      .from('user_tenants')
      .select('tenant_id')
      .eq('user_id', member.user_id)
      .limit(1)

    if (!otherTenants || otherTenants.length === 0) {
      // User has no other tenants, update their primary tenant_id to null
      // We don't delete the user record as they might rejoin later
      await supabase
        .from('users')
        .update({ tenant_id: null })
        .eq('id', member.user_id)
        .eq('tenant_id', tenantId)
    }

    return success({
      message: 'Team member removed successfully',
      member_id: memberId,
    })
  } catch (err) {
    console.error('Error in DELETE /api/team/[memberId]:', err)
    return error(err instanceof Error ? err : new Error('Failed to remove team member'))
  }
}
