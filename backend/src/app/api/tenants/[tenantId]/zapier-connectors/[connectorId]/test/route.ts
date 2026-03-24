import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'
import { sendTestZapier } from '@/lib/zapier'
import type { ZapierConnector } from '@/lib/zapier'

export const dynamic = 'force-dynamic'

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * POST /api/tenants/:tenantId/zapier-connectors/:connectorId/test
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
      .eq('type', 'zapier')
      .single()

    if (fetchError || !connector) {
      return error(new Error('Zapier connector not found'), 404)
    }

    const result = await sendTestZapier(connector as ZapierConnector)

    if (!result.success) {
      return error(new Error(result.error ?? 'Failed to connect to Zapier'), 500)
    }

    return success({ message: 'Zapier webhook test sent successfully' })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to test Zapier connection'))
  }
}
