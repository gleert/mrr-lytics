import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'
import { WEBHOOK_EVENTS, type WebhookEventType } from '@/lib/webhooks'

export const dynamic = 'force-dynamic'

interface UpdateConnectorBody {
  name?: string
  url?: string
  events?: WebhookEventType[]
  headers?: Record<string, string>
  enabled?: boolean
}

/**
 * GET /api/tenants/:tenantId/connectors/:connectorId - Get a single connector
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string; connectorId: string }> }
) {
  try {
    const { tenantId, connectorId } = await params
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')

    if (authType !== 'jwt' || !authId) {
      return error(new Error('This endpoint requires user authentication'), 401)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Check if user has access to this tenant
    const { data: userTenant, error: userTenantError } = await supabase
      .from('user_tenants')
      .select('role')
      .eq('user_id', authId)
      .eq('tenant_id', tenantId)
      .single()

    if (userTenantError || !userTenant) {
      return error(new Error('Tenant not found or access denied'), 404)
    }

    // Get connector
    const { data: connector, error: connectorError } = await supabase
      .from('connectors')
      .select('*')
      .eq('id', connectorId)
      .eq('tenant_id', tenantId)
      .single()

    if (connectorError || !connector) {
      return error(new Error('Connector not found'), 404)
    }

    // Mask the secret
    return success({
      connector: {
        ...connector,
        config: {
          url: connector.config?.url,
          has_secret: !!connector.config?.secret,
          headers: connector.config?.headers || {},
        },
      },
    })
  } catch (err) {
    console.error('Error in GET /api/tenants/:tenantId/connectors/:connectorId:', err)
    return error(err instanceof Error ? err : new Error('Failed to fetch connector'))
  }
}

/**
 * PATCH /api/tenants/:tenantId/connectors/:connectorId - Update a connector
 * 
 * Body:
 * - name: string (optional)
 * - url: string (optional)
 * - events: string[] (optional)
 * - headers: object (optional)
 * - enabled: boolean (optional)
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
      return error(new Error('This endpoint requires user authentication'), 401)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Check if user has admin role on this tenant
    const { data: userTenant, error: userTenantError } = await supabase
      .from('user_tenants')
      .select('role')
      .eq('user_id', authId)
      .eq('tenant_id', tenantId)
      .single()

    if (userTenantError || !userTenant) {
      return error(new Error('Tenant not found or access denied'), 404)
    }

    if (userTenant.role !== 'admin') {
      return error(new Error('Admin role required to update connectors'), 403)
    }

    // Get current connector
    const { data: currentConnector, error: fetchError } = await supabase
      .from('connectors')
      .select('*')
      .eq('id', connectorId)
      .eq('tenant_id', tenantId)
      .single()

    if (fetchError || !currentConnector) {
      return error(new Error('Connector not found'), 404)
    }

    // Parse and validate body
    const body: UpdateConnectorBody = await request.json()
    const updates: Record<string, unknown> = {}

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return error(new Error('Name cannot be empty'), 400)
      }
      updates.name = body.name.trim()
    }

    if (body.enabled !== undefined) {
      updates.enabled = !!body.enabled
    }

    if (body.events !== undefined) {
      if (!Array.isArray(body.events) || body.events.length === 0) {
        return error(new Error('At least one event must be selected'), 400)
      }
      const invalidEvents = body.events.filter(e => !WEBHOOK_EVENTS.includes(e as WebhookEventType))
      if (invalidEvents.length > 0) {
        return error(new Error(`Invalid event types: ${invalidEvents.join(', ')}`), 400)
      }
      updates.events = body.events
    }

    // Handle config updates
    const newConfig = { ...currentConnector.config }

    if (body.url !== undefined) {
      try {
        new URL(body.url)
      } catch {
        return error(new Error('Invalid URL format'), 400)
      }
      if (!body.url.startsWith('https://')) {
        return error(new Error('Webhook URL must use HTTPS'), 400)
      }
      newConfig.url = body.url
    }

    if (body.headers !== undefined) {
      newConfig.headers = body.headers
    }

    // Only update config if something changed
    if (body.url !== undefined || body.headers !== undefined) {
      updates.config = newConfig
    }

    if (Object.keys(updates).length === 0) {
      return error(new Error('No valid fields to update'), 400)
    }

    // Update connector
    const { data: updatedConnector, error: updateError } = await supabase
      .from('connectors')
      .update(updates)
      .eq('id', connectorId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating connector:', updateError)
      return error(new Error('Failed to update connector'), 500)
    }

    return success({
      connector: {
        ...updatedConnector,
        config: {
          url: updatedConnector.config?.url,
          has_secret: !!updatedConnector.config?.secret,
          headers: updatedConnector.config?.headers || {},
        },
      },
    })
  } catch (err) {
    console.error('Error in PATCH /api/tenants/:tenantId/connectors/:connectorId:', err)
    return error(err instanceof Error ? err : new Error('Failed to update connector'))
  }
}

/**
 * DELETE /api/tenants/:tenantId/connectors/:connectorId - Delete a connector
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string; connectorId: string }> }
) {
  try {
    const { tenantId, connectorId } = await params
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')

    if (authType !== 'jwt' || !authId) {
      return error(new Error('This endpoint requires user authentication'), 401)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Check if user has admin role on this tenant
    const { data: userTenant, error: userTenantError } = await supabase
      .from('user_tenants')
      .select('role')
      .eq('user_id', authId)
      .eq('tenant_id', tenantId)
      .single()

    if (userTenantError || !userTenant) {
      return error(new Error('Tenant not found or access denied'), 404)
    }

    if (userTenant.role !== 'admin') {
      return error(new Error('Admin role required to delete connectors'), 403)
    }

    // Delete connector (cascade will delete events)
    const { error: deleteError } = await supabase
      .from('connectors')
      .delete()
      .eq('id', connectorId)
      .eq('tenant_id', tenantId)

    if (deleteError) {
      console.error('Error deleting connector:', deleteError)
      return error(new Error('Failed to delete connector'), 500)
    }

    return success({ deleted: true })
  } catch (err) {
    console.error('Error in DELETE /api/tenants/:tenantId/connectors/:connectorId:', err)
    return error(err instanceof Error ? err : new Error('Failed to delete connector'))
  }
}
