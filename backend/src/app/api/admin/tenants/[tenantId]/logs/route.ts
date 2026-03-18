import { NextRequest } from 'next/server'
import { success, error } from '@/utils/api-response'
import { requireSuperAdmin, getTenant } from '../_superadmin'

export const dynamic = 'force-dynamic'

interface RouteParams { params: Promise<{ tenantId: string }> }

/**
 * GET /api/admin/tenants/:id/logs
 * Returns the last sync logs for all instances of a tenant.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireSuperAdmin()
    const { tenantId } = await params
    const { supabase } = await getTenant(tenantId)

    // Get all instances for this tenant first
    const { data: instances } = await supabase
      .from('whmcs_instances')
      .select('id, name')
      .eq('tenant_id', tenantId)

    const instanceIds = (instances || []).map(i => i.id)
    const instanceNameMap: Record<string, string> = {}
    for (const i of instances || []) instanceNameMap[i.id] = i.name

    if (instanceIds.length === 0) {
      return success({ logs: [] })
    }

    // Get last 10 sync logs across all instances
    const { data: logs, error: logsError } = await supabase
      .from('sync_logs')
      .select('id, instance_id, status, sync_type, triggered_by, started_at, completed_at, duration_ms, records_synced, error_message')
      .in('instance_id', instanceIds)
      .order('started_at', { ascending: false })
      .limit(10)

    if (logsError) throw new Error(logsError.message)

    const logsWithInstance = (logs || []).map(log => ({
      ...log,
      instance_name: instanceNameMap[log.instance_id] ?? 'Unknown',
    }))

    return success({ logs: logsWithInstance })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to fetch logs'))
  }
}
