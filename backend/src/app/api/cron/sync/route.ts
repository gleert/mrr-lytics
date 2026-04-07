import { createAdminClient } from '@/lib/supabase/admin'
import { syncInstance, type WhmcsInstance } from '@/lib/whmcs/sync'
import { success, error } from '@/utils/api-response'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

/**
 * GET /api/cron/sync - Scheduled sync for all active instances
 * 
 * This endpoint is called by Vercel Cron or similar scheduler.
 * Authentication is handled by middleware using CRON_SECRET.
 * 
 * Syncs all active WHMCS instances across all tenants.
 * After each successful sync, a daily metrics snapshot is created.
 */
export async function GET() {
  try {
    const supabase = createAdminClient()

    // Get all active (or previously errored) instances with sync enabled
    // Instances with status 'error' must be retried automatically by the cron
    const { data: allInstances, error: dbError } = await supabase
      .from('whmcs_instances')
      .select('id, tenant_id, name, whmcs_url, whmcs_api_identifier, whmcs_api_secret, status, sync_enabled, sync_interval_hours, last_sync_at')
      .in('status', ['active', 'error'])
      .eq('sync_enabled', true)
      .not('whmcs_api_secret', 'is', null)

    if (dbError) {
      throw new Error(dbError.message)
    }

    if (!allInstances || allInstances.length === 0) {
      return success({ message: 'No active instances to sync', results: [] })
    }

    // Filter instances that are due for sync based on their interval
    const now = new Date()
    const instances = allInstances.filter((inst) => {
      if (!inst.last_sync_at) return true // Never synced, always due
      const lastSync = new Date(inst.last_sync_at)
      const intervalMs = (inst.sync_interval_hours ?? 6) * 60 * 60 * 1000
      return now.getTime() - lastSync.getTime() >= intervalMs
    })

    if (instances.length === 0) {
      return success({
        message: `No instances due for sync (${allInstances.length} active, none overdue)`,
        results: [],
      })
    }

    // Determine sync type based on time
    // Full sync at midnight (00:00), incremental otherwise
    const hour = now.getUTCHours()
    const isFullSync = hour === 0

    // Sync each instance
    const results = await Promise.allSettled(
      instances.map(async (instance) => {
        const result = await syncInstance(instance as WhmcsInstance, {
          type: isFullSync ? 'full' : 'incremental',
          triggered_by: 'cron',
        })
        return {
          instance_id: instance.id,
          instance_name: instance.name,
          tenant_id: instance.tenant_id,
          ...result,
        }
      })
    )

    // Format results
    const syncResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      }
      return {
        instance_id: instances[index].id,
        instance_name: instances[index].name,
        tenant_id: instances[index].tenant_id,
        success: false,
        sync_log_id: '',
        records_synced: {},
        duration_ms: 0,
        error: result.reason?.message || 'Unknown error',
      }
    })

    const successCount = syncResults.filter((r) => r.success).length
    const failureCount = syncResults.filter((r) => !r.success).length

    return success({
      message: `Cron sync completed: ${successCount} succeeded, ${failureCount} failed`,
      sync_type: isFullSync ? 'full' : 'incremental',
      total: syncResults.length,
      succeeded: successCount,
      failed: failureCount,
      results: syncResults,
    })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Cron sync failed'))
  }
}
