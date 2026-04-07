import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { useFilters } from '@/app/providers'

export interface BillableItemCategory {
  id: string
  name: string
  color: string
}

export interface BillableItem {
  id: string
  instance_id: string
  whmcs_id: number
  client_id: number | null
  client_name: string | null
  description: string | null
  amount: number
  recurcycle: string
  recurfor: number
  invoicecount: number
  duedate: string | null
  monthly_mrr: number
  instance_name: string
  instance_color: string
  status: 'active' | 'completed' | 'one_time'
  category: BillableItemCategory | null
  category_mapping_id: string | null
  in_period: boolean
}

interface BillableItemsResponse {
  items: BillableItem[]
  total_mrr: number
}

export function useBillableItems() {
  const { getSelectedInstanceIds, allInstances, period, customDateRange, getPeriodParams } = useFilters()
  const instanceIds = getSelectedInstanceIds()

  return useQuery({
    queryKey: ['billable-items', instanceIds, period, customDateRange],
    queryFn: async () => {
      const params: Record<string, string> = { ...getPeriodParams() }
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      const response = await api.get<{ success: boolean; data: BillableItemsResponse }>(
        '/api/billable-items',
        params
      )
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    enabled: allInstances.length > 0,
  })
}

interface CreateMappingData {
  instance_id: string
  mapping_type: 'product' | 'product_group' | 'billable_item'
  whmcs_id: number
}

export function useCreateBillableItemCategoryMapping() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ categoryId, data }: { categoryId: string; data: CreateMappingData }) => {
      const response = await api.post<{ success: boolean; data: { mapping: unknown } }>(
        `/api/categories/${categoryId}/mappings`,
        data
      )
      return response.data.mapping
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billable-items'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

export function useDeleteBillableItemCategoryMapping() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      categoryId,
      instanceId,
      whmcsId,
    }: {
      categoryId: string
      instanceId: string
      whmcsId: number
    }) => {
      await api.delete(
        `/api/categories/${categoryId}/mappings?instance_id=${instanceId}&mapping_type=billable_item&whmcs_id=${whmcsId}`
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billable-items'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}
