import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { success, error } from '@/utils/api-response'
import { parseDateRange } from '@/utils/date-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/billable-items - Get recurring billable items for user's instances
 *
 * Query params:
 * - instance_ids: Comma-separated list of instance IDs
 * - period: Preset period (30d, 90d, etc.) — filters by duedate in range
 * - start_date / end_date: Custom date range
 */
export async function GET(request: Request) {
  try {
    const headersList = await headers()
    const authType = headersList.get('x-auth-type')
    const authId = headersList.get('x-auth-id')

    if (authType !== 'jwt' || !authId) {
      return error(new Error('This endpoint requires user authentication'), 401)
    }

    const { searchParams } = new URL(request.url)
    const instanceIdsParam = searchParams.get('instance_ids')
    const period = searchParams.get('period') || '30d'
    const startDateParam = searchParams.get('start_date')
    const endDateParam = searchParams.get('end_date')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get user's tenants
    const { data: userTenants, error: tenantsError } = await supabase
      .from('user_tenants')
      .select('tenant_id')
      .eq('user_id', authId)

    if (tenantsError) {
      return error(new Error('Failed to fetch tenants'), 500)
    }

    const tenantIds = userTenants?.map(ut => ut.tenant_id) || []
    if (tenantIds.length === 0) {
      return success({ items: [], total_mrr: 0 })
    }

    // Get user's instances
    const { data: instances, error: instancesError } = await supabase
      .from('whmcs_instances')
      .select('id, name, color')
      .in('tenant_id', tenantIds)

    if (instancesError) {
      return error(new Error('Failed to fetch instances'), 500)
    }

    let instanceIds = instances?.map(i => i.id) || []

    if (instanceIdsParam) {
      const requested = instanceIdsParam.split(',').filter(id => id.trim())
      instanceIds = instanceIds.filter(id => requested.includes(id))
    }

    if (instanceIds.length === 0) {
      return success({ items: [], total_mrr: 0 })
    }

    const { startDate, endDate } = parseDateRange(period, startDateParam, endDateParam)
    const startStr = startDate.toISOString().split('T')[0]
    const endStr = endDate.toISOString().split('T')[0]

    // Fetch ALL billable items (recurring and one-time) — status computed in JS
    const { data: billableItems, error: itemsError } = await supabase
      .from('whmcs_billable_items')
      .select('id, instance_id, whmcs_id, client_id, description, amount, recur, recurcycle, recurfor, invoice_action, invoicecount, duedate, synced_at')
      .in('instance_id', instanceIds)
      .order('description')
      .limit(10000)

    if (itemsError) {
      return error(new Error('Failed to fetch billable items'), 500)
    }

    const allItems = billableItems || []

    // Fetch client names for all unique client_ids
    const clientIds = [...new Set(allItems.map(i => i.client_id).filter(Boolean))]
    const clientNameMap = new Map<string, string>()

    if (clientIds.length > 0) {
      const { data: clients } = await supabase
        .from('whmcs_clients')
        .select('whmcs_id, instance_id, firstname, lastname, companyname')
        .in('instance_id', instanceIds)
        .in('whmcs_id', clientIds)
        .limit(10000)

      clients?.forEach(c => {
        const key = `${c.instance_id}:${c.whmcs_id}`
        clientNameMap.set(key, c.companyname || `${c.firstname || ''} ${c.lastname || ''}`.trim() || 'Unknown')
      })
    }

    // Fetch category mappings for billable_item type
    const { data: mappings } = await supabase
      .from('category_mappings')
      .select(`
        id,
        instance_id,
        whmcs_id,
        categories (
          id,
          name,
          color
        )
      `)
      .in('instance_id', instanceIds)
      .eq('mapping_type', 'billable_item')

    type MappingRow = { id: string; instance_id: string; whmcs_id: number; categories: { id: string; name: string; color: string } | null }
    const mappingMap = new Map<string, MappingRow>()
    ;(mappings as MappingRow[] | null)?.forEach(m => {
      mappingMap.set(`${m.instance_id}:${m.whmcs_id}`, m)
    })

    // Instance lookup
    const instanceMap = new Map(instances?.map(i => [i.id, i]) || [])

    // Normalize billing cycle to monthly MRR
    const toMonthlyAmount = (amount: number, cycle: string): number => {
      switch ((cycle || 'monthly').toLowerCase()) {
        case 'monthly':
        case 'months':
        case 'month': return amount
        case 'quarterly': return amount / 3
        case 'semi-annually':
        case 'semiannually': return amount / 6
        case 'annually':
        case 'yearly':
        case 'years':
        case 'year': return amount / 12
        case 'biennially': return amount / 24
        case 'triennially': return amount / 36
        default: return 0
      }
    }

    let totalMrr = 0

    const enhancedItems = allItems.map(item => {
      const instance = instanceMap.get(item.instance_id)
      const mapping = mappingMap.get(`${item.instance_id}:${item.whmcs_id}`)
      const clientName = item.client_id
        ? clientNameMap.get(`${item.instance_id}:${item.client_id}`) || null
        : null

      // Compute status.
      // invoice_action = 4 → Recurring in WHMCS. recur is the interval (not a flag).
      const isRecurring = (item.invoice_action ?? 0) === 4
      const recurfor = item.recurfor ?? 0
      const invoicecount = item.invoicecount ?? 0
      let status: 'active' | 'completed' | 'one_time'
      if (isRecurring && (recurfor === 0 || invoicecount < recurfor)) {
        status = 'active'
      } else if (isRecurring) {
        status = 'completed'
      } else {
        status = 'one_time'
      }

      const monthlyMrr = status === 'active'
        ? toMonthlyAmount(Number(item.amount) || 0, item.recurcycle || 'monthly')
        : 0

      totalMrr += monthlyMrr

      const inPeriod = !!item.duedate && item.duedate >= startStr && item.duedate <= endStr

      return {
        id: item.id,
        instance_id: item.instance_id,
        whmcs_id: item.whmcs_id,
        client_id: item.client_id,
        client_name: clientName,
        description: item.description,
        amount: Number(item.amount) || 0,
        recurcycle: item.recurcycle || null,
        recurfor,
        invoicecount,
        duedate: item.duedate,
        monthly_mrr: Math.round(monthlyMrr * 100) / 100,
        status,
        instance_name: instance?.name || '',
        instance_color: instance?.color || '#7C3AED',
        category: mapping?.categories || null,
        category_mapping_id: mapping?.id || null,
        in_period: inPeriod,
      }
    })

    return success({
      items: enhancedItems,
      total_mrr: Math.round(totalMrr * 100) / 100,
    })
  } catch (err) {
    console.error('Error in GET /api/billable-items:', err)
    return error(err instanceof Error ? err : new Error('Failed to get billable items'))
  }
}
