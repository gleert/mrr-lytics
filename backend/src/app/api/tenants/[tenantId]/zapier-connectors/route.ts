import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error, created } from '@/utils/api-response'
import { WEBHOOK_EVENTS, type WebhookEventType } from '@/lib/webhooks'

export const dynamic = 'force-dynamic'

interface CreateZapierConnectorBody {
  name: string
  webhook_url: string
  events: WebhookEventType[]
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
 * GET /api/tenants/:tenantId/zapier-connectors
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')

    if (authType !== 'jwt' || !authId) {
      return error(new Error('Authentication required'), 401)
    }

    const supabase = makeSupabase()
    const { userTenant, err } = await checkAdmin(supabase, authId, tenantId)
    if (err || !userTenant) return error(new Error('Tenant not found or access denied'), 404)

    const { data: connectors, error: fetchError } = await supabase
      .from('connectors')
      .select('id, name, type, config, events, enabled, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .eq('type', 'zapier')
      .order('created_at', { ascending: true })

    if (fetchError) return error(new Error('Failed to fetch Zapier connectors'), 500)

    const masked = (connectors ?? []).map(c => ({
      ...c,
      config: maskConfig(c.config as Record<string, unknown>),
    }))

    return success({ connectors: masked })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to fetch Zapier connectors'))
  }
}

/**
 * POST /api/tenants/:tenantId/zapier-connectors
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params
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

    const body: CreateZapierConnectorBody = await request.json()

    if (!body.name?.trim()) return error(new Error('Name is required'), 400)
    if (!body.webhook_url?.trim()) return error(new Error('Webhook URL is required'), 400)
    if (!body.webhook_url.startsWith('https://hooks.zapier.com/')) {
      return error(new Error('URL must be a valid Zapier Catch Hook (https://hooks.zapier.com/...)'), 400)
    }
    if (!body.events?.length) return error(new Error('At least one event must be selected'), 400)

    const invalidEvents = body.events.filter(e => !WEBHOOK_EVENTS.includes(e as WebhookEventType))
    if (invalidEvents.length > 0) {
      return error(new Error(`Invalid event types: ${invalidEvents.join(', ')}`), 400)
    }

    const { data: connector, error: createError } = await supabase
      .from('connectors')
      .insert({
        tenant_id: tenantId,
        type: 'zapier',
        name: body.name.trim(),
        config: {
          webhook_url: body.webhook_url.trim(),
        },
        events: body.events,
        enabled: true,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating Zapier connector:', createError)
      return error(new Error('Failed to create Zapier connector'), 500)
    }

    return created({
      connector: {
        ...connector,
        config: maskConfig(connector.config as Record<string, unknown>),
      },
    })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to create Zapier connector'))
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function maskConfig(config: Record<string, unknown>): Record<string, unknown> {
  const url = config?.webhook_url as string | undefined
  return {
    ...config,
    webhook_url: url ? `${url.substring(0, 40)}***` : '',
    has_webhook_url: !!url,
  }
}
