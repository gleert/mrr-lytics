import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client with service role privileges.
 * This client bypasses RLS and should only be used for admin operations.
 * 
 * WARNING: Never expose this client to the browser or untrusted code.
 * 
 * Note: We use an untyped client because the types need to be generated
 * from the actual database schema using: npx supabase gen types typescript --local
 * Once Supabase Local is running, regenerate types to get full type safety.
 */
export function createAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Creates a Supabase admin client with tenant context set.
 * This allows RLS policies to work correctly for the specified tenant.
 */
export async function createAdminClientWithTenant(tenantId: string) {
  const client = createAdminClient()
  
  // Set the tenant context for RLS
  await client.rpc('set_config', {
    setting: 'app.tenant_id',
    value: tenantId,
    is_local: true,
  })
  
  return client
}
