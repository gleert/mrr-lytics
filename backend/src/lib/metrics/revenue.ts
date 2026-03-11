import { createAdminClient } from '@/lib/supabase/admin'
import type { RevenueByProduct } from '@/types/api'

/**
 * Calculate revenue by product for a single WHMCS instance
 */
export async function calculateRevenueByProduct(instanceId: string): Promise<RevenueByProduct[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('mv_revenue_by_product')
    .select('product_id, product_name, product_type, active_count, mrr')
    .eq('instance_id', instanceId)
    .order('mrr', { ascending: false })

  if (error) {
    console.error('Revenue by product error:', error)
    return []
  }

  // Calculate total MRR for percentages
  const totalMrr = (data || []).reduce((sum, p) => sum + (Number(p.mrr) || 0), 0)

  return (data || []).map((p) => ({
    product_id: p.product_id || 0,
    product_name: p.product_name || 'Unknown',
    product_type: p.product_type,
    active_count: p.active_count || 0,
    mrr: Number(p.mrr) || 0,
    percentage: totalMrr > 0 ? ((Number(p.mrr) || 0) / totalMrr) * 100 : 0,
  }))
}

/**
 * Calculate revenue by product for multiple WHMCS instances (aggregated)
 */
export async function calculateRevenueByProductMultiInstance(instanceIds: string[]): Promise<RevenueByProduct[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('mv_revenue_by_product')
    .select('product_id, product_name, product_type, active_count, mrr')
    .in('instance_id', instanceIds)

  if (error) {
    console.error('Revenue by product error:', error)
    return []
  }

  // Aggregate by product_id (same product across instances)
  const productMap = new Map<number, { name: string; type: string; count: number; mrr: number }>()
  ;(data || []).forEach((p) => {
    const productId = p.product_id || 0
    const existing = productMap.get(productId)
    if (existing) {
      existing.count += p.active_count || 0
      existing.mrr += Number(p.mrr) || 0
    } else {
      productMap.set(productId, {
        name: p.product_name || 'Unknown',
        type: p.product_type || '',
        count: p.active_count || 0,
        mrr: Number(p.mrr) || 0,
      })
    }
  })

  // Convert to array and calculate percentages
  const products = Array.from(productMap.entries())
  const totalMrr = products.reduce((sum, [, p]) => sum + p.mrr, 0)

  return products
    .map(([productId, p]) => ({
      product_id: productId,
      product_name: p.name,
      product_type: p.type,
      active_count: p.count,
      mrr: p.mrr,
      percentage: totalMrr > 0 ? (p.mrr / totalMrr) * 100 : 0,
    }))
    .sort((a, b) => b.mrr - a.mrr)
}
