import { createAdminClient } from '@/lib/supabase/admin'
import { hashApiKey, isValidApiKeyFormat, generateApiKey, getKeyPrefix } from '@/utils/crypto'
import { UnauthorizedError } from '@/utils/errors'
import type { ApiScope, AuthContext } from '@/types/api'

export interface ValidatedApiKey {
  id: string
  tenant_id: string
  scopes: ApiScope[]
  name: string
}

/**
 * Validate an API key and return the associated tenant info
 */
export async function validateApiKey(key: string): Promise<ValidatedApiKey> {
  // Check format
  if (!isValidApiKeyFormat(key)) {
    throw new UnauthorizedError('Invalid API key format')
  }

  const keyHash = hashApiKey(key)
  const supabase = createAdminClient()

  const { data: apiKey, error } = await supabase
    .from('api_keys')
    .select('id, tenant_id, name, scopes, expires_at')
    .eq('key_hash', keyHash)
    .single()

  if (error || !apiKey) {
    throw new UnauthorizedError('Invalid API key')
  }

  // Check expiration
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    throw new UnauthorizedError('API key expired')
  }

  // Update last_used_at (fire and forget)
  void supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id)

  return {
    id: apiKey.id,
    tenant_id: apiKey.tenant_id,
    scopes: apiKey.scopes as ApiScope[],
    name: apiKey.name,
  }
}

/**
 * Check if the admin API key is valid
 */
export function validateAdminKey(key: string): boolean {
  const adminKey = process.env.ADMIN_API_KEY
  if (!adminKey) {
    console.warn('ADMIN_API_KEY not configured')
    return false
  }
  return key === adminKey
}

/**
 * Extract bearer token from Authorization header
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }
  return authHeader.slice(7)
}

/**
 * Create a new API key for a tenant
 */
export async function createApiKey(
  tenantId: string,
  name: string,
  scopes: ApiScope[] = ['read'],
  expiresInDays?: number
): Promise<{ key: string; keyData: ValidatedApiKey }> {
  const key = generateApiKey()
  const keyHash = hashApiKey(key)
  const keyPrefix = getKeyPrefix(key)

  const supabase = createAdminClient()

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      tenant_id: tenantId,
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes,
      expires_at: expiresAt,
    })
    .select('id, tenant_id, name, scopes')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create API key: ${error?.message}`)
  }

  return {
    key, // Only returned once!
    keyData: {
      id: data.id,
      tenant_id: data.tenant_id,
      scopes: data.scopes as ApiScope[],
      name: data.name,
    },
  }
}

/**
 * Parse auth context from request headers (set by middleware)
 */
export function getAuthContext(headers: Headers): AuthContext | null {
  const tenantId = headers.get('x-tenant-id')
  const scopesJson = headers.get('x-tenant-scopes')
  const apiKeyId = headers.get('x-api-key-id')

  if (!tenantId || !scopesJson) {
    return null
  }

  try {
    return {
      tenant_id: tenantId,
      scopes: JSON.parse(scopesJson) as ApiScope[],
      api_key_id: apiKeyId || '',
    }
  } catch {
    return null
  }
}
