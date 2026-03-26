import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { useFilters } from '@/app/providers'
import type { ClientStats } from '@/shared/types'

export interface WhmcsClient {
  id: string
  instance_id: string
  whmcs_id: number
  firstname: string | null
  lastname: string | null
  companyname: string | null
  currency: number
  status: string
  datecreated: string | null
  defaultgateway: string | null
  groupid: number | null
  lastlogin: string | null
  credit: number
  language: string | null
  current_mrr: number
  services_count: number
  domains_count: number
  total_paid: number
  synced_at: string
  primary_domain: string | null
}

export interface ClientsListResponse {
  clients: WhmcsClient[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
  }
}

export interface TopClient {
  client_id: number
  name: string
  status: string
  revenue_in_period: number
  current_mrr: number
}

export interface TopClientsResponse {
  clients: TopClient[]
  total_revenue: number
  total_mrr?: number
  sort_by?: string
}

export function useTopClients(limit = 6, sortBy: 'revenue' | 'mrr' = 'revenue') {
  const { currentInstance, period, customDateRange, getSelectedInstanceIds, getPeriodParams, allInstances } = useFilters()
  const instanceKey = currentInstance?.instance_id || 'all'

  return useQuery({
    queryKey: ['clients', 'top-clients', instanceKey, period, customDateRange, limit, sortBy],
    queryFn: async () => {
      const params: Record<string, string> = { ...getPeriodParams(), limit: String(limit), sort_by: sortBy }
      const instanceIds = getSelectedInstanceIds()
      if (instanceIds.length > 0) params.instance_ids = instanceIds.join(',')
      const response = await api.get<{ success: boolean; data: TopClientsResponse }>('/api/clients/top-clients', params)
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    enabled: allInstances.length > 0,
  })
}

export function useClientStats() {
  const { currentInstance, period, customDateRange, getSelectedInstanceIds, getPeriodParams, allInstances } = useFilters()

  const instanceKey = currentInstance?.instance_id || 'all'

  return useQuery({
    queryKey: ['clients', 'stats', instanceKey, period, customDateRange],
    queryFn: async () => {
      const params: Record<string, string> = { ...getPeriodParams() }
      // Pass comma-separated instance IDs (supports multiple)
      const instanceIds = getSelectedInstanceIds()
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      const response = await api.get<{ success: boolean; data: ClientStats }>('/api/clients/stats', params)
      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: allInstances.length > 0, // Fetch when instances are loaded
  })
}

export function useClientsList(options: {
  status?: string
  search?: string
  sort?: string
  order?: 'asc' | 'desc'
  page?: number
  limit?: number
} = {}) {
  const { getSelectedInstanceIds, allInstances } = useFilters()
  const { status = 'all', search = '', sort = 'whmcs_id', order = 'asc', page = 1, limit = 50 } = options
  
  const instanceIds = getSelectedInstanceIds()
  
  return useQuery({
    queryKey: ['clients', 'list', instanceIds.join(','), status, search, sort, order, page, limit],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page,
        limit,
        sort,
        order,
      }
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      if (status !== 'all') {
        params.status = status
      }
      if (search) {
        params.search = search
      }
      const response = await api.get<{ success: boolean; data: ClientsListResponse }>('/api/clients', params)
      return response.data
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: allInstances.length > 0 && instanceIds.length > 0,
  })
}
