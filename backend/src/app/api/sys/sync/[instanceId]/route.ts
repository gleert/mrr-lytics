import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncInstance, type WhmcsInstance } from '@/lib/whmcs/sync'
import { success, error } from '@/utils/api-response'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface RouteParams {
  params: Promise<{ instanceId: string }>
}

/**
 * POST /api/sys/sync/[instanceId] - Trigger a full sync for any instance
 *
 * Admin-key-authenticated endpoint (ADMIN_API_KEY via Bearer token).
 * Useful for triggering syncs without a user JWT.
 *
 * Body (optional):
 * - type: 'full' | 'incremental' (default: 'full')
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const headersList = await headers()
    const isAdmin = headersList.get('x-is-admin')

    if (!isAdmin) {
      return error(new Error('Admin key required'), 401)
    }

    const { instanceId } = await params

    const body = await request.json().catch(() => ({}))
    const syncType: 'full' | 'incremental' = body.type === 'incremental' ? 'incremental' : 'full'

    const supabase = createAdminClient()

    const { data: instance, error: instanceError } = await supabase
      .from('whmcs_instances')
      .select('id, tenant_id, name, whmcs_url, whmcs_api_identifier, whmcs_api_secret, status')
      .eq('id', instanceId)
      .single()

    if (instanceError || !instance) {
      return error(new Error('Instance not found'), 404)
    }

    if (!instance.whmcs_api_secret) {
      return error(new Error('API token not configured for this instance'), 400)
    }

    console.log(`[sys/sync] Starting ${syncType} sync for instance ${instanceId} (${instance.name})`)

    const result = await syncInstance(instance as WhmcsInstance, {
      type: syncType,
      triggered_by: 'manual',
    })

    if (!result.success) {
      return error(new Error(result.error || 'Sync failed'), 500)
    }

    return success({
      instance_id: instanceId,
      instance_name: instance.name,
      type: syncType,
      records_synced: result.records_synced,
      duration_ms: result.duration_ms,
    })
  } catch (err) {
    console.error('Error in POST /api/sys/sync/[instanceId]:', err)
    return error(err instanceof Error ? err : new Error('Failed to sync instance'))
  }
}
