import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error, created } from '@/utils/api-response'
import { WEBHOOK_EVENTS, type WebhookEventType } from '@/lib/webhooks'

export const dynamic = 'force-dynamic'

interface CreateSlackConnectorBody {
  name: string
  webhook_url: string
  channel?: string
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
 * GET /api/tenants/:tenantId/slack-connectors
 * List all Slack connectors for a tenant
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
      .eq('type', 'slack')
      .order('created_at', { ascending: true })

    if (fetchError) return error(new Error('Failed to fetch Slack connectors'), 500)

    // Mask webhook_url partially for security (show domain only)
    const masked = (connectors ?? []).map(c => ({
      ...c,
      config: {
        ...c.config,
        webhook_url: maskWebhookUrl(c.config?.webhook_url as string | undefined),
        has_webhook_url: !!c.config?.webhook_url,
      },
    }))

    return success({ connectors: masked })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to fetch Slack connectors'))
  }
}

/**
 * POST /api/tenants/:tenantId/slack-connectors
 * Create a new Slack connector
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

    const body: CreateSlackConnectorBody = await request.json()

    if (!body.name?.trim()) return error(new Error('Name is required'), 400)
    if (!body.webhook_url?.trim()) return error(new Error('Slack webhook URL is required'), 400)
    if (!body.events?.length) return error(new Error('At least one event must be selected'), 400)

    // Validate URL format
    try {
      const url = new URL(body.webhook_url)
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error()
    } catch {
      return error(new Error('Invalid webhook URL'), 400)
    }

    const invalidEvents = body.events.filter(e => !WEBHOOK_EVENTS.includes(e as WebhookEventType))
    if (invalidEvents.length > 0) {
      return error(new Error(`Invalid event types: ${invalidEvents.join(', ')}`), 400)
    }

    const { data: connector, error: createError } = await supabase
      .from('connectors')
      .insert({
        tenant_id: tenantId,
        type: 'slack',
        name: body.name.trim(),
        config: {
          webhook_url: body.webhook_url.trim(),
          channel: body.channel?.trim() || null,
        },
        events: body.events,
        enabled: true,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating Slack connector:', createError)
      return error(new Error('Failed to create Slack connector'), 500)
    }

    return created({
      connector: {
        ...connector,
        config: {
          ...connector.config,
          webhook_url: maskWebhookUrl(connector.config?.webhook_url as string | undefined),
          has_webhook_url: true,
        },
      },
    })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to create Slack connector'))
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function maskWebhookUrl(url: string | undefined): string {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    // Show only the host, hide the path token
    return `${parsed.protocol}//${parsed.host}/...`
  } catch {
    return '***'
  }
}
