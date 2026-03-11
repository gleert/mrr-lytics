/**
 * Edge-compatible crypto utilities using Web Crypto API
 * 
 * This file can be used in Edge Runtime (middleware, edge functions)
 * For Node.js server-side code, use crypto.ts instead.
 */

/**
 * Hash a string using SHA-256 (Web Crypto API - Edge compatible)
 */
export async function hashStringEdge(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Validate API key format (Edge compatible - no crypto needed)
 */
export function isValidApiKeyFormat(key: string): boolean {
  // Format: mrr_<32 hex chars>
  return /^mrr_[a-f0-9]{32}$/.test(key)
}

/**
 * Extract the prefix from an API key (first 8 chars)
 */
export function getKeyPrefix(key: string): string {
  return key.substring(0, 8) // "mrr_xxxx"
}

/**
 * Constant-time string comparison (Edge compatible)
 * Prevents timing attacks when comparing secrets
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
