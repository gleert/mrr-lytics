import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'

export interface TeamMember {
  id: string
  user_id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'viewer'
  is_default: boolean
  joined_at: string
  last_sign_in: string | null
}

export interface TeamLimits {
  current: number
  max: number
  can_invite: boolean
}

export interface TeamResponse {
  members: TeamMember[]
  current_user_id: string
  current_user_role: 'admin' | 'viewer'
  limits: TeamLimits
}

export function useTeam() {
  return useQuery({
    queryKey: ['team'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: TeamResponse }>('/api/team')
      return response.data
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

export interface InviteMemberData {
  email: string
  role?: 'admin' | 'viewer'
}

export function useInviteMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: InviteMemberData) => {
      const response = await api.post<{ success: boolean; data: { message: string; email: string; role: string } }>(
        '/api/team',
        data
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] })
    },
  })
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: 'admin' | 'viewer' }) => {
      const response = await api.patch<{ success: boolean; data: { message: string } }>(
        `/api/team/${memberId}`,
        { role }
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] })
    },
  })
}

export function useRemoveMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (memberId: string) => {
      await api.delete(`/api/team/${memberId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] })
    },
  })
}
