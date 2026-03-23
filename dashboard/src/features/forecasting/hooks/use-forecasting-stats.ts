import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { useFilters } from '@/app/providers'

export interface RevenueTrendPoint {
  date: string
  revenue: number
}

export interface BillingCycleBreakdown {
  name: string
  count: number
  mrr: number
  total: number
}

export interface ScenarioData {
  growth: number
  mrr: number
  arr: number
}

export interface Scenarios {
  pessimistic: ScenarioData
  baseline: ScenarioData
  optimistic: ScenarioData
}

export interface ForecastingStats {
  current_mrr: number
  projected_mrr: number
  projected_growth: number
  projected_arr: number
  confidence_level: number
  data_points: number
  period_days: number
  period_revenue: number
  bucket_type: 'daily' | 'weekly' | 'monthly'
  // ARPU
  active_clients: number
  current_arpu: number
  projected_arpu: number
  // Growth acceleration
  growth_acceleration: 'accelerating' | 'stable' | 'decelerating'
  // Milestone
  next_milestone: number | null
  months_to_milestone: number | null
  // MRR delta
  mrr_delta: number
  // Breakdown data
  revenue_trend: RevenueTrendPoint[]
  billing_cycle_breakdown: BillingCycleBreakdown[]
  // Scenario comparison
  scenarios: Scenarios
}

export function useForecastingStats() {
  const { currentInstance, period, getSelectedInstanceIds, allInstances } = useFilters()
  
  const instanceKey = currentInstance?.instance_id || 'all'
  
  return useQuery({
    queryKey: ['forecasting', 'stats', instanceKey, period],
    queryFn: async () => {
      const params: Record<string, string> = { period }
      const instanceIds = getSelectedInstanceIds()
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      const response = await api.get<{ success: boolean; data: ForecastingStats }>('/api/forecasting', params)
      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: allInstances.length > 0,
  })
}
