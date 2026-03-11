import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createApiKey } from '@/lib/auth/api-key'
import { validateScopes } from '@/lib/auth/scopes'
import { success, error, created } from '@/utils/api-response'
import { NotFoundError, BadRequestError } from '@/utils/errors'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Validation schema
const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.enum(['read', 'write', 'sync', 'admin'])).optional().default(['read']),
  expires_in_days: z.number().positive().optional(),
})

type RouteParams = {
  params: Promise<{ tenantId: string }>
}

/**
 * GET /api/tenants/:tenantId/api-keys - List API keys for tenant
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { tenantId } = await params
    const supabase = createAdminClient()

    // Verify tenant exists
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .single()

    if (!tenant) {
      throw new NotFoundError('Tenant not found')
    }

    const { data: keys, error: dbError } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, scopes, created_at, expires_at, last_used_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (dbError) {
      throw new Error(dbError.message)
    }

    return success(keys)
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to fetch API keys'))
  }
}

/**
 * POST /api/tenants/:tenantId/api-keys - Create new API key
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { tenantId } = await params
    const body = await request.json()

    // Validate input
    const parsed = createApiKeySchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestError('Validation failed', {
        errors: parsed.error.flatten().fieldErrors,
      })
    }

    const { name, scopes, expires_in_days } = parsed.data

    // Validate scopes
    if (!validateScopes(scopes)) {
      throw new BadRequestError('Invalid scopes provided')
    }

    const supabase = createAdminClient()

    // Verify tenant exists
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .single()

    if (!tenant) {
      throw new NotFoundError('Tenant not found')
    }

    // Create API key
    const { key, keyData } = await createApiKey(tenantId, name, scopes, expires_in_days)

    // Get full key data for response
    const { data: fullKey } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, scopes, created_at, expires_at')
      .eq('id', keyData.id)
      .single()

    return created({
      ...(fullKey || {}),
      key, // Only shown once!
      warning: 'Save this API key securely. It will not be shown again.',
    })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to create API key'))
  }
}
