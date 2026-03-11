import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'

export interface Category {
  id: string
  tenant_id: string
  name: string
  slug: string
  description: string | null
  color: string
  sort_order: number
  is_active: boolean
  mappings_count: number
  created_at: string
  updated_at: string
}

export interface CreateCategoryData {
  name: string
  description?: string
  color?: string
  sort_order?: number
  is_active?: boolean
}

export interface UpdateCategoryData {
  name?: string
  description?: string
  color?: string
  sort_order?: number
  is_active?: boolean
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: { categories: Category[] } }>('/api/categories')
      return response.data.categories
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useCategory(categoryId: string) {
  return useQuery({
    queryKey: ['categories', categoryId],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: { category: Category } }>(`/api/categories/${categoryId}`)
      return response.data.category
    },
    enabled: !!categoryId,
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateCategoryData) => {
      const response = await api.post<{ success: boolean; data: { category: Category } }>('/api/categories', data)
      return response.data.category
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ categoryId, data }: { categoryId: string; data: UpdateCategoryData }) => {
      const response = await api.patch<{ success: boolean; data: { category: Category } }>(`/api/categories/${categoryId}`, data)
      return response.data.category
    },
    onSuccess: (_, { categoryId }) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories', categoryId] })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (categoryId: string) => {
      await api.delete(`/api/categories/${categoryId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}
