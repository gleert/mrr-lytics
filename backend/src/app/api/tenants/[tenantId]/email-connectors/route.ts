import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error, created } from '@/utils/api-response'
import { WEBHOOK_EVENTS, type WebhookEventType } from '@/lib/webhooks'

export const dynamic = 'force-dynamic'

interface CreateEmailConnectorBody {
  name: string
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  from: string
  to: string
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
 * GET /api/tenants/:tenantId/email-connectors
 * List all email connectors for a tenant
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
      .eq('type', 'email')
      .order('created_at', { ascending: true })

    if (fetchError) return error(new Error('Failed to fetch email connectors'), 500)

    // Mask password in config before returning
    const masked = (connectors ?? []).map(c => ({
      ...c,
      config: { ...c.config, password: undefined, has_password: true },
    }))

    return success({ connectors: masked })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to fetch email connectors'))
  }
}

/**
 * POST /api/tenants/:tenantId/email-connectors
 * Create a new email connector
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

    const body: CreateEmailConnectorBody = await request.json()

    // Validate required fields
    if (!body.name?.trim()) return error(new Error('Name is required'), 400)
    if (!body.host?.trim()) return error(new Error('SMTP host is required'), 400)
    if (!body.port || typeof body.port !== 'number') return error(new Error('SMTP port is required'), 400)
    if (!body.user?.trim()) return error(new Error('SMTP username is required'), 400)
    if (!body.password?.trim()) return error(new Error('SMTP password is required'), 400)
    if (!body.from?.trim()) return error(new Error('From address is required'), 400)
    if (!body.to?.trim()) return error(new Error('Recipient address is required'), 400)
    if (!body.events?.length) return error(new Error('At least one event must be selected'), 400)

    const invalidEvents = body.events.filter(e => !WEBHOOK_EVENTS.includes(e as WebhookEventType))
    if (invalidEvents.length > 0) {
      return error(new Error(`Invalid event types: ${invalidEvents.join(', ')}`), 400)
    }

    const { data: connector, error: createError } = await supabase
      .from('connectors')
      .insert({
        tenant_id: tenantId,
        type: 'email',
        name: body.name.trim(),
        config: {
          host: body.host.trim(),
          port: body.port,
          secure: !!body.secure,
          user: body.user.trim(),
          password: body.password,
          from: body.from.trim(),
          to: body.to.trim(),
        },
        events: body.events,
        enabled: true,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating email connector:', createError)
      return error(new Error('Failed to create email connector'), 500)
    }

    return created({
      connector: {
        ...connector,
        config: { ...connector.config, password: undefined, has_password: true },
      },
    })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to create email connector'))
  }
}
