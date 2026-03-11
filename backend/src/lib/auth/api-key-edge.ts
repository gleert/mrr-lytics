/**
 * Edge-compatible API key and JWT validation
 * 
 * This module uses Web Crypto API and can be used in Edge Runtime.
 * It connects to Supabase using the edge-compatible client.
 * 
 * Supports two authentication methods:
 * 1. API Keys (mrr_...) - For external integrations and scripts
 * 2. Supabase JWT - For dashboard users authenticated via Supabase Auth
 */

import { createClient } from '@supabase/supabase-js'
import { hashStringEdge, isValidApiKeyFormat, timingSafeEqual } from '@/utils/crypto-edge'
import type { ApiScope } from '@/types/api'

export interface ValidatedApiKey {
  id: string
  tenant_id: string
  scopes: ApiScope[]
  name: string
}

export interface ValidatedJwtUser {
  id: string
  tenant_id: string
  email: string
  role: 'admin' | 'viewer'
  scopes: ApiScope[]
}

/**
 * Create a lightweight Supabase client for Edge Runtime
 */
function createEdgeClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Validate an API key and return the associated tenant info (Edge compatible)
 */
export async function validateApiKeyEdge(key: string): Promise<ValidatedApiKey> {
  // Check format first (no async needed)
  if (!isValidApiKeyFormat(key)) {
    throw new Error('Invalid API key format')
  }

  // Hash the key using Web Crypto API
  const keyHash = await hashStringEdge(key)
  const supabase = createEdgeClient()

  const { data: apiKey, error } = await supabase
    .from('api_keys')
    .select('id, tenant_id, name, scopes, expires_at')
    .eq('key_hash', keyHash)
    .single()

  if (error || !apiKey) {
    throw new Error('Invalid API key')
  }

  // Check expiration
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    throw new Error('API key expired')
  }

  // Update last_used_at (fire and forget - don't await)
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
 * Check if the admin API key is valid (Edge compatible)
 */
export function validateAdminKeyEdge(key: string): boolean {
  const adminKey = process.env.ADMIN_API_KEY
  if (!adminKey) {
    console.warn('ADMIN_API_KEY not configured')
    return false
  }
  return timingSafeEqual(key, adminKey)
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
 * Check if a token looks like a JWT (3 base64 parts separated by dots)
 */
export function isJwtToken(token: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 3) return false
  
  // Check if each part is valid base64url
  const base64urlRegex = /^[A-Za-z0-9_-]+$/
  return parts.every(part => base64urlRegex.test(part))
}

/**
 * Validate a Supabase JWT (auth only, no tenant lookup).
 * Used for /api/user/* endpoints where the user might not have a tenant yet.
 */
export async function validateJwtAuthOnly(jwt: string): Promise<{ id: string; email: string }> {
  const supabase = createEdgeClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
  
  if (authError || !user) {
    throw new Error('Invalid or expired JWT')
  }
  
  return {
    id: user.id,
    email: user.email || '',
  }
}

/**
 * Validate a Supabase JWT and return the user's tenant info
 */
export async function validateJwtEdge(jwt: string): Promise<ValidatedJwtUser> {
  const supabase = createEdgeClient()
  
  // Verify JWT and get user
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
  
  if (authError || !user) {
    throw new Error('Invalid or expired JWT')
  }
  
  // Look up user in our users table to get tenant_id and role
  const { data: dbUser, error: userError } = await supabase
    .from('users')
    .select('tenant_id, role, is_active')
    .eq('id', user.id)
    .single()
  
  if (userError || !dbUser) {
    throw new Error('User not found in tenant database')
  }
  
  if (!dbUser.is_active) {
    throw new Error('User account is deactivated')
  }
  
  // Determine scopes based on role
  const scopes: ApiScope[] = dbUser.role === 'admin' 
    ? ['read', 'write', 'sync', 'admin']
    : ['read']
  
  return {
    id: user.id,
    tenant_id: dbUser.tenant_id,
    email: user.email || '',
    role: dbUser.role as 'admin' | 'viewer',
    scopes,
  }
}
