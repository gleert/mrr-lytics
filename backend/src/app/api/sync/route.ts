import { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext, requireScope } from '@/lib/auth'
import { syncInstance, syncTenantInstances, type WhmcsInstance } from '@/lib/whmcs/sync'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError, BadRequestError, NotFoundError } from '@/utils/errors'
import { invalidateCache } from '@/lib/cache'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

const syncRequestSchema = z.object({
  type: z.enum(['full', 'incremental']).optional().default('full'),
  instance_id: z.string().uuid().optional(), // Optional: sync specific instance only
})

/**
 * POST /api/sync - Trigger a sync for the authenticated tenant's instances
 * 
 * If instance_id is provided, only that instance is synced.
 * Otherwise, all active instances for the tenant are synced.
 */
export async function POST(request: NextRequest) {
  try {
    const headersList = await headers()
    const auth = getAuthContext(headersList)

    if (!auth) {
      throw new UnauthorizedError('Authentication required')
    }

    requireScope(auth.scopes, 'sync')

    // Parse request body
    let body = {}
    try {
      body = await request.json()
    } catch {
      // Empty body is OK
    }

    const parsed = syncRequestSchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestError('Invalid request', {
        errors: parsed.error.flatten().fieldErrors,
      })
    }

    // Verify tenant exists and is active
    const supabase = createAdminClient()
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, status')
      .eq('id', auth.tenant_id)
      .single()

    if (tenantError || !tenant) {
      throw new NotFoundError('Tenant not found')
    }

    if (tenant.status !== 'active') {
      throw new BadRequestError('Tenant is not active')
    }

    // If instance_id is provided, sync only that instance
    if (parsed.data.instance_id) {
      const { data: instance, error: instError } = await supabase
        .from('whmcs_instances')
        .select('id, tenant_id, name, whmcs_url, whmcs_api_identifier, whmcs_api_secret, status')
        .eq('id', parsed.data.instance_id)
        .eq('tenant_id', auth.tenant_id)
        .single()

      if (instError || !instance) {
        throw new NotFoundError('Instance not found')
      }
      if (!instance.whmcs_api_secret) {
        throw new BadRequestError('API token not configured for this instance')
      }

      const singleResult = await syncInstance(instance as WhmcsInstance, {
        type: parsed.data.type,
        triggered_by: 'manual',
      })

      if (singleResult.success) {
        invalidateCache('daily:metrics:')
        invalidateCache('prev:metrics:')
      }

      return success({
        message: singleResult.success ? 'Sync completed' : 'Sync failed',
        total: 1,
        succeeded: singleResult.success ? 1 : 0,
        failed: singleResult.success ? 0 : 1,
        results: [singleResult],
      }, { tenant_id: auth.tenant_id })
    }

    // Execute sync for all tenant instances
    const result = await syncTenantInstances(auth.tenant_id, {
      type: parsed.data.type,
      triggered_by: 'manual',
    })

    // Check if any instances were synced
    if (result.total === 0) {
      return success({
        message: 'No active instances to sync',
        total: 0,
        succeeded: 0,
        failed: 0,
        results: [],
      }, { tenant_id: auth.tenant_id })
    }

    // Check if all failed
    if (result.failed === result.total) {
      throw new Error('All instance syncs failed')
    }

    // Auto-generate categories based on product types (if not already created)
    let categoriesSetup = null
    try {
      const { data: setupResult } = await supabase
        .rpc('setup_default_categories_for_tenant', { p_tenant_id: auth.tenant_id })
      categoriesSetup = setupResult
    } catch (catError) {
      // Log but don't fail the sync if category setup fails
      console.warn('Failed to auto-generate categories:', catError)
    }

    if (result.succeeded > 0) {
      invalidateCache('daily:metrics:')
      invalidateCache('prev:metrics:')
    }

    return success({
      message: `Sync completed: ${result.succeeded}/${result.total} instances succeeded`,
      total: result.total,
      succeeded: result.succeeded,
      failed: result.failed,
      results: result.results.map((r) => ({
        sync_log_id: r.sync_log_id,
        success: r.success,
        records_synced: r.records_synced,
        duration_ms: r.duration_ms,
        snapshot_id: r.snapshot_id,
        error: r.error,
      })),
      categories_setup: categoriesSetup,
    }, { tenant_id: auth.tenant_id })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Sync failed'))
  }
}
