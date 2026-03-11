import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'
import { sendTestEmail } from '@/lib/email'
import type { EmailConnector } from '@/lib/email'

export const dynamic = 'force-dynamic'

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * POST /api/tenants/:tenantId/email-connectors/:connectorId/test
 * Send a test email through the connector
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

    // Auth check
    const { data: userTenant, error: authErr } = await supabase
      .from('user_tenants')
      .select('role')
      .eq('user_id', authId)
      .eq('tenant_id', tenantId)
      .single()

    if (authErr || !userTenant) return error(new Error('Tenant not found or access denied'), 404)

    // Fetch connector with full config (including password)
    const { data: connector, error: fetchError } = await supabase
      .from('connectors')
      .select('*')
      .eq('id', connectorId)
      .eq('tenant_id', tenantId)
      .eq('type', 'email')
      .single()

    if (fetchError || !connector) {
      return error(new Error('Email connector not found'), 404)
    }

    // Send test email
    const result = await sendTestEmail(connector as EmailConnector)

    if (!result.success) {
      return error(new Error(result.error ?? 'Failed to send test email'), 500)
    }

    return success({
      message: 'Test email sent successfully',
      messageId: result.messageId,
    })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to send test email'))
  }
}
