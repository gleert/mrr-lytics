import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

interface PendingCancellation {
  id: number
  client_name: string
  client_id: number
  item_name: string
  mrr_loss: number
  churn_date: string
  days_until_churn: number
}

/**
 * GET /api/metrics/pending-cancellations - Get services scheduled for termination
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
    const limitParam = searchParams.get('limit') || '10'

    let instanceIds: string[] = []
    if (instanceIdsParam) {
      instanceIds = instanceIdsParam.split(',').filter(id => id.trim())
    } else if (instanceIdParam) {
      instanceIds = [instanceIdParam]
    }

    if (instanceIds.length === 0) {
      throw new Error('No instance specified')
    }

    const limit = Math.min(Math.max(parseInt(limitParam, 10) || 10, 1), 50)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get services with cancellation requested (domainstatus = 'Active' and has terminationdate set)
    // In WHMCS, services pending cancellation typically have:
    // - domainstatus = 'Active' but with a termination date set
    // Note: terminationdate is a DATE column in PostgreSQL, so '0000-00-00' would be NULL after sanitization
    let query = supabase
      .from('whmcs_hosting')
      .select('id, instance_id, client_id, packageid, domain, amount, billingcycle, monthly_amount, domainstatus, nextduedate, terminationdate')
      .in('instance_id', instanceIds)
      .eq('domainstatus', 'Active')
      .not('terminationdate', 'is', null)
      .order('terminationdate', { ascending: true })
      .limit(limit)

    const { data: pendingServices, error: servicesError } = await query

    if (servicesError) {
      // Log detailed error for debugging
      console.error('Services query error:', {
        code: servicesError.code,
        message: servicesError.message,
        details: servicesError.details,
        hint: servicesError.hint,
        instanceIds,
      })
      // Return empty result instead of throwing for non-critical errors
      // This could happen if table doesn't exist or has schema issues
      return success({
        cancellations: [],
        total_mrr_loss: 0,
        count: 0,
      }, { instance_ids: instanceIds })
    }

    // If no pending services, return empty result early
    if (!pendingServices || pendingServices.length === 0) {
      return success({
        cancellations: [],
        total_mrr_loss: 0,
        count: 0,
      }, { instance_ids: instanceIds })
    }

    // Get client names
    const clientIds = [...new Set(pendingServices.map(s => s.client_id))]
    const { data: clients, error: clientsError } = await supabase
      .from('whmcs_clients')
      .select('whmcs_id, instance_id, firstname, lastname, companyname')
      .in('instance_id', instanceIds)
      .in('whmcs_id', clientIds)

    if (clientsError) {
      console.error('Clients query error:', clientsError)
    }

    // Get product names
    const packageIds = [...new Set(pendingServices.map(s => s.packageid))]
    const { data: products, error: productsError } = await supabase
      .from('whmcs_products')
      .select('whmcs_id, instance_id, name')
      .in('instance_id', instanceIds)
      .in('whmcs_id', packageIds)

    if (productsError) {
      console.error('Products query error:', productsError)
    }

    // Build lookup maps
    const clientMap = new Map<string, string>()
    clients?.forEach(client => {
      const key = `${client.instance_id}:${client.whmcs_id}`
      const name = client.companyname || `${client.firstname || ''} ${client.lastname || ''}`.trim() || 'Unknown'
      clientMap.set(key, name)
    })

    const productMap = new Map<string, string>()
    products?.forEach(product => {
      const key = `${product.instance_id}:${product.whmcs_id}`
      productMap.set(key, product.name || 'Unknown Product')
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

    // Build response
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let totalMrrLoss = 0
    const cancellations: PendingCancellation[] = pendingServices
      .filter(service => {
        // Filter out past termination dates
        const termDate = new Date(service.terminationdate)
        return termDate >= today
      })
      .map(service => {
        const clientKey = `${service.instance_id}:${service.client_id}`
        const productKey = `${service.instance_id}:${service.packageid}`
        
        const monthlyAmount = service.monthly_amount || toMonthlyAmount(
          Number(service.amount) || 0,
          service.billingcycle || 'monthly'
        )

        totalMrrLoss += monthlyAmount

        const termDate = new Date(service.terminationdate)
        const daysUntil = Math.ceil((termDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        // Build item name: product name + domain if exists
        const productName = productMap.get(productKey) || 'Unknown Product'
        const itemName = service.domain ? `${productName} - ${service.domain}` : productName

        return {
          id: service.id,
          client_name: clientMap.get(clientKey) || 'Unknown Client',
          client_id: service.client_id,
          item_name: itemName,
          mrr_loss: Math.round(monthlyAmount * 100) / 100,
          churn_date: service.terminationdate,
          days_until_churn: daysUntil,
        }
      })

    return success({
      cancellations,
      total_mrr_loss: Math.round(totalMrrLoss * 100) / 100,
      count: cancellations.length,
    }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/metrics/pending-cancellations:', err)
    return error(err instanceof Error ? err : new Error('Failed to get pending cancellations'))
  }
}
