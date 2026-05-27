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

    // Determine which instances to sync and what type each needs.
    //
    // A full sync is forced for any instance whose last successful full sync is
    // more than 24h old. Incremental syncs miss newly-registered domains
    // (tbldomains.registrationdate is date-only, so a same-day registration is
    // always < the incremental `since` timestamp, and updated_at is unreliable),
    // so a guaranteed daily full sync is what backfills them. The previous rule
    // (full only when the cron fired in the 00:00 UTC hour AND the instance was
    // "due") silently skipped the full sync for days whenever an instance
    // happened to sync within its interval before midnight.
    const now = new Date()
    const FULL_SYNC_MAX_AGE_MS = 24 * 60 * 60 * 1000

    const fullSyncCutoff = new Date(now.getTime() - FULL_SYNC_MAX_AGE_MS).toISOString()
    const { data: recentFulls } = await supabase
      .from('sync_logs')
      .select('instance_id')
      .eq('status', 'completed')
      .eq('sync_type', 'full')
      .gte('completed_at', fullSyncCutoff)
    const hasRecentFull = new Set((recentFulls ?? []).map((r) => r.instance_id))

    const dueInstances = allInstances
      .map((inst) => {
        const intervalMs = (inst.sync_interval_hours ?? 6) * 60 * 60 * 1000
        const isDue =
          !inst.last_sync_at ||
          now.getTime() - new Date(inst.last_sync_at).getTime() >= intervalMs
        const needsFull = !hasRecentFull.has(inst.id)
        return { instance: inst, isDue, needsFull }
      })
      // Sync if due by interval, or if a full sync is overdue — so the daily
      // full runs even when the instance isn't otherwise due for an increment.
      .filter(({ isDue, needsFull }) => isDue || needsFull)

    if (dueInstances.length === 0) {
      return success({
        message: `No instances due for sync (${allInstances.length} active, none overdue)`,
        results: [],
      })
    }

    // Sync each instance (full when its last full sync is >24h old)
    const results = await Promise.allSettled(
      dueInstances.map(async ({ instance, needsFull }) => {
        const result = await syncInstance(instance as WhmcsInstance, {
          type: needsFull ? 'full' : 'incremental',
          triggered_by: 'cron',
        })
        return {
          instance_id: instance.id,
          instance_name: instance.name,
          tenant_id: instance.tenant_id,
          sync_type: needsFull ? 'full' : 'incremental',
          ...result,
        }
      })
    )

    // Format results
    const syncResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      }
      const { instance, needsFull } = dueInstances[index]
      return {
        instance_id: instance.id,
        instance_name: instance.name,
        tenant_id: instance.tenant_id,
        sync_type: needsFull ? 'full' : 'incremental',
        success: false,
        sync_log_id: '',
        records_synced: {},
        duration_ms: 0,
        error: result.reason?.message || 'Unknown error',
      }
    })

    const successCount = syncResults.filter((r) => r.success).length
    const failureCount = syncResults.filter((r) => !r.success).length
    const fullCount = dueInstances.filter((d) => d.needsFull).length

    return success({
      message: `Cron sync completed: ${successCount} succeeded, ${failureCount} failed`,
      full_syncs: fullCount,
      incremental_syncs: dueInstances.length - fullCount,
      total: syncResults.length,
      succeeded: successCount,
      failed: failureCount,
      results: syncResults,
    })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Cron sync failed'))
  }
}
