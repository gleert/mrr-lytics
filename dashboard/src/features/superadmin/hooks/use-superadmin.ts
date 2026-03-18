import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { useAuth } from '@/app/providers'

export interface AdminTenantMember {
  user_id: string
  role: string
  email: string | null
  full_name: string | null
}

export interface AdminTenantInstance {
  id: string
  name: string
  whmcs_url: string
  is_active: boolean
}

export interface AdminTenant {
  id: string
  name: string
  slug: string
  plan: string
  created_at: string
  updated_at: string
  member_count: number
  instance_count: number
  members: AdminTenantMember[]
  instances: AdminTenantInstance[]
}

interface AdminTenantsResponse {
  tenants: AdminTenant[]
  total: number
}

// Superadmin emails from env
const SUPERADMIN_EMAILS = (import.meta.env.VITE_SUPERADMIN_EMAILS || '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean)

export function useIsSuperAdmin() {
  const { user } = useAuth()
  const email = user?.email?.toLowerCase() ?? ''
  return SUPERADMIN_EMAILS.includes(email)
}

export function useAdminTenants() {
  const isSuperAdmin = useIsSuperAdmin()

  return useQuery({
    queryKey: ['admin', 'tenants'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: AdminTenantsResponse }>('/api/admin/tenants')
      return response.data
    },
    enabled: isSuperAdmin,
    staleTime: 60 * 1000,
  })
}
