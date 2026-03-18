import { NextRequest } from 'next/server'
import { success, error } from '@/utils/api-response'
import { requireSuperAdmin, getTenant } from '../_superadmin'

export const dynamic = 'force-dynamic'

interface RouteParams { params: Promise<{ tenantId: string }> }

/**
 * POST /api/admin/tenants/:id/suspend
 * Suspends a tenant. Suspended tenants cannot access the dashboard.
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireSuperAdmin()
    const { tenantId } = await params
    const { supabase, tenant } = await getTenant(tenantId)

    if (tenant.status === 'suspended') {
      return success({ message: 'Tenant is already suspended', status: 'suspended' })
    }

    const { error: updateError } = await supabase
      .from('tenants')
      .update({ status: 'suspended', updated_at: new Date().toISOString() })
      .eq('id', tenantId)

    if (updateError) throw new Error(updateError.message)

    return success({ message: `Tenant "${tenant.name}" has been suspended`, status: 'suspended' })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to suspend tenant'))
  }
}
