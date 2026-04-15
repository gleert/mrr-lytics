import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'
import { parseDateRange } from '@/utils/date-helpers'
import {
  fetchRecurringBillableSet,
  isRecurringItem,
} from '@/lib/metrics/revenue-classification'
import { getRevenueInvoiceStatuses } from '@/lib/tenants/settings'

export const dynamic = 'force-dynamic'

/**
 * GET /api/revenue/trend - Get revenue trend over time (recurring vs one-time)
 * 
 * Returns daily/weekly data points with:
 * - date: Date string
 * - recurring: Recurring revenue
 * - onetime: One-time revenue
 * - total: Total revenue
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
    const period = searchParams.get('period') || '30d'
    const startDateParam = searchParams.get('start_date')
    const endDateParam = searchParams.get('end_date')

    // Support multiple instance IDs (comma-separated) or single instance_id
    let instanceIds: string[] = []
    if (instanceIdsParam) {
      instanceIds = instanceIdsParam.split(',').filter(id => id.trim())
    } else if (instanceIdParam) {
      instanceIds = [instanceIdParam]
    }

    if (instanceIds.length === 0) {
      throw new Error('No instance specified')
    }

    const { startDate, endDate, days } = parseDateRange(period, startDateParam, endDateParam)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const revenueStatuses = await getRevenueInvoiceStatuses(supabase, auth.tenant_id)

    // Get all invoices in period
    const { data: invoices, error: invoicesError } = await supabase
      .from('whmcs_invoices')
      .select('whmcs_id, subtotal, datepaid, date, status')
      .in('instance_id', instanceIds)
      .in('status', revenueStatuses)
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString())
      .order('date', { ascending: true })
      .limit(10000)

    if (invoicesError) {
      console.error('Invoices query error:', invoicesError)
    }

    // Handle case when no data
    if (!invoices || invoices.length === 0) {
      return success({
        trend: [],
        period: {
          type: period,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          days,
        },
      })
    }

    // Load recurring billable item set once for the period
    const recurringBillableSet = await fetchRecurringBillableSet(supabase, instanceIds)

    // Get invoice items for categorization
    const invoiceWhmcsIds = invoices.map(i => i.whmcs_id)

    // Process in batches
    const BATCH_SIZE = 500
    const allItems: {
      invoice_id: number
      type: string | null
      relid: number | null
      instance_id: string
      amount: number
    }[] = []

    for (let i = 0; i < invoiceWhmcsIds.length; i += BATCH_SIZE) {
      const batch = invoiceWhmcsIds.slice(i, i + BATCH_SIZE)
      const { data: batchItems, error: itemsError } = await supabase
        .from('whmcs_invoice_items')
        .select('invoice_id, type, relid, instance_id, amount')
        .in('instance_id', instanceIds)
        .in('invoice_id', batch)

      if (itemsError) {
        console.error('Invoice items query error:', itemsError)
        break
      }

      if (batchItems) {
        allItems.push(...batchItems.map(item => ({
          ...item,
          amount: Number(item.amount) || 0,
        })))
      }
    }

    const invoiceRevenue = new Map<number, { recurring: number; onetime: number }>()

    allItems.forEach(item => {
      const current = invoiceRevenue.get(item.invoice_id) || { recurring: 0, onetime: 0 }
      if (isRecurringItem(item.type, item.relid, item.instance_id, recurringBillableSet)) {
        current.recurring += item.amount
      } else {
        current.onetime += item.amount
      }
      invoiceRevenue.set(item.invoice_id, current)
    })

    // Determine aggregation level based on period
    // For periods > 90 days, aggregate by week; otherwise by day
    const aggregateByWeek = days > 90

    // Build trend data
    const trendMap = new Map<string, { recurring: number; onetime: number; total: number }>()

    invoices.forEach(invoice => {
      const date = new Date(invoice.datepaid || invoice.date)
      let key: string

      if (aggregateByWeek) {
        // Get start of week (Monday)
        const dayOfWeek = date.getDay()
        const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
        const monday = new Date(date.setDate(diff))
        key = monday.toISOString().split('T')[0]
      } else {
        key = date.toISOString().split('T')[0]
      }

      const current = trendMap.get(key) || { recurring: 0, onetime: 0, total: 0 }
      const revenue = invoiceRevenue.get(invoice.whmcs_id) || { recurring: 0, onetime: 0 }
      
      // If no items found, estimate from total
      if (revenue.recurring === 0 && revenue.onetime === 0) {
        const total = Number(invoice.subtotal) || 0
        revenue.recurring = total * 0.8
        revenue.onetime = total * 0.2
      }

      current.recurring += revenue.recurring
      current.onetime += revenue.onetime
      current.total += Number(invoice.subtotal) || 0

      trendMap.set(key, current)
    })

    // Fill in missing dates/weeks with zeros
    const trend: Array<{ date: string; recurring: number; onetime: number; total: number }> = []
    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      let key: string

      if (aggregateByWeek) {
        const dayOfWeek = currentDate.getDay()
        const diff = currentDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
        const monday = new Date(currentDate)
        monday.setDate(diff)
        key = monday.toISOString().split('T')[0]
        
        // Skip if we already have this week
        if (trend.length > 0 && trend[trend.length - 1].date === key) {
          currentDate.setDate(currentDate.getDate() + 1)
          continue
        }
      } else {
        key = currentDate.toISOString().split('T')[0]
      }

      const data = trendMap.get(key) || { recurring: 0, onetime: 0, total: 0 }
      
      trend.push({
        date: key,
        recurring: Math.round(data.recurring * 100) / 100,
        onetime: Math.round(data.onetime * 100) / 100,
        total: Math.round(data.total * 100) / 100,
      })

      if (aggregateByWeek) {
        currentDate.setDate(currentDate.getDate() + 7)
      } else {
        currentDate.setDate(currentDate.getDate() + 1)
      }
    }

    return success({
      trend,
      aggregation: aggregateByWeek ? 'week' : 'day',
      period: {
        type: period,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        days,
      },
    })
  } catch (err) {
    console.error('Error in /api/revenue/trend:', err)
    return error(err instanceof Error ? err : new Error('Failed to get revenue trend'))
  }
}
