/**
 * Webhook Signature Utilities
 * 
 * Implements HMAC-SHA256 signing for webhook payloads (Stripe-style).
 * 
 * Signature format: sha256=<hex_signature>
 * 
 * The signed payload format is: <timestamp>.<payload>
 * This prevents replay attacks by including the timestamp in the signature.
 */

import { createHmac, randomBytes } from 'crypto'

/**
 * Generate a random webhook secret
 * Format: whsec_<32 random hex characters>
 * 
 * @returns A new webhook secret
 */
export function generateWebhookSecret(): string {
  const randomPart = randomBytes(16).toString('hex')
  return `whsec_${randomPart}`
}

/**
 * Create HMAC-SHA256 signature for a webhook payload
 * 
 * The signature is computed over: timestamp.payload
 * This prevents replay attacks.
 * 
 * @param payload - The JSON payload string
 * @param secret - The webhook secret
 * @param timestamp - Unix timestamp (seconds)
 * @returns The hex-encoded signature
 */
export function createSignature(
  payload: string,
  secret: string,
  timestamp: number
): string {
  const signedPayload = `${timestamp}.${payload}`
  const hmac = createHmac('sha256', secret)
  hmac.update(signedPayload)
  return hmac.digest('hex')
}

/**
 * Verify a webhook signature
 * 
 * @param payload - The JSON payload string
 * @param signature - The signature to verify (hex string, without "sha256=" prefix)
 * @param secret - The webhook secret
 * @param timestamp - Unix timestamp used when creating signature
 * @returns Whether the signature is valid
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp: number
): boolean {
  const expectedSignature = createSignature(payload, secret, timestamp)
  
  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return false
  }
  
  let result = 0
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i)
  }
  
  return result === 0
}

/**
 * Generate webhook headers for a request
 * 
 * @param payload - The JSON payload string
 * @param secret - The webhook secret
 * @returns Headers object with signature and timestamp
 */
export function generateWebhookHeaders(
  payload: string,
  secret: string,
  eventType: string
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = createSignature(payload, secret, timestamp)
  
  return {
    'Content-Type': 'application/json',
    'X-MRRlytics-Signature': `sha256=${signature}`,
    'X-MRRlytics-Timestamp': timestamp.toString(),
    'X-MRRlytics-Event': eventType,
    'User-Agent': 'MRRlytics-Webhook/1.0',
  }
}

/**
 * Generate a unique event ID
 * Format: evt_<timestamp>_<random>
 * 
 * @returns A unique event ID
 */
export function generateEventId(): string {
  const timestamp = Date.now().toString(36)
  const random = randomBytes(6).toString('hex')
  return `evt_${timestamp}_${random}`
}
