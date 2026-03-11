import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'
import { parseDateRange } from '@/utils/date-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/domains/stats - Get domain statistics
 * 
 * Query params:
 * - instance_ids: Comma-separated list of WHMCS instance IDs
 * - period: Date range filter (default: 30d)
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

    let instanceIds: string[] = []
    if (instanceIdsParam) {
      instanceIds = instanceIdsParam.split(',').filter(id => id.trim())
    } else if (instanceIdParam) {
      instanceIds = [instanceIdParam]
    }

    if (instanceIds.length === 0) {
      throw new Error('No instance specified')
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { startDate, endDate } = parseDateRange(period, null, null)
    const today = new Date()
    const thirtyDaysFromNow = new Date(today)
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    // Get all domains for these instances
    // Note: Supabase default limit is 1000, we need to fetch all for accurate stats
    const { data: domains, error: domainsError, count } = await supabase
      .from('whmcs_domains')
      .select('whmcs_id, client_id, domain, status, registrationdate, expirydate, recurringamount, donotrenew', { count: 'exact' })
      .in('instance_id', instanceIds)
      .limit(10000) // Increase limit to get all domains

    if (domainsError) {
      console.error('Domains query error:', domainsError)
      return success({
        total_domains: 0,
        active_domains: 0,
        pending_domains: 0,
        expired_domains: 0,
        expiring_soon: 0,
        new_domains: 0,
        total_recurring: 0,
        do_not_renew: 0,
      }, { instance_ids: instanceIds })
    }

    const allDomains = domains || []
    
    // Calculate stats - use count from query for accuracy
    const total_domains = count ?? allDomains.length
    const active_domains = allDomains.filter(d => d.status === 'Active').length
    const pending_domains = allDomains.filter(d => d.status === 'Pending' || d.status === 'Pending Transfer').length
    const expired_domains = allDomains.filter(d => d.status === 'Expired' || d.status === 'Cancelled').length
    
    // Expiring in next 30 days
    const expiring_soon = allDomains.filter(d => {
      if (!d.expirydate || d.status !== 'Active') return false
      const expiry = new Date(d.expirydate)
      return expiry >= today && expiry <= thirtyDaysFromNow
    }).length

    // New domains registered in period - use separate query for accuracy
    const { count: newDomainsCount } = await supabase
      .from('whmcs_domains')
      .select('*', { count: 'exact', head: true })
      .in('instance_id', instanceIds)
      .gte('registrationdate', startDate.toISOString().split('T')[0])
      .lte('registrationdate', endDate.toISOString().split('T')[0])
    
    const new_domains = newDomainsCount ?? 0

    // Total recurring revenue from active domains
    const total_recurring = allDomains
      .filter(d => d.status === 'Active')
      .reduce((sum, d) => sum + (Number(d.recurringamount) || 0), 0)

    // Domains marked as "do not renew"
    const do_not_renew = allDomains.filter(d => d.donotrenew === 1 || d.donotrenew === true).length

    // Calculate previous period stats for comparison
    const periodMs = endDate.getTime() - startDate.getTime()
    const prevStartDate = new Date(startDate.getTime() - periodMs)
    const prevEndDate = new Date(startDate.getTime())

    const prev_new_domains = allDomains.filter(d => {
      if (!d.registrationdate) return false
      const regDate = new Date(d.registrationdate)
      return regDate >= prevStartDate && regDate < prevEndDate
    }).length

    // Calculate change percentage
    let new_domains_change = 0
    if (prev_new_domains > 0) {
      new_domains_change = ((new_domains - prev_new_domains) / prev_new_domains) * 100
    } else if (new_domains > 0) {
      new_domains_change = 100
    }

    // Calculate breakdown by status
    const statusCounts = new Map<string, number>()
    allDomains.forEach(d => {
      const status = d.status || 'Unknown'
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1)
    })

    const status_breakdown = Array.from(statusCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6) // Limit to 6 statuses

    // Calculate breakdown by TLD (top 5 + Others)
    const tldCounts = new Map<string, number>()
    allDomains.forEach(d => {
      if (!d.domain) return
      const parts = d.domain.split('.')
      const tld = parts.length > 1 ? '.' + parts[parts.length - 1].toLowerCase() : 'Unknown'
      tldCounts.set(tld, (tldCounts.get(tld) || 0) + 1)
    })

    const sortedTlds = Array.from(tldCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    // Take top 5 and group the rest as "Others" for the chart
    let tld_breakdown: Array<{ name: string; value: number }>
    if (sortedTlds.length <= 6) {
      tld_breakdown = sortedTlds
    } else {
      const top5 = sortedTlds.slice(0, 5)
      const othersValue = sortedTlds.slice(5).reduce((sum, item) => sum + item.value, 0)
      tld_breakdown = [...top5, { name: 'Others', value: othersValue }]
    }

    // All TLDs for the filter dropdown (sorted by count)
    const all_tlds = sortedTlds.map(t => t.name)

    // Calculate active vs lost by year (last 5 years)
    // active: domains that existed (registered before end of year) and had not expired/cancelled before end of year
    // lost: domains with status Expired/Cancelled whose expirydate falls within that year
    const currentYear = new Date().getFullYear()

    const registered_vs_expired = Array.from({ length: 5 }, (_, i) => {
      const year = currentYear - 4 + i
      const endOfYear = new Date(year, 11, 31, 23, 59, 59)
      const startOfYear = new Date(year, 0, 1)

      const active = allDomains.filter(d => {
        if (!d.registrationdate) return false
        const regDate = new Date(d.registrationdate)
        if (regDate > endOfYear) return false // not yet registered
        // For past years: count if expiry is after end of year
        if (year < currentYear) {
          if (!d.expirydate) return false
          const expDate = new Date(d.expirydate)
          return expDate > endOfYear
        }
        // For current year: count if currently active
        return d.status === 'Active'
      }).length

      const lost = allDomains.filter(d => {
        if (d.status !== 'Expired' && d.status !== 'Cancelled') return false
        if (!d.expirydate) return false
        const expDate = new Date(d.expirydate)
        return expDate >= startOfYear && expDate <= endOfYear
      }).length

      return { year: year.toString(), active, lost }
    })

    // Get domains expiring soon (next 30 days) - for the alert section
    const expiringRaw = allDomains
      .filter(d => {
        if (!d.expirydate || d.status !== 'Active') return false
        const expiry = new Date(d.expirydate)
        return expiry >= today && expiry <= thirtyDaysFromNow
      })
      .map(d => ({
        domain: d.domain,
        expirydate: d.expirydate,
        days_left: Math.ceil((new Date(d.expirydate!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
        recurringamount: Number(d.recurringamount) || 0,
        client_id: d.client_id,
      }))
      .sort((a, b) => a.days_left - b.days_left)
      .slice(0, 20) // Keep top 20 for table display

    // Enrich expiring domains with client names
    const expiringClientIds = [...new Set(expiringRaw.map(d => d.client_id).filter(Boolean))]
    let expiringClientsMap: Record<number, string> = {}
    if (expiringClientIds.length > 0) {
      const { data: expiringClients } = await supabase
        .from('whmcs_clients')
        .select('whmcs_id, firstname, lastname, companyname')
        .in('instance_id', instanceIds)
        .in('whmcs_id', expiringClientIds)
      expiringClients?.forEach(c => {
        expiringClientsMap[c.whmcs_id] = c.companyname || [c.firstname, c.lastname].filter(Boolean).join(' ') || ''
      })
    }

    const expiring_domains = expiringRaw.map(d => ({
      domain: d.domain,
      expirydate: d.expirydate,
      days_left: d.days_left,
      recurringamount: d.recurringamount,
      client_name: expiringClientsMap[d.client_id] || null,
    }))

    return success({
      total_domains,
      active_domains,
      pending_domains,
      expired_domains,
      expiring_soon,
      new_domains,
      new_domains_change: Math.round(new_domains_change * 100) / 100,
      total_recurring: Math.round(total_recurring * 100) / 100,
      do_not_renew,
      status_breakdown,
      tld_breakdown,
      all_tlds,
      registered_vs_expired,
      expiring_domains,
    }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/domains/stats:', err)
    return error(err instanceof Error ? err : new Error('Failed to get domain stats'))
  }
}
