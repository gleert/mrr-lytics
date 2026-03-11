import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'
import { sendTestEvent, type Connector } from '@/lib/webhooks'

export const dynamic = 'force-dynamic'

/**
 * POST /api/tenants/:tenantId/connectors/:connectorId/test - Send a test webhook
 * 
 * Sends a test event to verify the webhook configuration is working.
 */
export async function POST(
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
      return error(new Error('Admin role required to test connectors'), 403)
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

    if (!connector.enabled) {
      return error(new Error('Cannot test a disabled connector'), 400)
    }

    // Send test event
    const eventId = await sendTestEvent(connector as Connector)

    // Get the event result
    const { data: event, error: eventError } = await supabase
      .from('connector_events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (eventError) {
      console.error('Error fetching test event result:', eventError)
    }

    return success({
      event_id: eventId,
      status: event?.status || 'pending',
      response_code: event?.response_code,
      error_message: event?.error_message,
      message: event?.status === 'sent' 
        ? 'Test webhook sent successfully'
        : event?.error_message || 'Test webhook queued for delivery',
    })
  } catch (err) {
    console.error('Error in POST /api/tenants/:tenantId/connectors/:connectorId/test:', err)
    return error(err instanceof Error ? err : new Error('Failed to send test webhook'))
  }
}
