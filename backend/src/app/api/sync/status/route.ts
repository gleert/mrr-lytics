import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

/**
 * GET /api/sync/status - Get recent sync status for tenant's instances
 */
export async function GET() {
  try {
    const headersList = await headers()
    const auth = getAuthContext(headersList)

    if (!auth) {
      throw new UnauthorizedError('Authentication required')
    }

    const supabase = createAdminClient()

    // First get all instances for this tenant
    const { data: instances } = await supabase
      .from('whmcs_instances')
      .select('id, name')
      .eq('tenant_id', auth.tenant_id)

    const instanceIds = instances?.map(i => i.id) || []
    const instanceNameMap = new Map(instances?.map(i => [i.id, i.name]) || [])

    if (instanceIds.length === 0) {
      return success({
        recent_syncs: [],
        last_successful_sync: null,
        is_syncing: false,
        history: [],
      }, { tenant_id: auth.tenant_id })
    }

    // Get recent sync logs for tenant's instances
    const { data: syncLogs, error: dbError } = await supabase
      .from('sync_logs')
      .select('id, instance_id, status, sync_type, started_at, completed_at, records_synced, error_message, duration_ms, triggered_by')
      .in('instance_id', instanceIds)
      .order('started_at', { ascending: false })
      .limit(10)

    if (dbError) {
      throw new Error(dbError.message)
    }

    // Add instance name to each log
    const logsWithInstanceName = syncLogs?.map(log => ({
      ...log,
      instance_name: instanceNameMap.get(log.instance_id) || 'Unknown',
    })) || []

    // Get last successful sync
    const lastSuccess = logsWithInstanceName.find((log) => log.status === 'completed')

    return success({
      recent_syncs: logsWithInstanceName,
      last_successful_sync: lastSuccess || null,
      last_sync_at: lastSuccess?.completed_at || null,
      is_syncing: logsWithInstanceName.some((log) => log.status === 'running') || false,
      history: logsWithInstanceName,
    }, { tenant_id: auth.tenant_id })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to get sync status'))
  }
}
