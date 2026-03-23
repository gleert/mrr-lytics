/**
 * Simple in-memory cache with TTL
 *
 * Used for caching expensive metric calculations.
 * Each serverless instance has its own cache, so this provides
 * best-effort caching, not strict deduplication.
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

const MAX_ENTRIES = 500
const CLEANUP_INTERVAL = 60_000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) store.delete(key)
  }
  // Evict oldest if too many entries
  if (store.size > MAX_ENTRIES) {
    const entries = [...store.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)
    const toDelete = entries.slice(0, store.size - MAX_ENTRIES)
    toDelete.forEach(([key]) => store.delete(key))
  }
}

/**
 * Get a cached value, or compute and cache it
 *
 * @param key - Cache key
 * @param ttlSeconds - Time to live in seconds
 * @param compute - Function to compute the value if not cached
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>
): Promise<T> {
  cleanup()

  const existing = store.get(key) as CacheEntry<T> | undefined
  if (existing && existing.expiresAt > Date.now()) {
    return existing.data
  }

  const data = await compute()
  store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 })
  return data
}

/**
 * Invalidate cache entries matching a prefix
 */
export function invalidateCache(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
