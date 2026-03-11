import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'
import { sendTestSlack } from '@/lib/slack'
import type { SlackConnector } from '@/lib/slack'

export const dynamic = 'force-dynamic'

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * POST /api/tenants/:tenantId/slack-connectors/:connectorId/test
 * Send a test message to the Slack workspace
 */
export async function POST(
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

    const { data: userTenant, error: authErr } = await supabase
      .from('user_tenants')
      .select('role')
      .eq('user_id', authId)
      .eq('tenant_id', tenantId)
      .single()

    if (authErr || !userTenant) return error(new Error('Tenant not found or access denied'), 404)

    const { data: connector, error: fetchError } = await supabase
      .from('connectors')
      .select('*')
      .eq('id', connectorId)
      .eq('tenant_id', tenantId)
      .eq('type', 'slack')
      .single()

    if (fetchError || !connector) {
      return error(new Error('Slack connector not found'), 404)
    }

    const result = await sendTestSlack(connector as SlackConnector)

    if (!result.success) {
      return error(new Error(result.error ?? 'Failed to send test message'), 500)
    }

    return success({ message: 'Test message sent to Slack successfully' })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to send test Slack message'))
  }
}
