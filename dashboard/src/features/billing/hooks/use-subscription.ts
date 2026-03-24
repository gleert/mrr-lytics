import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'

// Types
export interface SubscriptionPlan {
  id: string
  name: string
  description: string
  price: {
    monthly: number
    yearly: number
    monthly_display: string
    yearly_display: string
    yearly_monthly_equivalent: string
    yearly_savings_percent: number
  }
  limits: {
    instances: number
    team_members: number
    history_days: number
    webhooks: number
    exports: boolean
  }
  features: string[]
  is_free: boolean
  is_default: boolean
  is_popular: boolean
}

export interface Subscription {
  id: string
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'expired'
  billing_interval: 'month' | 'year' | null
  current_period_start: string | null
  current_period_end: string | null
  trial_end: string | null
  trial_days_remaining: number | null
  trial_expired: boolean
  cancel_at_period_end: boolean
  has_payment_method: boolean
}

export interface SubscriptionUsage {
  instances: number
  team_members: number
  webhooks: number
  oldest_data: string | null
}

export interface SubscriptionData {
  dev_mode: boolean
  subscription: Subscription
  plan: SubscriptionPlan
  usage: SubscriptionUsage
}

interface PlansResponse {
  success: boolean
  data: {
    plans: SubscriptionPlan[]
  }
}

interface SubscriptionResponse {
  success: boolean
  data: SubscriptionData
}

interface CheckoutResponse {
  success: boolean
  data: {
    checkout_url: string
    session_id: string
  }
}

interface PortalResponse {
  success: boolean
  data: {
    portal_url: string
  }
}

/**
 * Hook to fetch all available subscription plans
 */
export function useSubscriptionPlans() {
  return useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: async () => {
      const response = await api.get<PlansResponse>('/api/subscription/plans')
      return response.data.plans
    },
    staleTime: 60 * 60 * 1000, // 1 hour - plans don't change often
  })
}

/**
 * Hook to fetch current subscription status
 */
export function useSubscription() {
  return useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const response = await api.get<SubscriptionResponse>('/api/subscription')
      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to create a Stripe checkout session
 */
export function useCreateCheckout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { plan_id: string; billing_interval: 'month' | 'year' }) => {
      const response = await api.post<CheckoutResponse>('/api/stripe/create-checkout', params)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
    },
  })
}

/**
 * Hook to create a Stripe billing portal session
 */
export function useCreatePortal() {
  return useMutation({
    mutationFn: async () => {
      const response = await api.post<PortalResponse>('/api/stripe/create-portal', {})
      return response.data
    },
  })
}

interface ChangePlanResponse {
  success: boolean
  data: {
    subscription: Subscription
    plan: {
      id: string
      name: string
      limits: Record<string, number>
      features: string[]
    }
    dev_mode: boolean
    message: string
  }
}

/**
 * Hook to change subscription plan manually (development mode only)
 */
export function useChangePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { plan_id: string; simulate_trial?: boolean }) => {
      const response = await api.post<ChangePlanResponse>('/api/subscription/change', {
        plan_id: params.plan_id,
        simulate_trial: params.simulate_trial ?? true,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
    },
  })
}

/**
 * Format limit value for display
 */
export function formatLimit(value: number): string {
  if (value === -1) return 'Unlimited'
  return value.toString()
}

/**
 * Check if a limit is exceeded
 */
export function isLimitExceeded(current: number, limit: number): boolean {
  if (limit === -1) return false
  return current >= limit
}

/**
 * Calculate usage percentage
 */
export function getUsagePercent(current: number, limit: number): number {
  if (limit === -1) return 0
  if (limit === 0) return 100
  return Math.min(100, Math.round((current / limit) * 100))
}
