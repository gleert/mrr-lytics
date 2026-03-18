import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ memberId: string }>
}

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * PATCH /api/team/[memberId] - Update a team member's role
 * memberId is the user_id (UUID)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { memberId } = await params
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')
    const tenantId = headersList.get('x-tenant-id')

    if (authType !== 'jwt' || !authId) return error(new Error('Authentication required'), 401)
    if (!tenantId) return error(new Error('Tenant not found'), 400)

    const supabase = makeSupabase()

    // Verify current user is admin
    const { data: currentUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', authId)
      .eq('tenant_id', tenantId)
      .single()

    if (!currentUser || currentUser.role !== 'admin') {
      return error(new Error('Only admins can update team members'), 403)
    }

    // Get the member to update
    const { data: member, error: memberError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', memberId)
      .eq('tenant_id', tenantId)
      .single()

    if (memberError || !member) return error(new Error('Team member not found'), 404)
    if (member.id === authId) return error(new Error('You cannot change your own role'), 400)

    const body = await request.json()
    const { role } = body

    if (!role || !['admin', 'member', 'viewer'].includes(role)) {
      return error(new Error('Invalid role'), 400)
    }

    // Check if this would remove the last admin
    if (member.role === 'admin' && role !== 'admin') {
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('role', 'admin')

      if (count && count <= 1) {
        return error(new Error('Cannot demote the last admin. Promote another admin first.'), 400)
      }
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ role })
      .eq('id', memberId)
      .eq('tenant_id', tenantId)

    if (updateError) return error(new Error('Failed to update member role'), 500)

    return success({ message: 'Member role updated', member_id: memberId, new_role: role })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to update team member'))
  }
}

/**
 * DELETE /api/team/[memberId] - Remove a team member
 * memberId is the user_id (UUID)
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { memberId } = await params
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')
    const tenantId = headersList.get('x-tenant-id')

    if (authType !== 'jwt' || !authId) return error(new Error('Authentication required'), 401)
    if (!tenantId) return error(new Error('Tenant not found'), 400)

    const supabase = makeSupabase()

    // Verify current user is admin
    const { data: currentUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', authId)
      .eq('tenant_id', tenantId)
      .single()

    if (!currentUser || currentUser.role !== 'admin') {
      return error(new Error('Only admins can remove team members'), 403)
    }

    // Get member
    const { data: member, error: memberError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', memberId)
      .eq('tenant_id', tenantId)
      .single()

    if (memberError || !member) return error(new Error('Team member not found'), 404)
    if (member.id === authId) return error(new Error('You cannot remove yourself'), 400)

    // Check last admin
    if (member.role === 'admin') {
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('role', 'admin')

      if (count && count <= 1) {
        return error(new Error('Cannot remove the last admin'), 400)
      }
    }

    // Remove from tenant by setting tenant_id to null
    const { error: deleteError } = await supabase
      .from('users')
      .update({ tenant_id: null, is_active: false })
      .eq('id', memberId)
      .eq('tenant_id', tenantId)

    if (deleteError) return error(new Error('Failed to remove team member'), 500)

    return success({ message: 'Team member removed', member_id: memberId })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to remove team member'))
  }
}
