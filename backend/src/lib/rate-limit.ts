/**
 * Simple in-memory rate limiter for Edge Runtime
 *
 * Uses a sliding window counter per key.
 * Note: In a multi-instance deployment (e.g., Vercel serverless),
 * each instance has its own counter. This provides best-effort
 * protection, not strict enforcement.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically
const CLEANUP_INTERVAL = 60_000 // 1 minute
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of store) {
    if (entry.resetAt < now) {
      store.delete(key)
    }
  }
}

interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number
  /** Window duration in seconds */
  windowSeconds: number
}

interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
}

/** Default limits by auth type */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  jwt: { limit: 200, windowSeconds: 60 },
  api_key: { limit: 100, windowSeconds: 60 },
  cron: { limit: 20, windowSeconds: 60 },
  admin: { limit: 50, windowSeconds: 60 },
  public: { limit: 30, windowSeconds: 60 },
}

/**
 * Check rate limit for a given key
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  cleanup()

  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    // New window
    store.set(key, { count: 1, resetAt: now + config.windowSeconds * 1000 })
    return {
      allowed: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetAt: now + config.windowSeconds * 1000,
    }
  }

  entry.count++

  if (entry.count > config.limit) {
    return {
      allowed: false,
      limit: config.limit,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }

  return {
    allowed: true,
    limit: config.limit,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Get rate limit headers for the response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  }
}
