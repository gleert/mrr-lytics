import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { success, error, noContent } from '@/utils/api-response'
import { NotFoundError, BadRequestError } from '@/utils/errors'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Validation schema
const updateTenantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  whmcs_url: z.string().url().optional(),
  whmcs_api_key: z.string().min(1).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
})

type RouteParams = {
  params: Promise<{ tenantId: string }>
}

/**
 * GET /api/tenants/:tenantId - Get tenant details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { tenantId } = await params
    const supabase = createAdminClient()

    const { data: tenant, error: dbError } = await supabase
      .from('tenants')
      .select('id, name, slug, whmcs_url, status, settings, created_at, updated_at')
      .eq('id', tenantId)
      .single()

    if (dbError || !tenant) {
      throw new NotFoundError('Tenant not found')
    }

    return success(tenant)
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to fetch tenant'))
  }
}

/**
 * PUT /api/tenants/:tenantId - Update tenant
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { tenantId } = await params
    const body = await request.json()

    // Validate input
    const parsed = updateTenantSchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestError('Validation failed', {
        errors: parsed.error.flatten().fieldErrors,
      })
    }

    const supabase = createAdminClient()

    // Check tenant exists
    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .single()

    if (!existing) {
      throw new NotFoundError('Tenant not found')
    }

    // Update tenant - build update object
    const updateData: Record<string, unknown> = {}
    if (parsed.data.name) updateData.name = parsed.data.name
    if (parsed.data.whmcs_url) updateData.whmcs_url = parsed.data.whmcs_url
    if (parsed.data.whmcs_api_key) updateData.whmcs_api_key = parsed.data.whmcs_api_key
    if (parsed.data.status) updateData.status = parsed.data.status
    if (parsed.data.settings) updateData.settings = parsed.data.settings

    const { data: tenant, error: updateError } = await supabase
      .from('tenants')
      .update(updateData)
      .eq('id', tenantId)
      .select('id, name, slug, whmcs_url, status, settings, created_at, updated_at')
      .single()

    if (updateError || !tenant) {
      throw new Error(updateError?.message || 'Failed to update tenant')
    }

    return success(tenant)
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to update tenant'))
  }
}

/**
 * DELETE /api/tenants/:tenantId - Delete tenant
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { tenantId } = await params
    const supabase = createAdminClient()

    // Check tenant exists
    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .single()

    if (!existing) {
      throw new NotFoundError('Tenant not found')
    }

    // Delete tenant (cascade will delete related data)
    const { error: deleteError } = await supabase
      .from('tenants')
      .delete()
      .eq('id', tenantId)

    if (deleteError) {
      throw new Error(deleteError.message)
    }

    return noContent()
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed to delete tenant'))
  }
}
