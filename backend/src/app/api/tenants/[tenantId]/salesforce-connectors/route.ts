import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error, created } from '@/utils/api-response'
import { WEBHOOK_EVENTS, type WebhookEventType } from '@/lib/webhooks'

export const dynamic = 'force-dynamic'

interface CreateSalesforceConnectorBody {
  name: string
  access_token: string
  instance_url: string
  events: WebhookEventType[]
  actions?: {
    create_contacts?: boolean
    update_lead_status?: boolean
    log_tasks?: boolean
  }
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
 * GET /api/tenants/:tenantId/salesforce-connectors
 * List all Salesforce connectors for a tenant
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
      .eq('type', 'salesforce')
      .order('created_at', { ascending: true })

    if (fetchError) return error(new Error('Failed to fetch Salesforce connectors'), 500)

    const masked = (connectors ?? []).map(c => ({
      ...c,
      config: maskConfig(c.config as Record<string, unknown>),
    }))

    return success({ connectors: masked })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to fetch Salesforce connectors'))
  }
}

/**
 * POST /api/tenants/:tenantId/salesforce-connectors
 * Create a new Salesforce connector
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

    const body: CreateSalesforceConnectorBody = await request.json()

    if (!body.name?.trim()) return error(new Error('Name is required'), 400)
    if (!body.access_token?.trim()) return error(new Error('Access token is required'), 400)
    if (!body.instance_url?.trim()) return error(new Error('Instance URL is required'), 400)
    if (!body.events?.length) return error(new Error('At least one event must be selected'), 400)

    const invalidEvents = body.events.filter(e => !WEBHOOK_EVENTS.includes(e as WebhookEventType))
    if (invalidEvents.length > 0) {
      return error(new Error(`Invalid event types: ${invalidEvents.join(', ')}`), 400)
    }

    const { data: connector, error: createError } = await supabase
      .from('connectors')
      .insert({
        tenant_id: tenantId,
        type: 'salesforce',
        name: body.name.trim(),
        config: {
          access_token: body.access_token.trim(),
          instance_url: body.instance_url.trim().replace(/\/$/, ''),
          actions: {
            create_contacts: body.actions?.create_contacts ?? true,
            update_lead_status: body.actions?.update_lead_status ?? true,
            log_tasks: body.actions?.log_tasks ?? true,
          },
        },
        events: body.events,
        enabled: true,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating Salesforce connector:', createError)
      return error(new Error('Failed to create Salesforce connector'), 500)
    }

    return created({
      connector: {
        ...connector,
        config: maskConfig(connector.config as Record<string, unknown>),
      },
    })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to create Salesforce connector'))
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function maskConfig(config: Record<string, unknown>): Record<string, unknown> {
  const token = config?.access_token as string | undefined
  return {
    ...config,
    access_token: token ? `${token.substring(0, 6)}***` : '',
    has_access_token: !!token,
  }
}
