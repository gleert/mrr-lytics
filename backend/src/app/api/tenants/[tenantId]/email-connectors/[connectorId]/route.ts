import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'
import { WEBHOOK_EVENTS, type WebhookEventType } from '@/lib/webhooks'

export const dynamic = 'force-dynamic'

interface UpdateEmailConnectorBody {
  name?: string
  host?: string
  port?: number
  secure?: boolean
  user?: string
  password?: string
  from?: string
  to?: string
  events?: WebhookEventType[]
  enabled?: boolean
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

/**
 * PATCH /api/tenants/:tenantId/email-connectors/:connectorId
 * Update an email connector
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

    // Fetch current connector to verify ownership and get existing config
    const { data: existing, error: fetchError } = await supabase
      .from('connectors')
      .select('*')
      .eq('id', connectorId)
      .eq('tenant_id', tenantId)
      .eq('type', 'email')
      .single()

    if (fetchError || !existing) {
      return error(new Error('Email connector not found'), 404)
    }

    const body: UpdateEmailConnectorBody = await request.json()

    // Validate events if provided
    if (body.events !== undefined) {
      if (!body.events.length) return error(new Error('At least one event must be selected'), 400)
      const invalidEvents = body.events.filter(e => !WEBHOOK_EVENTS.includes(e as WebhookEventType))
      if (invalidEvents.length > 0) {
        return error(new Error(`Invalid event types: ${invalidEvents.join(', ')}`), 400)
      }
    }

    // Build updated config — merge existing config with any new values
    const existingConfig = existing.config as Record<string, unknown>
    const updatedConfig = {
      ...existingConfig,
      ...(body.host !== undefined && { host: body.host.trim() }),
      ...(body.port !== undefined && { port: body.port }),
      ...(body.secure !== undefined && { secure: !!body.secure }),
      ...(body.user !== undefined && { user: body.user.trim() }),
      ...(body.password !== undefined && body.password.trim() && { password: body.password }),
      ...(body.from !== undefined && { from: body.from.trim() }),
      ...(body.to !== undefined && { to: body.to.trim() }),
    }

    // Build the update payload
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
      console.error('Error updating email connector:', updateError)
      return error(new Error('Failed to update email connector'), 500)
    }

    return success({
      connector: {
        ...updated,
        config: { ...updated.config, password: undefined, has_password: true },
      },
    })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to update email connector'))
  }
}

/**
 * DELETE /api/tenants/:tenantId/email-connectors/:connectorId
 * Delete an email connector
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

    // Verify connector belongs to this tenant
    const { data: existing, error: fetchError } = await supabase
      .from('connectors')
      .select('id')
      .eq('id', connectorId)
      .eq('tenant_id', tenantId)
      .eq('type', 'email')
      .single()

    if (fetchError || !existing) {
      return error(new Error('Email connector not found'), 404)
    }

    const { error: deleteError } = await supabase
      .from('connectors')
      .delete()
      .eq('id', connectorId)

    if (deleteError) {
      console.error('Error deleting email connector:', deleteError)
      return error(new Error('Failed to delete email connector'), 500)
    }

    return success({ deleted: true })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to delete email connector'))
  }
}
