import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

interface TopProduct {
  id: number
  name: string
  active_services: number
  mrr: number
  percentage: number
}

/**
 * GET /api/metrics/top-products - Get top products by MRR
 */
export async function GET(request: NextRequest) {
  try {
    const headersList = await headers()
    const auth = getAuthContext(headersList)

    if (!auth) {
      throw new UnauthorizedError('Authentication required')
    }

    const { searchParams } = new URL(request.url)
    const instanceIdsParam = searchParams.get('instance_ids')
    const instanceIdParam = searchParams.get('instance_id')
    const limitParam = searchParams.get('limit') || '5'

    let instanceIds: string[] = []
    if (instanceIdsParam) {
      instanceIds = instanceIdsParam.split(',').filter(id => id.trim())
    } else if (instanceIdParam) {
      instanceIds = [instanceIdParam]
    }

    if (instanceIds.length === 0) {
      throw new Error('No instance specified')
    }

    const limit = Math.min(Math.max(parseInt(limitParam, 10) || 5, 1), 20)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get active hosting services
    const { data: hostingServices, error: hostingError } = await supabase
      .from('whmcs_hosting')
      .select('instance_id, packageid, amount, billingcycle, monthly_amount, domainstatus')
      .in('instance_id', instanceIds)
      .in('domainstatus', ['Active', 'Suspended'])

    if (hostingError) {
      console.error('Hosting query error:', hostingError)
      throw new Error('Failed to fetch hosting data')
    }

    // Get products
    const { data: products, error: productsError } = await supabase
      .from('whmcs_products')
      .select('whmcs_id, instance_id, name')
      .in('instance_id', instanceIds)

    if (productsError) {
      console.error('Products query error:', productsError)
      throw new Error('Failed to fetch products data')
    }

    // Build product name map
    const productNameMap = new Map<string, { id: number; name: string }>()
    products?.forEach(product => {
      const key = `${product.instance_id}:${product.whmcs_id}`
      productNameMap.set(key, { 
        id: product.whmcs_id, 
        name: product.name || 'Unnamed Product' 
      })
    })

    // Helper to convert billing cycle to monthly amount
    const toMonthlyAmount = (amount: number, cycle: string): number => {
      const cycleLower = cycle?.toLowerCase() || 'monthly'
      switch (cycleLower) {
        case 'monthly': return amount
        case 'quarterly': return amount / 3
        case 'semi-annually':
        case 'semiannually': return amount / 6
        case 'annually':
        case 'yearly': return amount / 12
        case 'biennially': return amount / 24
        case 'triennially': return amount / 36
        default: return amount
      }
    }

    // Aggregate by product
    const productStats = new Map<string, { id: number; name: string; services: number; mrr: number }>()
    let totalMRR = 0

    hostingServices?.forEach(service => {
      const productKey = `${service.instance_id}:${service.packageid}`
      const product = productNameMap.get(productKey)
      
      const monthlyAmount = service.monthly_amount || toMonthlyAmount(
        Number(service.amount) || 0,
        service.billingcycle || 'monthly'
      )

      totalMRR += monthlyAmount

      const existing = productStats.get(productKey)
      if (existing) {
        existing.services += 1
        existing.mrr += monthlyAmount
      } else {
        productStats.set(productKey, {
          id: product?.id || 0,
          name: product?.name || 'Unknown Product',
          services: 1,
          mrr: monthlyAmount,
        })
      }
    })

    // Sort by MRR and get top N
    const sortedProducts = Array.from(productStats.values())
      .sort((a, b) => b.mrr - a.mrr)
      .slice(0, limit)

    // Calculate percentages
    const topProducts: TopProduct[] = sortedProducts.map(product => ({
      id: product.id,
      name: product.name,
      active_services: product.services,
      mrr: Math.round(product.mrr * 100) / 100,
      percentage: totalMRR > 0 ? Math.round((product.mrr / totalMRR) * 10000) / 100 : 0,
    }))

    return success({
      products: topProducts,
      total_mrr: Math.round(totalMRR * 100) / 100,
    }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/metrics/top-products:', err)
    return error(err instanceof Error ? err : new Error('Failed to get top products'))
  }
}
