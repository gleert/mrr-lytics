import { NextRequest } from 'next/server'
import { success, error } from '@/utils/api-response'
import { requireSuperAdmin, getTenant } from '../_superadmin'

export const dynamic = 'force-dynamic'

interface RouteParams { params: Promise<{ tenantId: string }> }

/**
 * DELETE /api/admin/tenants/:id/delete
 * Permanently deletes a tenant and all associated data:
 * - Users (sets tenant_id to null so they don't lose their auth account)
 * - WHMCS instances and all related data
 * - Subscriptions and events
 * - Sync logs, metrics, snapshots
 * This action is irreversible.
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { userEmail } = await requireSuperAdmin()
    const { tenantId } = await params
    const { supabase, tenant } = await getTenant(tenantId)

    console.log(`[superadmin] ${userEmail} is deleting tenant ${tenantId} (${tenant.name})`)

    // Delete in order to respect FK constraints

    // 1. Get all instance IDs first
    const { data: instances } = await supabase
      .from('whmcs_instances')
      .select('id')
      .eq('tenant_id', tenantId)

    const instanceIds = (instances || []).map(i => i.id)

    if (instanceIds.length > 0) {
      // 2. Delete all WHMCS data for these instances
      await Promise.all([
        supabase.from('whmcs_clients').delete().in('instance_id', instanceIds),
        supabase.from('whmcs_hosting').delete().in('instance_id', instanceIds),
        supabase.from('whmcs_invoices').delete().in('instance_id', instanceIds),
        supabase.from('whmcs_invoice_items').delete().in('instance_id', instanceIds),
        supabase.from('whmcs_domains').delete().in('instance_id', instanceIds),
        supabase.from('whmcs_products').delete().in('instance_id', instanceIds),
        supabase.from('sync_logs').delete().in('instance_id', instanceIds),
      ])

      // 3. Delete instances
      await supabase.from('whmcs_instances').delete().eq('tenant_id', tenantId)
    }

    // 4. Delete metrics and snapshots
    await Promise.all([
      supabase.from('metrics_daily').delete().eq('tenant_id', tenantId),
      supabase.from('metrics_snapshots').delete().eq('tenant_id', tenantId),
    ])

    // 5. Delete subscriptions
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('tenant_id', tenantId)

    const subIds = (subs || []).map(s => s.id)
    if (subIds.length > 0) {
      await supabase.from('subscription_events').delete().in('subscription_id', subIds)
    }
    await supabase.from('subscriptions').delete().eq('tenant_id', tenantId)

    // 6. Remove users from this tenant (don't delete auth accounts, just unlink)
    await supabase
      .from('users')
      .update({ tenant_id: null, is_active: false })
      .eq('tenant_id', tenantId)

    // 7. Delete categories
    await supabase.from('categories').delete().eq('tenant_id', tenantId)

    // 8. Delete API keys and tenant settings
    await supabase.from('api_keys').delete().eq('tenant_id', tenantId)

    // 9. Finally delete the tenant
    const { error: deleteError } = await supabase
      .from('tenants')
      .delete()
      .eq('id', tenantId)

    if (deleteError) throw new Error(`Failed to delete tenant: ${deleteError.message}`)

    console.log(`[superadmin] Tenant ${tenantId} (${tenant.name}) deleted by ${userEmail}`)

    return success({
      message: `Tenant "${tenant.name}" and all associated data has been permanently deleted`,
      tenant_id: tenantId,
      tenant_name: tenant.name,
    })
  } catch (err) {
    console.error('[superadmin] Error deleting tenant:', err)
    return error(err instanceof Error ? err : new Error('Failed to delete tenant'))
  }
}
