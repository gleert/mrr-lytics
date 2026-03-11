import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success, error, created } from '@/utils/api-response'
import { generateWebhookSecret, WEBHOOK_EVENTS, type WebhookEventType } from '@/lib/webhooks'

export const dynamic = 'force-dynamic'

interface CreateConnectorBody {
  name: string
  type?: 'webhook'
  url: string
  events: WebhookEventType[]
  headers?: Record<string, string>
}

interface WebhookLimitInfo {
  allowed: boolean
  current_count: number
  max_count: number
  plan_id: string
}

/**
 * GET /api/tenants/:tenantId/connectors - List all connectors for a tenant
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params
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

    // Get connectors using the helper function
    const { data: connectors, error: connectorsError } = await supabase
      .rpc('get_tenant_connectors', { p_tenant_id: tenantId })

    if (connectorsError) {
      console.error('Error fetching connectors:', connectorsError)
      return error(new Error('Failed to fetch connectors'), 500)
    }

    // Get webhook limit info
    const { data: limitData, error: limitError } = await supabase
      .rpc('check_webhook_limit', { p_tenant_id: tenantId })
      .single()

    if (limitError) {
      console.error('Error checking webhook limit:', limitError)
    }

    const limitInfo = limitData as WebhookLimitInfo | null

    return success({
      connectors: connectors || [],
      limit: limitInfo ? {
        current: limitInfo.current_count,
        max: limitInfo.max_count,
        can_create: limitInfo.allowed,
        plan: limitInfo.plan_id,
      } : null,
    })
  } catch (err) {
    console.error('Error in GET /api/tenants/:tenantId/connectors:', err)
    return error(err instanceof Error ? err : new Error('Failed to fetch connectors'))
  }
}

/**
 * POST /api/tenants/:tenantId/connectors - Create a new connector
 * 
 * Body:
 * - name: string (required)
 * - type: 'webhook' (optional, defaults to 'webhook')
 * - url: string (required, the webhook URL)
 * - events: string[] (required, array of event types)
 * - headers: object (optional, custom headers)
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
      return error(new Error('Admin role required to create connectors'), 403)
    }

    // Check webhook limit
    const { data: limitData, error: limitCheckError } = await supabase
      .rpc('check_webhook_limit', { p_tenant_id: tenantId })
      .single()

    if (limitCheckError) {
      console.error('Error checking webhook limit:', limitCheckError)
      return error(new Error('Failed to check webhook limit'), 500)
    }

    const limit = limitData as WebhookLimitInfo
    if (!limit.allowed) {
      return error(
        new Error(`Webhook limit reached (${limit.current_count}/${limit.max_count}). Upgrade your plan for more webhooks.`),
        403
      )
    }

    // Parse and validate body
    const body: CreateConnectorBody = await request.json()

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return error(new Error('Name is required'), 400)
    }

    if (!body.url || typeof body.url !== 'string') {
      return error(new Error('URL is required'), 400)
    }

    // Validate URL format
    try {
      new URL(body.url)
    } catch {
      return error(new Error('Invalid URL format'), 400)
    }

    // Validate URL is HTTPS (required for security)
    if (!body.url.startsWith('https://')) {
      return error(new Error('Webhook URL must use HTTPS'), 400)
    }

    if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
      return error(new Error('At least one event must be selected'), 400)
    }

    // Validate event types
    const invalidEvents = body.events.filter(e => !WEBHOOK_EVENTS.includes(e as WebhookEventType))
    if (invalidEvents.length > 0) {
      return error(new Error(`Invalid event types: ${invalidEvents.join(', ')}`), 400)
    }

    // Generate webhook secret
    const secret = generateWebhookSecret()

    // Create connector
    const { data: connector, error: createError } = await supabase
      .from('connectors')
      .insert({
        tenant_id: tenantId,
        type: 'webhook',
        name: body.name.trim(),
        config: {
          url: body.url,
          secret,
          headers: body.headers || {},
        },
        events: body.events,
        enabled: true,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating connector:', createError)
      return error(new Error('Failed to create connector'), 500)
    }

    // Return the connector with the secret visible (only on create)
    return created({
      connector: {
        ...connector,
        config: {
          url: connector.config.url,
          secret: connector.config.secret, // Include secret on creation
          has_secret: true,
        },
      },
    })
  } catch (err) {
    console.error('Error in POST /api/tenants/:tenantId/connectors:', err)
    return error(err instanceof Error ? err : new Error('Failed to create connector'))
  }
}
