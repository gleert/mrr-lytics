import { createHash, randomBytes } from 'node:crypto'

/**
 * Generate a secure API key with the format: mrr_<32 hex chars>
 */
export function generateApiKey(): string {
  const randomPart = randomBytes(16).toString('hex') // 32 hex characters
  return `mrr_${randomPart}`
}

/**
 * Extract the prefix from an API key (first 8 chars)
 */
export function getKeyPrefix(key: string): string {
  return key.substring(0, 8) // "mrr_xxxx"
}

/**
 * Hash an API key using SHA-256
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(key: string): boolean {
  // Format: mrr_<32 hex chars>
  return /^mrr_[a-f0-9]{32}$/.test(key)
}

/**
 * Generate a secure random string
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('hex')
}
