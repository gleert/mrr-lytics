import { headers } from 'next/headers'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
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

type AdminClient = SupabaseClient

/**
 * Impersonated view: the one tenant being impersonated, with its instances.
 * Mirrors the shape of the normal per-user response so the dashboard needs no
 * special case. Instance filtering matches get_tenant_instances (active/error,
 * ordered by name) so the impersonated tab sees exactly what the real user sees.
 */
async function getImpersonatedTenant(supabase: AdminClient, tenantId: string) {
  const [{ data: tenant }, { data: instances }] = await Promise.all([
    supabase.from('tenants').select('id, name, slug, currency, settings').eq('id', tenantId).single(),
    supabase
      .from('whmcs_instances')
      .select('id, name, slug, whmcs_url, status, last_sync_at')
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'error'])
      .order('name', { ascending: true }),
  ])

  if (!tenant) {
    return error(new Error('Impersonated tenant not found'), 404)
  }

  const settings = (tenant.settings as Record<string, unknown>) || {}
  const mapped: WhmcsInstance[] = (instances || []).map((i) => ({
    instance_id: i.id as string,
    instance_name: i.name as string,
    instance_slug: i.slug as string,
    whmcs_url: i.whmcs_url as string,
    status: i.status as string,
    last_sync_at: i.last_sync_at as string | null,
  }))

  return success({
    tenants: [
      {
        tenant_id: tenant.id as string,
        tenant_name: tenant.name as string,
        tenant_slug: tenant.slug as string,
        role: 'admin',
        is_default: true,
        currency: (tenant.currency as string) || 'EUR',
        company_name: settings.company_name ?? null,
        instances: mapped,
      },
    ],
    total_instances: mapped.length,
  })
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
    const isImpersonating = headersList.get('x-impersonating') === 'true'
    const impersonatedTenantId = headersList.get('x-tenant-id')

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

    // Impersonation: x-auth-id is `impersonation:<superadmin uuid>`, not a real
    // user, so the per-user RPCs below would return nothing. Scope to the single
    // impersonated tenant from x-tenant-id instead (the middleware already
    // verified the token's signature, so this header is trustworthy here).
    if (isImpersonating && impersonatedTenantId) {
      return await getImpersonatedTenant(supabase, impersonatedTenantId)
    }

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

    // Get tenant settings (company_name) for all tenants at once
    const tenantIds = tenants.map((t: { tenant_id: string }) => t.tenant_id)
    const { data: tenantSettings } = await supabase
      .from('tenants')
      .select('id, settings')
      .in('id', tenantIds)

    const settingsMap = new Map(
      (tenantSettings || []).map(t => [t.id, t.settings as Record<string, unknown>])
    )

    // For each tenant, get its instances
    const tenantsWithInstances: TenantWithInstances[] = await Promise.all(
      tenants.map(async (tenant: { tenant_id: string; tenant_name: string; tenant_slug: string; role: string; is_default: boolean; currency: string }) => {
        const { data: instances, error: instancesError } = await supabase
          .rpc('get_tenant_instances', { 
            p_user_id: authId, 
            p_tenant_id: tenant.tenant_id 
          })

        const settings = settingsMap.get(tenant.tenant_id) || {}

        if (instancesError) {
          console.error(`Error fetching instances for tenant ${tenant.tenant_id}:`, instancesError)
          return { ...tenant, currency: tenant.currency || 'EUR', company_name: settings.company_name ?? null, instances: [] }
        }

        return {
          ...tenant,
          currency: tenant.currency || 'EUR',
          company_name: settings.company_name ?? null,
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
