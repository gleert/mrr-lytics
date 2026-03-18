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

    // Fetch all tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, slug, plan, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (tenantsError) throw new Error(tenantsError.message)

    // For each tenant get member count, instance count, and user list
    const tenantsWithStats = await Promise.all(
      (tenants || []).map(async (tenant) => {
        const [tuResult, instancesResult] = await Promise.all([
          supabase
            .from('tenant_users')
            .select('user_id, role')
            .eq('tenant_id', tenant.id),
          supabase
            .from('whmcs_instances')
            .select('id, name, whmcs_url, is_active')
            .eq('tenant_id', tenant.id),
        ])

        // Get user emails from users table
        const userIds = (tuResult.data || []).map(m => m.user_id)
        const userEmailMap: Record<string, { email: string; full_name: string }> = {}

        if (userIds.length > 0) {
          const { data: usersData } = await supabase
            .from('users')
            .select('id, email, full_name')
            .in('id', userIds)

          if (usersData) {
            for (const u of usersData) {
              userEmailMap[u.id] = {
                email: (u.email as string | null) ?? '',
                full_name: (u.full_name as string | null) ?? '',
              }
            }
          }
        }

        return {
          ...tenant,
          member_count: tuResult.data?.length ?? 0,
          instance_count: instancesResult.data?.length ?? 0,
          members: (tuResult.data || []).map(m => ({
            user_id: m.user_id,
            role: m.role,
            email: userEmailMap[m.user_id]?.email ?? null,
            full_name: userEmailMap[m.user_id]?.full_name ?? null,
          })),
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
