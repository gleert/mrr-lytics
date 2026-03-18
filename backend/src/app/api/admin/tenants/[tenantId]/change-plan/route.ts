import { NextRequest } from 'next/server'
import { success, error } from '@/utils/api-response'
import { requireSuperAdmin, getTenant } from '../_superadmin'

export const dynamic = 'force-dynamic'

interface RouteParams { params: Promise<{ tenantId: string }> }

/**
 * POST /api/admin/tenants/:id/change-plan
 * Changes the subscription plan for a tenant and logs the event.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { userEmail } = await requireSuperAdmin()
    const { tenantId } = await params
    const { supabase, tenant } = await getTenant(tenantId)
    const body = await req.json()
    const { plan_id } = body

    if (!plan_id) throw new Error('plan_id is required')

    // Verify the plan exists
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id, name, price_monthly')
      .eq('id', plan_id)
      .single()

    if (planError || !plan) throw new Error(`Plan not found: ${plan_id}`)

    // Get current subscription
    const { data: currentSub } = await supabase
      .from('subscriptions')
      .select('id, plan_id')
      .eq('tenant_id', tenantId)
      .single()

    const fromPlanId = currentSub?.plan_id ?? null

    if (currentSub) {
      // Update existing subscription
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          plan_id,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentSub.id)

      if (updateError) throw new Error(updateError.message)
    } else {
      // Create new subscription
      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          tenant_id: tenantId,
          plan_id,
          status: 'active',
        })

      if (insertError) throw new Error(insertError.message)
    }

    // Log the plan change event
    await supabase
      .from('subscription_events')
      .insert({
        tenant_id: tenantId,
        subscription_id: currentSub?.id ?? null,
        event_type: 'plan_changed',
        from_plan_id: fromPlanId,
        to_plan_id: plan_id,
        metadata: {
          changed_by: userEmail,
          changed_via: 'superadmin',
          tenant_name: tenant.name,
        },
      })

    return success({
      message: `Plan changed to "${plan.name}" for tenant "${tenant.name}"`,
      plan_id: plan.id,
      plan_name: plan.name,
      price_monthly: plan.price_monthly,
    })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to change plan'))
  }
}
