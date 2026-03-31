import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { useFilters } from '@/app/providers'

export interface ProductChurnData {
  whmcs_id: number
  instance_id: string
  active_services: number
  churned_services: number
  churned_mrr: number
  churn_rate: number
}

interface ProductsChurnResponse {
  products: ProductChurnData[]
  period_days: number
}

export function useProductsChurn(periodDays: number = 30) {
  const { getSelectedInstanceIds, allInstances } = useFilters()
  const instanceIds = getSelectedInstanceIds()

  return useQuery({
    queryKey: ['products-churn', instanceIds, periodDays],
    queryFn: async () => {
      const params: Record<string, string | number> = { period_days: periodDays }
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      const response = await api.get<{ success: boolean; data: ProductsChurnResponse }>(
        '/api/metrics/products-churn',
        params
      )
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    enabled: allInstances.length > 0,
  })
}
