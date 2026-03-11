import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { useFilters } from '@/app/providers'

export interface ExpiringDomain {
  domain: string
  expirydate: string
  days_left: number
  recurringamount: number
  client_name: string | null
}

export interface RegisteredVsExpired {
  year: string
  active: number
  lost: number
}

export interface DomainStats {
  total_domains: number
  active_domains: number
  pending_domains: number
  expired_domains: number
  expiring_soon: number
  new_domains: number
  new_domains_change: number
  total_recurring: number
  do_not_renew: number
  status_breakdown: Array<{ name: string; value: number }>
  tld_breakdown: Array<{ name: string; value: number }>
  all_tlds: string[]
  registered_vs_expired: RegisteredVsExpired[]
  expiring_domains: ExpiringDomain[]
}

export interface WhmcsDomain {
  id: string
  instance_id: string
  whmcs_id: number
  client_id: number
  orderid: number | null
  type: string | null
  registrationdate: string | null
  domain: string
  firstpaymentamount: number
  recurringamount: number
  registrationperiod: number | null
  expirydate: string | null
  nextduedate: string | null
  nextinvoicedate: string | null
  paymentmethod: string | null
  status: string
  dnsmanagement: boolean
  emailforwarding: boolean
  idprotection: boolean
  donotrenew: boolean
  synced_at: string
  client_name: string | null
}

export interface DomainsListResponse {
  domains: WhmcsDomain[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
  }
}

export function useDomainStats() {
  const { currentInstance, period, getSelectedInstanceIds, allInstances } = useFilters()
  
  const instanceKey = currentInstance?.instance_id || 'all'
  
  return useQuery({
    queryKey: ['domains', 'stats', instanceKey, period],
    queryFn: async () => {
      const params: Record<string, string> = { period }
      const instanceIds = getSelectedInstanceIds()
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      const response = await api.get<{ success: boolean; data: DomainStats }>('/api/domains/stats', params)
      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: allInstances.length > 0,
  })
}

export function useDomainsList(options: {
  status?: string
  tld?: string
  search?: string
  sort?: string
  order?: 'asc' | 'desc'
  page?: number
  limit?: number
} = {}) {
  const { period, getSelectedInstanceIds, allInstances } = useFilters()
  const { status = 'all', tld = 'all', search = '', sort = 'domain', order = 'asc', page = 1, limit = 50 } = options
  
  const instanceIds = getSelectedInstanceIds()
  
  return useQuery({
    queryKey: ['domains', 'list', instanceIds.join(','), period, status, tld, search, sort, order, page, limit],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page,
        limit,
        sort,
        order,
        period,
      }
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      if (status !== 'all') {
        params.status = status
      }
      if (tld !== 'all') {
        params.tld = tld
      }
      if (search) {
        params.search = search
      }
      const response = await api.get<{ success: boolean; data: DomainsListResponse }>('/api/domains', params)
      return response.data
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: allInstances.length > 0 && instanceIds.length > 0,
  })
}
