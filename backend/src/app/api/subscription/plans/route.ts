import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'

export const dynamic = 'force-dynamic'

/**
 * GET /api/subscription/plans
 * 
 * Get all available subscription plans
 * This endpoint is public (for pricing page)
 */
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select(`
        id,
        name,
        description,
        price_monthly,
        price_yearly,
        limits,
        features,
        is_default,
        sort_order
      `)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (plansError) {
      throw new Error(`Failed to get plans: ${plansError.message}`)
    }

    // Format response with computed fields
    const formattedPlans = plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: {
        monthly: plan.price_monthly,
        yearly: plan.price_yearly,
        monthly_display: formatPrice(plan.price_monthly),
        yearly_display: formatPrice(plan.price_yearly),
        yearly_monthly_equivalent: formatPrice(Math.round(plan.price_yearly / 12)),
        yearly_savings_percent: plan.price_monthly > 0 
          ? Math.round((1 - (plan.price_yearly / 12) / plan.price_monthly) * 100)
          : 0,
      },
      limits: plan.limits,
      features: plan.features,
      is_free: plan.id === 'free',
      is_trial: plan.id === 'free',
      trial_days: plan.id === 'free' ? (plan.limits as Record<string, number>)?.trial_days ?? 15 : null,
      is_default: plan.is_default,
      is_popular: plan.id === 'pro', // Mark Pro as popular
    }))

    return success({
      plans: formattedPlans,
    })
  } catch (err) {
    console.error('Get plans error:', err)
    return error(err instanceof Error ? err : new Error('Failed to get plans'))
  }
}

/**
 * Format price in cents to display string
 */
function formatPrice(cents: number): string {
  if (cents === 0) return 'Free'
  return `$${(cents / 100).toFixed(0)}`
}
