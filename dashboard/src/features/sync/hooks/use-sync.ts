import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { useFilters } from '@/app/providers'
import type { SyncLog } from '@/shared/types'

interface SyncStatusResponse {
  current: SyncLog | null
  history: SyncLog[]
  is_syncing: boolean
  last_sync_at: string | null
}

export function useSyncStatus() {
  const { getSelectedInstanceIds, allInstances } = useFilters()
  
  // Use first selected instance for sync status display
  const instanceIds = getSelectedInstanceIds()
  const primaryInstanceId = instanceIds[0]
  
  return useQuery({
    queryKey: ['sync', 'status', primaryInstanceId],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (primaryInstanceId) {
        params.instance_id = primaryInstanceId
      }
      const response = await api.get<{ data: SyncStatusResponse }>('/api/sync/status', params)
      return response.data
    },
    refetchInterval: (query) => {
      // Poll more frequently when a sync is running
      const data = query.state.data
      if (data?.is_syncing) {
        return 5000 // 5 seconds
      }
      return 30000 // 30 seconds
    },
    enabled: allInstances.length > 0 && !!primaryInstanceId,
  })
}

export function useSyncHistory(page = 1, limit = 10) {
  const { getSelectedInstanceIds } = useFilters()
  const instanceIds = getSelectedInstanceIds()
  
  return useQuery({
    queryKey: ['sync', 'history', instanceIds, page, limit],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit }
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      const response = await api.get<{
        data: SyncLog[]
        pagination: { total: number; page: number; limit: number; total_pages: number }
      }>('/api/sync/status', params)
      return response
    },
    enabled: instanceIds.length > 0,
  })
}

export function useTriggerSync() {
  const queryClient = useQueryClient()
  const { currentInstance } = useFilters()

  return useMutation({
    mutationFn: async () => {
      const params: Record<string, string> = {}
      if (currentInstance) {
        params.instance_id = currentInstance.instance_id
      }
      const response = await api.post<{ data: SyncLog }>('/api/sync', params)
      return response.data
    },
    onSuccess: () => {
      // Invalidate sync status to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['sync'] })
      // Also invalidate metrics since they might change after sync
      queryClient.invalidateQueries({ queryKey: ['metrics'] })
      // Invalidate instances so module_version updates in the banner
      queryClient.invalidateQueries({ queryKey: ['instances'] })
    },
  })
}
