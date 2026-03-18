import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError, ForbiddenError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

// Superadmin emails from env (comma-separated)
const SUPERADMIN_EMAILS = (process.env.SUPERADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

function isSuperAdmin(email: string | null): boolean {
  if (!email) return false
  return SUPERADMIN_EMAILS.includes(email.toLowerCase())
}

/**
 * GET /api/admin/tenants - List all tenants (superadmin only)
 */
export async function GET() {
  try {
    const headersList = await headers()
    const userEmail = headersList.get('x-user-email')

    if (!userEmail) throw new UnauthorizedError('Authentication required')
    if (!isSuperAdmin(userEmail)) throw new ForbiddenError('Superadmin access required')

    const supabase = createAdminClient()

    // Fetch all tenants with owner info and stats
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, slug, plan, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (tenantsError) throw new Error(tenantsError.message)

    // For each tenant get member count, instance count, and user list
    const tenantsWithStats = await Promise.all(
      (tenants || []).map(async (tenant) => {
        const [membersResult, instancesResult] = await Promise.all([
          supabase
            .from('tenant_users')
            .select('user_id, role, users(id, email, raw_user_meta_data)', { count: 'exact' })
            .eq('tenant_id', tenant.id),
          supabase
            .from('whmcs_instances')
            .select('id, name, whmcs_url, is_active', { count: 'exact' })
            .eq('tenant_id', tenant.id),
        ])

        const members = (membersResult.data || []).map((m: {
          user_id: string
          role: string
          users: { id: string; email: string; raw_user_meta_data: Record<string, string> } | null
        }) => ({
          user_id: m.user_id,
          role: m.role,
          email: m.users?.email ?? null,
          full_name: m.users?.raw_user_meta_data?.full_name ?? m.users?.raw_user_meta_data?.name ?? null,
        }))

        return {
          ...tenant,
          member_count: membersResult.count ?? 0,
          instance_count: instancesResult.count ?? 0,
          members,
          instances: instancesResult.data || [],
        }
      })
    )

    return success({
      tenants: tenantsWithStats,
      total: tenantsWithStats.length,
    })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to fetch tenants'))
  }
}
