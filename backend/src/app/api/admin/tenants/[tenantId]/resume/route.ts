import { NextRequest } from 'next/server'
import { success, error } from '@/utils/api-response'
import { requireSuperAdmin, getTenant } from '../_superadmin'

export const dynamic = 'force-dynamic'

interface RouteParams { params: Promise<{ tenantId: string }> }

/**
 * POST /api/admin/tenants/:id/resume
 * Reactivates a suspended tenant.
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireSuperAdmin()
    const { tenantId } = await params
    const { supabase, tenant } = await getTenant(tenantId)

    if (tenant.status === 'active') {
      return success({ message: 'Tenant is already active', status: 'active' })
    }

    const { error: updateError } = await supabase
      .from('tenants')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', tenantId)

    if (updateError) throw new Error(updateError.message)

    return success({ message: `Tenant "${tenant.name}" has been reactivated`, status: 'active' })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to resume tenant'))
  }
}
