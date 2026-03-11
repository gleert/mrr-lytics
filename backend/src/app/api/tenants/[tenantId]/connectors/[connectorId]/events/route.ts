import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'

export const dynamic = 'force-dynamic'

/**
 * GET /api/tenants/:tenantId/connectors/:connectorId/events - Get recent events for a connector
 * 
 * Query params:
 * - limit: number (optional, default 50, max 100)
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

    // Parse query params
    const { searchParams } = new URL(request.url)
    let limit = parseInt(searchParams.get('limit') || '50', 10)
    if (isNaN(limit) || limit < 1) limit = 50
    if (limit > 100) limit = 100

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

    // Verify connector belongs to tenant
    const { data: connector, error: connectorError } = await supabase
      .from('connectors')
      .select('id')
      .eq('id', connectorId)
      .eq('tenant_id', tenantId)
      .single()

    if (connectorError || !connector) {
      return error(new Error('Connector not found'), 404)
    }

    // Get events using helper function
    const { data: events, error: eventsError } = await supabase
      .rpc('get_connector_events', { 
        p_connector_id: connectorId,
        p_limit: limit,
      })

    if (eventsError) {
      console.error('Error fetching connector events:', eventsError)
      return error(new Error('Failed to fetch events'), 500)
    }

    return success({
      events: events || [],
      limit,
    })
  } catch (err) {
    console.error('Error in GET /api/tenants/:tenantId/connectors/:connectorId/events:', err)
    return error(err instanceof Error ? err : new Error('Failed to fetch events'))
  }
}
