import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'

export const dynamic = 'force-dynamic'

interface WhmcsInstance {
  instance_id: string
  instance_name: string
  instance_slug: string
  whmcs_url: string
  status: string
  last_sync_at: string | null
}

interface TenantWithInstances {
  tenant_id: string
  tenant_name: string
  tenant_slug: string
  role: string
  is_default: boolean
  currency: string
  instances: WhmcsInstance[]
}

/**
 * GET /api/user/tenants - Get all tenants with their WHMCS instances
 * 
 * Returns tenant hierarchy:
 * - Tenant (organization) 
 *   - WHMCS Instance 1
 *   - WHMCS Instance 2
 *   - ...
 */
export async function GET() {
  try {
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')

    // Only JWT auth (dashboard users) can access this endpoint
    if (authType !== 'jwt' || !authId) {
      return error(new Error('This endpoint requires user authentication'), 401)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Get user's tenants
    const { data: tenants, error: tenantsError } = await supabase
      .rpc('get_user_tenants', { p_user_id: authId })

    if (tenantsError) {
      console.error('Error fetching user tenants:', tenantsError)
      return error(new Error('Failed to fetch tenants'), 500)
    }

    if (!tenants || tenants.length === 0) {
      return success({
        tenants: [],
        total_instances: 0,
      })
    }

    // For each tenant, get its instances
    const tenantsWithInstances: TenantWithInstances[] = await Promise.all(
      tenants.map(async (tenant: { tenant_id: string; tenant_name: string; tenant_slug: string; role: string; is_default: boolean; currency: string }) => {
        const { data: instances, error: instancesError } = await supabase
          .rpc('get_tenant_instances', { 
            p_user_id: authId, 
            p_tenant_id: tenant.tenant_id 
          })

        if (instancesError) {
          console.error(`Error fetching instances for tenant ${tenant.tenant_id}:`, instancesError)
          return { ...tenant, currency: tenant.currency || 'EUR', instances: [] }
        }

        return {
          ...tenant,
          currency: tenant.currency || 'EUR',
          instances: instances || [],
        }
      })
    )

    // Calculate total instances across all tenants
    const totalInstances = tenantsWithInstances.reduce(
      (sum, t) => sum + t.instances.length, 
      0
    )

    return success({
      tenants: tenantsWithInstances,
      total_instances: totalInstances,
    })
  } catch (err) {
    console.error('Error in /api/user/tenants:', err)
    return error(err instanceof Error ? err : new Error('Failed to get user tenants'))
  }
}
