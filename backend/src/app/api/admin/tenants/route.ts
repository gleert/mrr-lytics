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
 * GET /api/admin/tenants - List all tenants with their users and instances (superadmin only)
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
      .select('id, name, slug, status, currency, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (tenantsError) throw new Error(tenantsError.message)

    // Fetch all users and instances in parallel
    const [usersResult, instancesResult] = await Promise.all([
      supabase
        .from('users')
        .select('id, tenant_id, email, full_name, role, is_active'),
      supabase
        .from('whmcs_instances')
        .select('id, tenant_id, name, whmcs_url, status'),
    ])

    const allUsers = usersResult.data || []
    const allInstances = instancesResult.data || []

    console.log('[admin/tenants] users:', allUsers.length, 'err:', usersResult.error?.message ?? 'none')
    console.log('[admin/tenants] instances:', allInstances.length, 'err:', instancesResult.error?.message ?? 'none')
    console.log('[admin/tenants] tenants:', tenants?.length)

    // Group by tenant_id
    const usersByTenant = new Map<string, typeof allUsers>()
    for (const u of allUsers) {
      if (!u.tenant_id) continue
      const list = usersByTenant.get(u.tenant_id) || []
      list.push(u)
      usersByTenant.set(u.tenant_id, list)
    }

    const instancesByTenant = new Map<string, typeof allInstances>()
    for (const i of allInstances) {
      const list = instancesByTenant.get(i.tenant_id) || []
      list.push(i)
      instancesByTenant.set(i.tenant_id, list)
    }

    const tenantsWithStats = (tenants || []).map(tenant => {
      const members = usersByTenant.get(tenant.id) || []
      const instances = instancesByTenant.get(tenant.id) || []

      return {
        ...tenant,
        member_count: members.length,
        instance_count: instances.length,
        members: members.map(m => ({
          user_id: m.id,
          role: m.role,
          email: m.email ?? null,
          full_name: m.full_name ?? null,
          is_active: m.is_active,
          last_login_at: m.last_login_at,
        })),
        instances: instances.map(i => ({
          id: i.id,
          name: i.name,
          whmcs_url: i.whmcs_url,
          is_active: i.status === 'active',
        })),
      }
    })

    return success({
      tenants: tenantsWithStats,
      total: tenantsWithStats.length,
    })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to fetch tenants'))
  }
}
