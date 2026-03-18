import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'

function adminUrl(tenantId: string, action: string) {
  return `/api/admin/tenants/${tenantId}/${action}`
}

// --- Suspend ---
export function useSuspendTenant(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post(adminUrl(tenantId, 'suspend'), {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tenants'] }),
  })
}

// --- Resume ---
export function useResumeTenant(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post(adminUrl(tenantId, 'resume'), {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tenants'] }),
  })
}

// --- Change plan ---
export function useChangePlan(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (plan_id: string) => api.post(adminUrl(tenantId, 'change-plan'), { plan_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tenants'] }),
  })
}

// --- Sync ---
export function useSyncTenant(tenantId: string) {
  return useMutation({
    mutationFn: () => api.post(adminUrl(tenantId, 'sync'), {}),
  })
}

// --- Sync Logs ---
export interface SyncLog {
  id: string
  instance_id: string
  instance_name: string
  status: string
  sync_type: string
  triggered_by: string
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  records_synced: Record<string, number> | null
  error_message: string | null
}

export function useTenantLogs(tenantId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'tenants', tenantId, 'logs'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { logs: SyncLog[] } }>(
        `/api/admin/tenants/${tenantId}/logs`
      )
      return res.data
    },
    enabled,
    staleTime: 10_000,
  })
}

// --- Impersonate ---
export function useImpersonateTenant(tenantId: string) {
  return useMutation({
    mutationFn: () => api.post<{ success: boolean; data: { magic_link: string; tenant_name: string; impersonated_user: string } }>(
      adminUrl(tenantId, 'impersonate'), {}
    ),
  })
}

// --- Delete tenant ---
export function useDeleteTenant(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete(adminUrl(tenantId, 'delete')),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tenants'] }),
  })
}
