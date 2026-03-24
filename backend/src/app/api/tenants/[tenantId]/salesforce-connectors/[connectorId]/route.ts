import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'
import { WEBHOOK_EVENTS, type WebhookEventType } from '@/lib/webhooks'

export const dynamic = 'force-dynamic'

interface UpdateSalesforceConnectorBody {
  name?: string
  access_token?: string
  instance_url?: string
  events?: WebhookEventType[]
  enabled?: boolean
  actions?: {
    create_contacts?: boolean
    update_lead_status?: boolean
    log_tasks?: boolean
  }
}

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function checkAdmin(supabase: ReturnType<typeof makeSupabase>, authId: string, tenantId: string) {
  const { data, error: err } = await supabase
    .from('user_tenants')
    .select('role')
    .eq('user_id', authId)
    .eq('tenant_id', tenantId)
    .single()
  return { userTenant: data, err }
}

function maskConfig(config: Record<string, unknown>): Record<string, unknown> {
  const token = config?.access_token as string | undefined
  return {
    ...config,
    access_token: token ? `${token.substring(0, 6)}***` : '',
    has_access_token: !!token,
  }
}

/**
 * PATCH /api/tenants/:tenantId/salesforce-connectors/:connectorId
 * Update a Salesforce connector
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string; connectorId: string }> }
) {
  try {
    const { tenantId, connectorId } = await params
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')

    if (authType !== 'jwt' || !authId) {
      return error(new Error('Authentication required'), 401)
    }

    const supabase = makeSupabase()
    const { userTenant, err } = await checkAdmin(supabase, authId, tenantId)
    if (err || !userTenant) return error(new Error('Tenant not found or access denied'), 404)
    if (userTenant.role !== 'admin') return error(new Error('Admin role required'), 403)

    const { data: existing, error: fetchError } = await supabase
      .from('connectors')
      .select('*')
      .eq('id', connectorId)
      .eq('tenant_id', tenantId)
      .eq('type', 'salesforce')
      .single()

    if (fetchError || !existing) {
      return error(new Error('Salesforce connector not found'), 404)
    }

    const body: UpdateSalesforceConnectorBody = await request.json()

    if (body.events !== undefined) {
      if (!body.events.length) return error(new Error('At least one event must be selected'), 400)
      const invalid = body.events.filter(e => !WEBHOOK_EVENTS.includes(e as WebhookEventType))
      if (invalid.length > 0) return error(new Error(`Invalid event types: ${invalid.join(', ')}`), 400)
    }

    const existingConfig = existing.config as Record<string, unknown>
    const existingActions = (existingConfig.actions || {}) as Record<string, boolean>

    const updatedConfig = {
      ...existingConfig,
      ...(body.access_token !== undefined && { access_token: body.access_token.trim() }),
      ...(body.instance_url !== undefined && { instance_url: body.instance_url.trim().replace(/\/$/, '') }),
      ...(body.actions !== undefined && {
        actions: {
          create_contacts: body.actions.create_contacts ?? existingActions.create_contacts ?? true,
          update_lead_status: body.actions.update_lead_status ?? existingActions.update_lead_status ?? true,
          log_tasks: body.actions.log_tasks ?? existingActions.log_tasks ?? true,
        },
      }),
    }

    const updatePayload: Record<string, unknown> = {
      config: updatedConfig,
      updated_at: new Date().toISOString(),
    }
    if (body.name !== undefined) updatePayload.name = body.name.trim()
    if (body.events !== undefined) updatePayload.events = body.events
    if (body.enabled !== undefined) updatePayload.enabled = body.enabled

    const { data: updated, error: updateError } = await supabase
      .from('connectors')
      .update(updatePayload)
      .eq('id', connectorId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating Salesforce connector:', updateError)
      return error(new Error('Failed to update Salesforce connector'), 500)
    }

    return success({
      connector: {
        ...updated,
        config: maskConfig(updated.config as Record<string, unknown>),
      },
    })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to update Salesforce connector'))
  }
}

/**
 * DELETE /api/tenants/:tenantId/salesforce-connectors/:connectorId
 * Delete a Salesforce connector
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ tenantId: string; connectorId: string }> }
) {
  try {
    const { tenantId, connectorId } = await params
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')

    if (authType !== 'jwt' || !authId) {
      return error(new Error('Authentication required'), 401)
    }

    const supabase = makeSupabase()
    const { userTenant, err } = await checkAdmin(supabase, authId, tenantId)
    if (err || !userTenant) return error(new Error('Tenant not found or access denied'), 404)
    if (userTenant.role !== 'admin') return error(new Error('Admin role required'), 403)

    const { data: existing, error: fetchError } = await supabase
      .from('connectors')
      .select('id')
      .eq('id', connectorId)
      .eq('tenant_id', tenantId)
      .eq('type', 'salesforce')
      .single()

    if (fetchError || !existing) {
      return error(new Error('Salesforce connector not found'), 404)
    }

    const { error: deleteError } = await supabase
      .from('connectors')
      .delete()
      .eq('id', connectorId)

    if (deleteError) {
      console.error('Error deleting Salesforce connector:', deleteError)
      return error(new Error('Failed to delete Salesforce connector'), 500)
    }

    return success({ deleted: true })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to delete Salesforce connector'))
  }
}
