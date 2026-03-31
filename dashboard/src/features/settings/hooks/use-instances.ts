import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'

export interface WhmcsInstanceFull {
  id: string
  tenant_id: string
  name: string
  slug: string
  whmcs_url: string
  whmcs_api_identifier: string | null
  whmcs_api_secret: string | null
  color: string
  sync_enabled: boolean
  sync_interval_hours: number
  last_sync_at: string | null
  status: 'active' | 'inactive' | 'error'
  module_version: string | null
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateInstanceData {
  name: string
  whmcs_url: string
  api_token?: string
  color?: string
  sync_enabled?: boolean
  sync_interval_hours?: number
}

export interface UpdateInstanceData {
  name?: string
  whmcs_url?: string
  api_token?: string
  color?: string
  sync_enabled?: boolean
  sync_interval_hours?: number
  status?: 'active' | 'inactive'
}

export function useInstances() {
  return useQuery({
    queryKey: ['instances'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: { instances: WhmcsInstanceFull[] } }>('/api/instances')
      return response.data.instances
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useInstance(instanceId: string) {
  return useQuery({
    queryKey: ['instances', instanceId],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: { instance: WhmcsInstanceFull } }>(`/api/instances/${instanceId}`)
      return response.data.instance
    },
    enabled: !!instanceId,
  })
}

export function useCreateInstance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateInstanceData) => {
      const response = await api.post<{ success: boolean; data: { instance: WhmcsInstanceFull } }>('/api/instances', data)
      return response.data.instance
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] })
      queryClient.invalidateQueries({ queryKey: ['user', 'tenants'] })
    },
  })
}

export function useUpdateInstance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ instanceId, data }: { instanceId: string; data: UpdateInstanceData }) => {
      const response = await api.patch<{ success: boolean; data: { instance: WhmcsInstanceFull } }>(`/api/instances/${instanceId}`, data)
      return response.data.instance
    },
    onSuccess: (_, { instanceId }) => {
      queryClient.invalidateQueries({ queryKey: ['instances'] })
      queryClient.invalidateQueries({ queryKey: ['instances', instanceId] })
      queryClient.invalidateQueries({ queryKey: ['user', 'tenants'] })
    },
  })
}

export function useDeleteInstance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (instanceId: string) => {
      await api.delete(`/api/instances/${instanceId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] })
      queryClient.invalidateQueries({ queryKey: ['user', 'tenants'] })
    },
  })
}

export function useSyncInstance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (instanceId: string) => {
      const response = await api.post<{ 
        success: boolean
        data?: { 
          connected: boolean
          message: string
          sync_log_id?: string
          records_synced?: Record<string, number>
          duration_ms?: number
        }
        error?: { message: string }
      }>(`/api/instances/${instanceId}/sync`)
      return response
    },
    onSuccess: () => {
      // Invalidate all relevant queries after sync
      queryClient.invalidateQueries({ queryKey: ['instances'] })
      queryClient.invalidateQueries({ queryKey: ['user', 'tenants'] })
      queryClient.invalidateQueries({ queryKey: ['metrics'] })
      queryClient.invalidateQueries({ queryKey: ['revenue'] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['sync'] })
    },
  })
}
