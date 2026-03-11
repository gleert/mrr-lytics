import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncInstance, type WhmcsInstance } from '@/lib/whmcs/sync'
import { success, error } from '@/utils/api-response'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for full sync

interface RouteParams {
  params: Promise<{ instanceId: string }>
}

/**
 * POST /api/instances/[instanceId]/sync - Trigger full sync for a specific instance
 * 
 * This endpoint fetches all data from WHMCS and syncs it to the database.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { instanceId } = await params
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')

    if (authType !== 'jwt' || !authId) {
      return error(new Error('This endpoint requires user authentication'), 401)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get instance details
    const { data: instance, error: instanceError } = await supabase
      .from('whmcs_instances')
      .select('id, tenant_id, name, whmcs_url, whmcs_api_identifier, whmcs_api_secret, status')
      .eq('id', instanceId)
      .single()

    if (instanceError || !instance) {
      return error(new Error('Instance not found'), 404)
    }

    // Verify user has access to this instance's tenant
    const { data: userTenant } = await supabase
      .from('user_tenants')
      .select('role')
      .eq('user_id', authId)
      .eq('tenant_id', instance.tenant_id)
      .single()

    if (!userTenant) {
      return error(new Error('Access denied'), 403)
    }

    // Check if instance has API token configured
    if (!instance.whmcs_api_secret) {
      return error(new Error('API token not configured for this instance'), 400)
    }

    // Execute the full sync
    console.log(`[Sync] Starting sync for instance ${instanceId} (${instance.name})`)
    
    const result = await syncInstance(instance as WhmcsInstance, {
      type: 'full',
      triggered_by: 'manual',
    })

    if (!result.success) {
      console.error(`[Sync] Failed for instance ${instanceId}:`, result.error)
      return error(new Error(result.error || 'Sync failed'), 500)
    }

    console.log(`[Sync] Completed for instance ${instanceId}:`, result.records_synced)

    return success({
      connected: true,
      message: 'Sync completed successfully',
      sync_log_id: result.sync_log_id,
      records_synced: result.records_synced,
      duration_ms: result.duration_ms,
      snapshot_id: result.snapshot_id,
      metrics_id: result.metrics_id,
    })

  } catch (err) {
    console.error('Error in POST /api/instances/[instanceId]/sync:', err)
    return error(err instanceof Error ? err : new Error('Failed to sync instance'))
  }
}
