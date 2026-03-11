import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createApiKey } from '@/lib/auth/api-key'
import { success, error, created } from '@/utils/api-response'
import { BadRequestError, ConflictError } from '@/utils/errors'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Validation schema
const createTenantSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  whmcs_url: z.string().url(),
  whmcs_api_key: z.string().min(1),
})

/**
 * GET /api/tenants - List all tenants (admin only)
 */
export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data: tenants, error: dbError } = await supabase
      .from('tenants')
      .select('id, name, slug, whmcs_url, status, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (dbError) {
      throw new Error(dbError.message)
    }

    return success(tenants)
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to fetch tenants'))
  }
}

/**
 * POST /api/tenants - Create a new tenant (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const parsed = createTenantSchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestError('Validation failed', {
        errors: parsed.error.flatten().fieldErrors,
      })
    }

    const { name, slug, whmcs_url, whmcs_api_key } = parsed.data
    const supabase = createAdminClient()

    // Check if slug already exists
    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existing) {
      throw new ConflictError('Tenant with this slug already exists')
    }

    // Create tenant
    const { data: tenant, error: insertError } = await supabase
      .from('tenants')
      .insert({
        name,
        slug,
        whmcs_url,
        whmcs_api_key,
        status: 'active',
      })
      .select('id, name, slug, whmcs_url, status, created_at, updated_at')
      .single()

    if (insertError || !tenant) {
      throw new Error(insertError?.message || 'Failed to create tenant')
    }

    // Create initial API key with admin scope
    const { key, keyData } = await createApiKey(
      tenant.id,
      'Initial Admin Key',
      ['read', 'write', 'sync', 'admin']
    )

    return created({
      tenant,
      api_key: {
        key, // Only returned once!
        id: keyData.id,
        name: keyData.name,
        scopes: keyData.scopes,
        warning: 'Save this API key securely. It will not be shown again.',
      },
    })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to create tenant'))
  }
}
