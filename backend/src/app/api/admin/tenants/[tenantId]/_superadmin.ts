import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { UnauthorizedError, ForbiddenError } from '@/utils/errors'

const SUPERADMIN_EMAILS = (process.env.SUPERADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

export function isSuperAdmin(email: string | null): boolean {
  if (!email) return false
  return SUPERADMIN_EMAILS.includes(email.toLowerCase())
}

export async function requireSuperAdmin() {
  const headersList = await headers()
  const userEmail = headersList.get('x-user-email')
  if (!userEmail) throw new UnauthorizedError('Authentication required')
  if (!isSuperAdmin(userEmail)) throw new ForbiddenError('Superadmin access required')
  return { userEmail }
}

export async function getTenant(tenantId: string) {
  const supabase = createAdminClient()
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, name, slug, status')
    .eq('id', tenantId)
    .single()
  if (error || !tenant) throw new Error(`Tenant not found: ${tenantId}`)
  return { supabase, tenant }
}
