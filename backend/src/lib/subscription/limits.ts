import { createClient, SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>

export type LimitType = 'instances' | 'team_members' | 'history_days' | 'exports'

export interface LimitCheckResult {
  allowed: boolean
  limit: number
  current: number
  planId: string
  planName: string
}

export class SubscriptionLimitError extends Error {
  limitType: LimitType
  limit: number
  current: number
  planId: string

  constructor(limitType: LimitType, limit: number, current: number, planId: string) {
    super(`Limit exceeded: ${limitType}. Your ${planId} plan allows ${limit === -1 ? 'unlimited' : limit}, you have ${current}.`)
    this.name = 'SubscriptionLimitError'
    this.limitType = limitType
    this.limit = limit
    this.current = current
    this.planId = planId
  }
}

/**
 * Check if tenant can perform an action based on their subscription limits
 * 
 * @param tenantId - The tenant ID to check
 * @param limitType - The type of limit to check
 * @returns LimitCheckResult with allowed status
 * @throws SubscriptionLimitError if limit is exceeded
 */
export async function checkSubscriptionLimit(
  tenantId: string,
  limitType: LimitType
): Promise<LimitCheckResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get current subscription and plan
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select(`
      plan_id,
      status,
      subscription_plans (
        name,
        limits
      )
    `)
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'trialing'])
    .single()

  if (subError || !subscription) {
    // No active subscription, use free plan limits
    const { data: freePlan } = await supabase
      .from('subscription_plans')
      .select('id, name, limits')
      .eq('is_default', true)
      .single()

    if (!freePlan) {
      throw new Error('No default plan configured')
    }

    return checkLimitAgainstPlan(
      tenantId,
      limitType,
      freePlan.id,
      freePlan.name,
      freePlan.limits as Record<string, number>,
      supabase
    )
  }

  const plan = subscription.subscription_plans as unknown as {
    name: string
    limits: Record<string, number>
  }

  return checkLimitAgainstPlan(
    tenantId,
    limitType,
    subscription.plan_id,
    plan.name,
    plan.limits,
    supabase
  )
}

async function checkLimitAgainstPlan(
  tenantId: string,
  limitType: LimitType,
  planId: string,
  planName: string,
  limits: Record<string, number>,
  supabase: AnySupabaseClient
): Promise<LimitCheckResult> {
  const limit = limits[limitType] ?? 0
  
  // -1 means unlimited
  if (limit === -1) {
    return {
      allowed: true,
      limit: -1,
      current: 0,
      planId,
      planName,
    }
  }

  // Get current usage based on limit type
  let current = 0

  switch (limitType) {
    case 'instances': {
      const { count } = await supabase
        .from('whmcs_instances')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
      current = count ?? 0
      break
    }

    case 'team_members': {
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
      current = count ?? 0
      break
    }

    case 'history_days': {
      // This is a read limit, not a creation limit
      // Just return the limit value
      return {
        allowed: true,
        limit,
        current: 0,
        planId,
        planName,
      }
    }

    case 'exports': {
      // Boolean limit - check if exports are enabled
      const exportsEnabled = !!limits['exports']
      return {
        allowed: exportsEnabled,
        limit: exportsEnabled ? 1 : 0,
        current: 0,
        planId,
        planName,
      }
    }
  }

  return {
    allowed: current < limit,
    limit,
    current,
    planId,
    planName,
  }
}

/**
 * Get all limits for a tenant's current plan
 */
export async function getSubscriptionLimits(tenantId: string): Promise<{
  planId: string
  planName: string
  limits: Record<LimitType, number>
  usage: Record<string, number>
}> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get subscription with plan
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select(`
      plan_id,
      subscription_plans (
        name,
        limits
      )
    `)
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'trialing'])
    .single()

  let planId = 'free'
  let planName = 'Free'
  let limits: Record<string, number> = {}

  if (subscription) {
    const plan = subscription.subscription_plans as unknown as {
      name: string
      limits: Record<string, number>
    }
    planId = subscription.plan_id
    planName = plan.name
    limits = plan.limits
  } else {
    // Use free plan
    const { data: freePlan } = await supabase
      .from('subscription_plans')
      .select('id, name, limits')
      .eq('is_default', true)
      .single()

    if (freePlan) {
      planId = freePlan.id
      planName = freePlan.name
      limits = freePlan.limits as Record<string, number>
    }
  }

  // Get current usage
  const { data: usage } = await supabase.rpc('get_tenant_usage', {
    p_tenant_id: tenantId,
  })

  return {
    planId,
    planName,
    limits: limits as Record<LimitType, number>,
    usage: {
      instances: usage?.[0]?.instances_count ?? 0,
      team_members: usage?.[0]?.team_members_count ?? 0,
    },
  }
}
