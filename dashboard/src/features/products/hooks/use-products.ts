import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { useFilters } from '@/app/providers'

export interface CategoryInfo {
  id: string
  name: string
  color: string
}

export interface Product {
  id: string
  instance_id: string
  whmcs_id: number
  gid: number | null
  name: string
  type: string
  paytype: string
  hidden: number | null
  retired: number | null
  synced_at: string
  instance_name: string
  instance_color: string
  // Direct category mapping (if product has its own)
  category: CategoryInfo | null
  category_mapping_id: string | null
  // Inherited category from group
  inherited_category: CategoryInfo | null
  is_category_inherited: boolean
  // Group info for UI
  group_name: string | null
  group_has_category: boolean
}

export interface ProductGroup {
  id: string
  instance_id: string
  whmcs_id: number
  name: string
  slug: string
  hidden: number | null
  synced_at: string
  instance_name: string
  instance_color: string
  category: CategoryInfo | null
  category_mapping_id: string | null
  // Count of products in this group
  products_count: number
  // Count of products inheriting this group's category
  inheriting_products_count: number
}

interface ProductsResponse {
  products: Product[]
  product_groups: ProductGroup[]
}

export function useProducts(includeHidden = false) {
  const { getSelectedInstanceIds, allInstances } = useFilters()
  const instanceIds = getSelectedInstanceIds()
  
  return useQuery({
    queryKey: ['products', instanceIds, includeHidden],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (instanceIds.length > 0) {
        params.instance_ids = instanceIds.join(',')
      }
      if (includeHidden) {
        params.include_hidden = 'true'
      }
      const response = await api.get<{ success: boolean; data: ProductsResponse }>('/api/products', params)
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    enabled: allInstances.length > 0,
  })
}

export interface CreateMappingData {
  instance_id: string
  mapping_type: 'product' | 'product_group'
  whmcs_id: number
}

export function useCreateCategoryMapping() {
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
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

export function useDeleteCategoryMapping() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ 
      categoryId, 
      instanceId, 
      mappingType, 
      whmcsId 
    }: { 
      categoryId: string
      instanceId: string
      mappingType: 'product' | 'product_group'
      whmcsId: number 
    }) => {
      await api.delete(
        `/api/categories/${categoryId}/mappings?instance_id=${instanceId}&mapping_type=${mappingType}&whmcs_id=${whmcsId}`
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}
