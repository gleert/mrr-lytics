import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { useFilters } from '@/app/providers'

export interface RevenueStats {
  total_revenue: number
  recurring_revenue: number
  onetime_revenue: number
  recurring_percentage: number
  mrr: number
  arr: number
  revenue_change: number
  recurring_change: number
  onetime_change: number
  recurring_pct_change: number
  invoices_count: number
  avg_invoice_amount: number
  paid_total: number
  paid_count: number
  unpaid_total: number
  unpaid_count: number
  projected_next_period: number
  recent_paid: Array<{ invoice_num: string; amount: number; date: string; client_name: string }>
  top_product: { name: string; revenue: number } | null
  period: {
    type: string
    start_date: string
    end_date: string
    days: number
  }
}

export interface RevenueBreakdownItem {
  name: string
  value: number
  color?: string
}

export interface RevenueBreakdown {
  breakdown: RevenueBreakdownItem[]
  group_by: string
}

export type BreakdownGroupBy = 'category' | 'source' | 'type'

export function useRevenueStats() {
  const { currentInstance, period, customDateRange, getSelectedInstanceIds, getPeriodParams, allInstances } = useFilters()

  const instanceKey = currentInstance?.instance_id || 'all'

  return useQuery({
    queryKey: ['revenue', 'stats', instanceKey, period, customDateRange],
    queryFn: async () => {
      const params: Record<string, string> = { ...getPeriodParams() }
      const instanceIds = getSelectedInstanceIds()
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      const response = await api.get<{ success: boolean; data: RevenueStats }>('/api/revenue/stats', params)
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    enabled: allInstances.length > 0,
  })
}

export function useRevenueBreakdown(groupBy: BreakdownGroupBy) {
  const { currentInstance, period, customDateRange, getSelectedInstanceIds, getPeriodParams, allInstances } = useFilters()

  const instanceKey = currentInstance?.instance_id || 'all'

  return useQuery({
    queryKey: ['revenue', 'breakdown', instanceKey, period, customDateRange, groupBy],
    queryFn: async () => {
      const params: Record<string, string> = { ...getPeriodParams(), group_by: groupBy }
      const instanceIds = getSelectedInstanceIds()
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      const response = await api.get<{ success: boolean; data: RevenueBreakdown }>('/api/revenue/breakdown', params)
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    enabled: allInstances.length > 0,
  })
}

// Revenue Transactions types
export interface RevenueTransaction {
  id: string
  date: string
  invoice_id: number
  invoice_num: string
  invoice_status: string
  invoice_total: number
  client_id: number
  client_name: string
  category: string | null
  product_name: string
  type: string
  amount: number
}

export interface TransactionFilters {
  search?: string
  type?: string
  category?: string
  source?: string
  status?: string
  amount_min?: number
  amount_max?: number
  start_date?: string
  end_date?: string
}

export interface TransactionsResponse {
  transactions: RevenueTransaction[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
  filters: {
    types: string[]
    categories: Array<{ id: string; name: string }>
    sources: string[]
  }
}

export function useRevenueTransactions(
  page: number = 1,
  limit: number = 20,
  filters: TransactionFilters = {},
  sortBy: string = 'date',
  sortOrder: 'asc' | 'desc' = 'desc'
) {
  const { currentInstance, getSelectedInstanceIds, allInstances } = useFilters()
  
  const instanceKey = currentInstance?.instance_id || 'all'
  
  return useQuery({
    queryKey: ['revenue', 'transactions', instanceKey, page, limit, filters, sortBy, sortOrder],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(limit),
        sort_by: sortBy,
        sort_order: sortOrder,
      }
      
      const instanceIds = getSelectedInstanceIds()
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      
      // Add filters
      if (filters.search) params.search = filters.search
      if (filters.type) params.type = filters.type
      if (filters.category) params.category = filters.category
      if (filters.source) params.source = filters.source
      if (filters.status) params.status = filters.status
      if (filters.amount_min !== undefined) params.amount_min = String(filters.amount_min)
      if (filters.amount_max !== undefined) params.amount_max = String(filters.amount_max)
      if (filters.start_date) params.start_date = filters.start_date
      if (filters.end_date) params.end_date = filters.end_date
      
      const response = await api.get<{ success: boolean; data: TransactionsResponse }>('/api/revenue/transactions', params)
      return response.data
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: allInstances.length > 0,
  })
}

// Top Transactions types
export interface TopTransaction {
  id: string
  date: string
  invoice_num: string
  client_name: string
  product_name: string
  amount: number
}

export interface TopTransactionsResponse {
  transactions: TopTransaction[]
  total_amount: number
  period_days: number
}

/**
 * Hook to fetch top transactions by amount
 * @param limit Number of transactions (default: 4)
 */
export function useTopTransactions(limit: number = 4) {
  const { currentInstance, period, getSelectedInstanceIds, allInstances } = useFilters()
  
  const instanceKey = currentInstance?.instance_id || 'all'
  
  return useQuery({
    queryKey: ['revenue', 'top-transactions', instanceKey, period, limit],
    queryFn: async () => {
      const params: Record<string, string> = {
        limit: String(limit),
        period,
      }
      
      const instanceIds = getSelectedInstanceIds()
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      
      const response = await api.get<{ success: boolean; data: TopTransactionsResponse }>('/api/revenue/top-transactions', params)
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    enabled: allInstances.length > 0,
  })
}

// Revenue Breakdown Trend types
export interface RevenueBreakdownTrendPoint {
  date: string
  total: number
  [groupName: string]: string | number
}

export interface RevenueBreakdownTrendGroup {
  name: string
  color: string
}

export interface RevenueBreakdownTrendResponse {
  trend: RevenueBreakdownTrendPoint[]
  groups: RevenueBreakdownTrendGroup[]
  group_by: string
  categories_available: boolean
  aggregation: 'day' | 'week'
  period: {
    type: string
    start_date: string
    end_date: string
    days: number
  }
}

/**
 * Hook to fetch revenue over time broken down by category/source/type
 */
export function useRevenueBreakdownTrend(groupBy: BreakdownGroupBy = 'category') {
  const { currentInstance, period, customDateRange, getSelectedInstanceIds, getPeriodParams, allInstances } = useFilters()

  const instanceKey = currentInstance?.instance_id || 'all'

  return useQuery({
    queryKey: ['revenue', 'breakdown-trend', instanceKey, period, customDateRange, groupBy],
    queryFn: async () => {
      const params: Record<string, string> = { ...getPeriodParams(), group_by: groupBy }
      const instanceIds = getSelectedInstanceIds()
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      const response = await api.get<{ success: boolean; data: RevenueBreakdownTrendResponse }>('/api/revenue/breakdown-trend', params)
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    enabled: allInstances.length > 0,
  })
}

// Revenue Trend types
export interface RevenueTrendDataPoint {
  date: string
  recurring: number
  onetime: number
  total: number
}

export interface RevenueTrendResponse {
  trend: RevenueTrendDataPoint[]
  aggregation: 'day' | 'week'
  period: {
    type: string
    start_date: string
    end_date: string
    days: number
  }
}

/**
 * Hook to fetch revenue trend over time (recurring vs one-time)
 */
export function useRevenueTrend() {
  const { currentInstance, period, customDateRange, getSelectedInstanceIds, getPeriodParams, allInstances } = useFilters()

  const instanceKey = currentInstance?.instance_id || 'all'

  return useQuery({
    queryKey: ['revenue', 'trend', instanceKey, period, customDateRange],
    queryFn: async () => {
      const params: Record<string, string> = { ...getPeriodParams() }
      
      const instanceIds = getSelectedInstanceIds()
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      
      const response = await api.get<{ success: boolean; data: RevenueTrendResponse }>('/api/revenue/trend', params)
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    enabled: allInstances.length > 0,
  })
}
