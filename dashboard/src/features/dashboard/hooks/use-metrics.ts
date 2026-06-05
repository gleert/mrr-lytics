import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { useFilters } from '@/app/providers'
import type { AllMetrics, MRRMetrics, ChurnMetrics, MetricsHistoryResponse } from '@/shared/types'

export function useMetrics() {
  const { currentInstance, getSelectedInstanceIds, allInstances } = useFilters()
  
  // Use instance IDs for query key (null = all)
  const instanceKey = currentInstance?.instance_id || 'all'
  
  // Dashboard always uses 30d (current month)
  const period = '30d'
  
  return useQuery({
    queryKey: ['metrics', instanceKey, period],
    queryFn: async () => {
      const params: Record<string, string> = { period }
      // Pass comma-separated instance IDs (supports multiple)
      const instanceIds = getSelectedInstanceIds()
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      const response = await api.get<{ success: boolean; data: AllMetrics }>('/api/metrics', params)
      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: allInstances.length > 0, // Fetch when instances are loaded
  })
}

export function useMRRMetrics() {
  const { currentInstance, period, customDateRange, getSelectedInstanceIds, getPeriodParams, allInstances } = useFilters()

  const instanceKey = currentInstance?.instance_id || 'all'

  return useQuery({
    queryKey: ['metrics', 'mrr', instanceKey, period, customDateRange],
    queryFn: async () => {
      const params: Record<string, string> = { ...getPeriodParams() }
      const instanceIds = getSelectedInstanceIds()
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      const response = await api.get<{ success: boolean; data: MRRMetrics }>('/api/metrics/mrr', params)
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    enabled: allInstances.length > 0,
  })
}

export function useChurnMetrics() {
  const { currentInstance, period, customDateRange, getSelectedInstanceIds, getPeriodParams, allInstances } = useFilters()

  const instanceKey = currentInstance?.instance_id || 'all'

  return useQuery({
    queryKey: ['metrics', 'churn', instanceKey, period, customDateRange],
    queryFn: async () => {
      const params: Record<string, string> = { ...getPeriodParams() }
      const instanceIds = getSelectedInstanceIds()
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      const response = await api.get<{ success: boolean; data: ChurnMetrics }>('/api/metrics/churn', params)
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    enabled: allInstances.length > 0,
  })
}

/**
 * Hook to fetch historical metrics for charts (MRR trends, churn history, etc.)
 * @param days Number of days of history to fetch (default: 30, max: 365)
 */
export function useMetricsHistory(days: number = 30) {
  const { currentInstance, getSelectedInstanceIds, allInstances } = useFilters()
  
  const instanceKey = currentInstance?.instance_id || 'all'
  
  return useQuery({
    queryKey: ['metrics', 'history', instanceKey, days],
    queryFn: async () => {
      const params: Record<string, string> = { days: String(days) }
      const instanceIds = getSelectedInstanceIds()
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      const response = await api.get<{ success: boolean } & MetricsHistoryResponse>('/api/metrics/history', params)
      return {
        data: response.data,
        summary: response.summary,
        instance_ids: response.instance_ids,
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes (historical data changes less frequently)
    enabled: allInstances.length > 0,
  })
}

export interface DailyMRRPoint {
  date: string
  total: number
  pending_churn: number
  categories: Record<string, number>
}

export interface CategoryInfo {
  name: string
  color: string
}

export interface DailyMRRResponse {
  daily_data: DailyMRRPoint[]
  categories: CategoryInfo[]
  period_days: number
}

export interface GroupBreakdown {
  name: string
  mrr: number
  percentage: number
  count: number
  color: string
}

export interface MRRBreakdownResponse {
  total_mrr: number
  breakdown: GroupBreakdown[]
  using_categories: boolean
  uncategorized_mrr_pct: number
}

export interface MonthlyDataPoint {
  month: string
  total: number
  groups: Record<string, number>
}

export interface GroupInfo {
  id: number
  name: string
  color: string
  total_mrr: number
}

export interface MRRTrendResponse {
  monthly_data: MonthlyDataPoint[]
  all_groups: GroupInfo[]
  default_groups: string[]
  using_categories: boolean
  uncategorized_mrr_pct: number
}

export interface MovementDataPoint {
  month: string
  starting_mrr: number
  new_mrr: number
  churned_mrr: number
  expansion_mrr: number
  contraction_mrr: number
  ending_mrr: number
  net_change: number
}

export interface MRRMovementTotals {
  new_mrr: number
  churned_mrr: number
  expansion_mrr: number
  contraction_mrr: number
  net_change: number
}

export interface MRRMovementResponse {
  movement_data: MovementDataPoint[]
  totals: MRRMovementTotals
  months: number
}

/**
 * Hook to fetch daily committed MRR with category breakdown
 * @param days Number of days (30, 60, or 90)
 */
export function useDailyMRR(days: 30 | 60 | 90 = 30) {
  const { currentInstance, getSelectedInstanceIds, allInstances } = useFilters()
  
  const instanceKey = currentInstance?.instance_id || 'all'
  
  return useQuery({
    queryKey: ['metrics', 'daily-mrr', instanceKey, days],
    queryFn: async () => {
      const params: Record<string, string> = { days: String(days) }
      const instanceIds = getSelectedInstanceIds()
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      const response = await api.get<{ success: boolean; data: DailyMRRResponse }>('/api/metrics/daily-mrr', params)
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    enabled: allInstances.length > 0,
  })
}

/**
 * Hook to fetch MRR breakdown by product group
 */
export function useMRRBreakdown() {
  const { currentInstance, getSelectedInstanceIds, allInstances } = useFilters()
  
  const instanceKey = currentInstance?.instance_id || 'all'
  
  return useQuery({
    queryKey: ['metrics', 'mrr-breakdown', instanceKey],
    queryFn: async () => {
      const params: Record<string, string> = {}
      const instanceIds = getSelectedInstanceIds()
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      const response = await api.get<{ success: boolean; data: MRRBreakdownResponse }>('/api/metrics/mrr-breakdown', params)
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    enabled: allInstances.length > 0,
  })
}

/**
 * Hook to fetch 12-month MRR trend by product group
 */
export function useMRRTrend() {
  const { currentInstance, getSelectedInstanceIds, allInstances } = useFilters()
  
  const instanceKey = currentInstance?.instance_id || 'all'
  
  return useQuery({
    queryKey: ['metrics', 'mrr-trend', instanceKey],
    queryFn: async () => {
      const params: Record<string, string> = {}
      const instanceIds = getSelectedInstanceIds()
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      const response = await api.get<{ success: boolean; data: MRRTrendResponse }>('/api/metrics/mrr-trend', params)
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    enabled: allInstances.length > 0,
  })
}

export type MRRMovementItemType = 'new' | 'churned' | 'expansion' | 'contraction'

export interface MRRMovementItem {
  kind: 'hosting' | 'billable' | 'domain'
  whmcs_id: number
  client_id: number | null
  client_name: string
  description: string
  monthly_amount: number
  billing_cycle: string
  reference_date: string | null
  instance_id: string
  // Only present for expansion/contraction.
  mrr_before?: number
  mrr_after?: number
}

export interface MRRMovementItemsResponse {
  items: MRRMovementItem[]
  total: number
  count: number
  type: MRRMovementItemType
  month: string
}

/**
 * Hook to fetch the detailed items behind a New/Churned/Expansion/Contraction MRR pill.
 * Disabled when type is null so we only fetch when the modal opens.
 */
export function useMRRMovementItems(type: MRRMovementItemType | null, month: string | null) {
  const { currentInstance, getSelectedInstanceIds, allInstances } = useFilters()
  const instanceKey = currentInstance?.instance_id || 'all'

  return useQuery({
    queryKey: ['metrics', 'mrr-movement-items', instanceKey, type, month],
    queryFn: async () => {
      const params: Record<string, string> = { type: type! }
      if (month) params.month = month
      const instanceIds = getSelectedInstanceIds()
      if (instanceIds.length > 0) params.instance_ids = instanceIds.join(',')
      const response = await api.get<{ success: boolean; data: MRRMovementItemsResponse }>('/api/metrics/mrr-movement/items', params)
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!type && allInstances.length > 0,
  })
}

/**
 * Hook to fetch monthly MRR movement breakdown
 * @param months Number of months to show (3-12, default: 6)
 */
export function useMRRMovement(months: number = 6) {
  const { currentInstance, getSelectedInstanceIds, allInstances } = useFilters()
  
  const instanceKey = currentInstance?.instance_id || 'all'
  
  return useQuery({
    queryKey: ['metrics', 'mrr-movement', instanceKey, months],
    queryFn: async () => {
      const params: Record<string, string> = { months: String(months) }
      const instanceIds = getSelectedInstanceIds()
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      const response = await api.get<{ success: boolean; data: MRRMovementResponse }>('/api/metrics/mrr-movement', params)
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    enabled: allInstances.length > 0,
  })
}

export interface MRRLedgerEntry {
  type: 'hosting' | 'billable' | 'domain'
  whmcs_id: number
  client_id: number | null
  client_name: string
  description: string
  billing_cycle: string
  monthly_amount: number
  start_date: string | null
  instance_id: string
}

export interface MRRLedgerResponse {
  entries: MRRLedgerEntry[]
  total: number
  count: number
  by_category: { hosting: number; billable: number; domains: number }
}

/**
 * Hook to fetch the MRR ledger: every item contributing to the current MRR,
 * chronological by start date. Running balance is derived in the view.
 */
export function useMRRLedger() {
  const { currentInstance, getSelectedInstanceIds, allInstances } = useFilters()

  const instanceKey = currentInstance?.instance_id || 'all'

  return useQuery({
    queryKey: ['metrics', 'mrr-ledger', instanceKey],
    queryFn: async () => {
      const params: Record<string, string> = {}
      const instanceIds = getSelectedInstanceIds()
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      const response = await api.get<{ success: boolean; data: MRRLedgerResponse }>('/api/metrics/mrr-ledger', params)
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    enabled: allInstances.length > 0,
  })
}

export interface TopProduct {
  id: number
  name: string
  active_services: number
  mrr: number
  percentage: number
}

export interface TopProductsResponse {
  products: TopProduct[]
  total_mrr: number
}

/**
 * Hook to fetch top products by MRR
 * @param limit Number of products to return (default: 5)
 */
export function useTopProducts(limit: number = 5) {
  const { currentInstance, getSelectedInstanceIds, allInstances } = useFilters()
  
  const instanceKey = currentInstance?.instance_id || 'all'
  
  return useQuery({
    queryKey: ['metrics', 'top-products', instanceKey, limit],
    queryFn: async () => {
      const params: Record<string, string> = { limit: String(limit) }
      const instanceIds = getSelectedInstanceIds()
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      const response = await api.get<{ success: boolean; data: TopProductsResponse }>('/api/metrics/top-products', params)
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    enabled: allInstances.length > 0,
  })
}

export interface PendingCancellation {
  id: number
  client_name: string
  client_id: number
  item_name: string
  mrr_loss: number
  churn_date: string
  days_until_churn: number
}

export interface PendingCancellationsResponse {
  cancellations: PendingCancellation[]
  total_mrr_loss: number
  count: number
}

/**
 * Hook to fetch pending cancellations (services scheduled for termination)
 * @param limit Number of cancellations to return (default: 10)
 */
export function usePendingCancellations(limit: number = 10) {
  const { currentInstance, getSelectedInstanceIds, allInstances } = useFilters()
  
  const instanceKey = currentInstance?.instance_id || 'all'
  
  return useQuery({
    queryKey: ['metrics', 'pending-cancellations', instanceKey, limit],
    queryFn: async () => {
      const params: Record<string, string> = { limit: String(limit) }
      const instanceIds = getSelectedInstanceIds()
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      const response = await api.get<{ success: boolean; data: PendingCancellationsResponse }>('/api/metrics/pending-cancellations', params)
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    enabled: allInstances.length > 0,
  })
}
