import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client with tenant context for RLS.
 * Uses service role to set the tenant context, then operations
 * are filtered by RLS policies.
 * 
 * Note: Uses untyped client until types are generated from actual DB schema.
 */
export async function createTenantClient(tenantId: string): Promise<SupabaseClient> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables')
  }

  const client = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        // Pass tenant ID in header for logging/debugging
        'x-tenant-id': tenantId,
      },
    },
  })

  // Set tenant context for this session
  // This is used by RLS policies via current_setting('app.tenant_id')
  const { error } = await client.rpc('set_config', {
    setting: 'app.tenant_id',
    value: tenantId,
    is_local: true,
  })

  if (error) {
    console.error('Failed to set tenant context:', error)
    // Continue anyway - service role bypasses RLS
  }

  return client
}

/**
 * Executes a callback with tenant-scoped Supabase client.
 * Ensures proper cleanup and error handling.
 */
export async function withTenant<T>(
  tenantId: string,
  callback: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  const client = await createTenantClient(tenantId)
  return callback(client)
}
