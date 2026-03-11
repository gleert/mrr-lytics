import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'
import { WEBHOOK_EVENTS, type WebhookEventType } from '@/lib/webhooks'

export const dynamic = 'force-dynamic'

interface UpdateSlackConnectorBody {
  name?: string
  webhook_url?: string
  channel?: string
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

function maskWebhookUrl(url: string | undefined): string {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}/...`
  } catch {
    return '***'
  }
}

/**
 * PATCH /api/tenants/:tenantId/slack-connectors/:connectorId
 * Update a Slack connector
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
      .eq('type', 'slack')
      .single()

    if (fetchError || !existing) {
      return error(new Error('Slack connector not found'), 404)
    }

    const body: UpdateSlackConnectorBody = await request.json()

    if (body.events !== undefined) {
      if (!body.events.length) return error(new Error('At least one event must be selected'), 400)
      const invalid = body.events.filter(e => !WEBHOOK_EVENTS.includes(e as WebhookEventType))
      if (invalid.length > 0) return error(new Error(`Invalid event types: ${invalid.join(', ')}`), 400)
    }

    if (body.webhook_url !== undefined) {
      try {
        new URL(body.webhook_url)
      } catch {
        return error(new Error('Invalid webhook URL'), 400)
      }
    }

    const existingConfig = existing.config as Record<string, unknown>
    const updatedConfig = {
      ...existingConfig,
      ...(body.webhook_url !== undefined && { webhook_url: body.webhook_url.trim() }),
      ...(body.channel !== undefined && { channel: body.channel?.trim() || null }),
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
      console.error('Error updating Slack connector:', updateError)
      return error(new Error('Failed to update Slack connector'), 500)
    }

    return success({
      connector: {
        ...updated,
        config: {
          ...updated.config,
          webhook_url: maskWebhookUrl(updated.config?.webhook_url as string | undefined),
          has_webhook_url: true,
        },
      },
    })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to update Slack connector'))
  }
}

/**
 * DELETE /api/tenants/:tenantId/slack-connectors/:connectorId
 * Delete a Slack connector
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
      .eq('type', 'slack')
      .single()

    if (fetchError || !existing) {
      return error(new Error('Slack connector not found'), 404)
    }

    const { error: deleteError } = await supabase
      .from('connectors')
      .delete()
      .eq('id', connectorId)

    if (deleteError) {
      console.error('Error deleting Slack connector:', deleteError)
      return error(new Error('Failed to delete Slack connector'), 500)
    }

    return success({ deleted: true })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to delete Slack connector'))
  }
}
