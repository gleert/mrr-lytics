import { createAdminClient } from '@/lib/supabase/admin'
import { ForbiddenError } from '@/utils/errors'

/**
 * Tenant ownership check for `instance_ids` request parameters.
 *
 * Every metrics/data route takes the instances to report on straight from the
 * query string and then queries with the SERVICE ROLE client, which bypasses
 * RLS. Without this check a caller authenticated as tenant A could read tenant
 * B's MRR, clients, domains, invoices and revenue just by passing B's instance
 * UUID -- an IDOR, and the REST-side twin of the materialized-view exposure
 * closed in migration 00054.
 *
 * Call this immediately after parsing `instance_ids`, before any data query.
 *
 * Note on impersonation: `x-tenant-id` is set to the IMPERSONATED tenant, so
 * this works unchanged inside an impersonated session. Never key ownership off
 * `x-auth-id` instead -- under impersonation it is `impersonation:<uuid>`, not
 * a real user id.
 */

/** Per-invocation memo. Serverless instances are reused, so this saves repeat lookups. */
const cache = new Map<string, { ids: Set<string>; at: number }>()
const CACHE_TTL_MS = 30 * 1000

async function ownedInstanceIds(tenantId: string, fresh = false): Promise<Set<string>> {
  const hit = cache.get(tenantId)
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.ids

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('whmcs_instances')
    .select('id')
    .eq('tenant_id', tenantId)

  if (error) {
    // Fail closed: an unreadable instance list must never be treated as
    // "everything is allowed".
    throw new ForbiddenError('Could not verify instance access')
  }

  const ids = new Set<string>((data || []).map((row) => row.id as string))
  cache.set(tenantId, { ids, at: Date.now() })
  return ids
}

/**
 * Throws ForbiddenError (403) unless every id in `instanceIds` belongs to
 * `tenantId`. An empty list is allowed: routes handle "no instance specified"
 * themselves, and there is nothing to leak.
 */
export async function assertInstancesOwned(
  tenantId: string,
  instanceIds: string[],
): Promise<void> {
  if (instanceIds.length === 0) return

  const owned = await ownedInstanceIds(tenantId)
  if (instanceIds.every((id) => owned.has(id))) return

  // A miss may just be a stale memo: an instance created seconds ago is not in
  // it yet, and rejecting that would 403 the tenant on their own brand-new
  // instance. Re-read once before deciding, so only a genuinely foreign id
  // reaches the throw.
  const currentlyOwned = await ownedInstanceIds(tenantId, true)
  if (instanceIds.every((id) => currentlyOwned.has(id))) return

  // Do not echo the ids back -- that would confirm which of them exist.
  throw new ForbiddenError('One or more instances do not belong to this tenant')
}

/** Test seam: drop the memo so a test can observe fresh lookups. */
export function __clearInstanceAccessCache(): void {
  cache.clear()
}
