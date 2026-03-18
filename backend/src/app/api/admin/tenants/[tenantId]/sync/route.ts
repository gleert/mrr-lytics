import { NextRequest } from 'next/server'
import { success, error } from '@/utils/api-response'
import { requireSuperAdmin, getTenant } from '../_superadmin'
import { syncInstance, type WhmcsInstance } from '@/lib/whmcs/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface RouteParams { params: Promise<{ tenantId: string }> }

/**
 * POST /api/admin/tenants/:id/sync
 * Triggers a manual sync for all instances of a tenant (superadmin only).
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireSuperAdmin()
    const { tenantId } = await params
    const { supabase } = await getTenant(tenantId)

    // Get all active instances for this tenant
    const { data: instances, error: instancesError } = await supabase
      .from('whmcs_instances')
      .select('id, tenant_id, name, whmcs_url, whmcs_api_identifier, whmcs_api_secret, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')

    if (instancesError) throw new Error(instancesError.message)
    if (!instances || instances.length === 0) {
      return success({ message: 'No active instances to sync', results: [] })
    }

    // Sync all instances
    const results = await Promise.allSettled(
      instances.map(instance =>
        syncInstance(instance as WhmcsInstance, {
          type: 'full',
          triggered_by: 'manual',
        })
      )
    )

    const summary = results.map((result, i) => ({
      instance_id: instances[i].id,
      instance_name: instances[i].name,
      success: result.status === 'fulfilled' && result.value.success,
      error: result.status === 'rejected'
        ? result.reason?.message
        : result.status === 'fulfilled' && !result.value.success
          ? result.value.error
          : null,
      records_synced: result.status === 'fulfilled' ? result.value.records_synced : null,
    }))

    const allSuccess = summary.every(r => r.success)

    return success({
      message: allSuccess
        ? `Sync completed for ${instances.length} instance(s)`
        : `Sync completed with errors`,
      results: summary,
    })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to sync tenant'))
  }
}
