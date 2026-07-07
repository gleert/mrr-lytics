import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'
import { parseDateRange, applyHistoryLimit } from '@/utils/date-helpers'
import { getHistoryDaysLimit } from '@/lib/subscription/limits'

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
    const startDateParam = searchParams.get('start_date')
    const endDateParam = searchParams.get('end_date')

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

    const historyLimit = await getHistoryDaysLimit(auth.tenant_id)
    const { startDate, endDate } = applyHistoryLimit(parseDateRange(period, startDateParam, endDateParam), historyLimit)
    const today = new Date()
    const thirtyDaysFromNow = new Date(today)
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
    const todayStr = today.toISOString().split('T')[0]
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0]

    // Run KPI counts directly in DB (accurate regardless of total row count)
    const [
      totalResult,
      activeResult,
      pendingResult,
      expiredResult,
      expiringSoonResult,
    ] = await Promise.all([
      supabase.from('whmcs_domains').select('*', { count: 'exact', head: true })
        .in('instance_id', instanceIds),
      supabase.from('whmcs_domains').select('*', { count: 'exact', head: true })
        .in('instance_id', instanceIds).eq('status', 'Active'),
      supabase.from('whmcs_domains').select('*', { count: 'exact', head: true })
        .in('instance_id', instanceIds).in('status', ['Pending', 'Pending Transfer', 'Pending Registration']),
      supabase.from('whmcs_domains').select('*', { count: 'exact', head: true })
        .in('instance_id', instanceIds).in('status', ['Expired', 'Cancelled']),
      supabase.from('whmcs_domains').select('*', { count: 'exact', head: true })
        .in('instance_id', instanceIds).eq('status', 'Active')
        .gte('expirydate', todayStr).lte('expirydate', thirtyDaysStr),
    ])

    const total_domains  = totalResult.count ?? 0
    const active_domains = activeResult.count ?? 0
    const pending_domains = pendingResult.count ?? 0
    const expired_domains = expiredResult.count ?? 0
    const expiring_soon  = expiringSoonResult.count ?? 0

    // Fetch all domains with pagination (Supabase server caps at 1000 rows per request)
    const allDomains: Array<{
      whmcs_id: number
      client_id: number
      domain: string
      status: string
      registrationdate: string | null
      expirydate: string | null
      nextduedate: string | null
      recurringamount: number | null
      donotrenew: number | boolean | null
    }> = []
    {
      let offset = 0
      while (true) {
        const { data: page, error: pageError } = await supabase
          .from('whmcs_domains')
          .select('whmcs_id, client_id, domain, status, registrationdate, expirydate, nextduedate, recurringamount, donotrenew')
          .in('instance_id', instanceIds)
          .range(offset, offset + 999)
        if (pageError) {
          console.error('Domains query error:', pageError)
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
        if (!page || page.length === 0) break
        allDomains.push(...page)
        if (page.length < 1000) break
        offset += 1000
      }
    }

    // New domains registered in period - use separate query for accuracy.
    // Excludes registrations that are already Cancelled/Expired: a domain
    // registered and then quickly cancelled (test/fraudulent signups, the
    // nov-dec 2025 bot wave) never represented a real acquisition, so it would
    // only inflate the "gained" figure. Mirrors the `gained` series below.
    const { count: newDomainsCount } = await supabase
      .from('whmcs_domains')
      .select('*', { count: 'exact', head: true })
      .in('instance_id', instanceIds)
      .gte('registrationdate', startDate.toISOString().split('T')[0])
      .lte('registrationdate', endDate.toISOString().split('T')[0])
      .not('status', 'in', '("Cancelled","Expired")')

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
      if (d.status === 'Cancelled' || d.status === 'Expired') return false
      const regDate = new Date(d.registrationdate)
      return regDate >= prevStartDate && regDate < prevEndDate
    }).length

    // Calculate change percentage (null when previous period had 0 — no meaningful comparison)
    let new_domains_change: number | null = null
    if (prev_new_domains > 0) {
      new_domains_change = ((new_domains - prev_new_domains) / prev_new_domains) * 100
    }

    // Calculate breakdown by status.
    // Active is a snapshot of the present (no period filter), every other
    // status is restricted to the selected period using expirydate as the
    // "left the base" timestamp — so cancelled/expired counts answer
    // "how many in this period" rather than "all history".
    // Departure date for a non-Active domain: expirydate when set, else
    // nextduedate (the renewal-due proxy). ~50% of Cancelled domains here have a
    // NULL expirydate; without the fallback they'd be invisible in this period
    // breakdown and the lost-by-year chart below. Mirrors the cancelled-hosting
    // nextduedate proxy used elsewhere.
    const departureDate = (d: { expirydate: string | null; nextduedate: string | null }): string | null => {
      if (d.expirydate && d.expirydate > '0001-01-01') return d.expirydate
      if (d.nextduedate && d.nextduedate > '0001-01-01') return d.nextduedate
      return null
    }

    // Statuses that count as a domain leaving the base (churn) in the
    // active-vs-lost chart. "Transferred Away" = moved to another registrar: a
    // genuine departure that the active line already drops (via departureDate)
    // but that previously never appeared in "lost", overstating retention
    // (e.g. 44 transfers-away in 2025 alone at Naranjatec). "Grace" is
    // deliberately excluded: it is recoverable and resolves to Active or Expired,
    // and is only counted once it lands in one of those.
    const isLostStatus = (status: string): boolean =>
      status === 'Expired' || status === 'Cancelled' || status === 'Transferred Away'

    const periodStartStr = startDate.toISOString().split('T')[0]
    const periodEndStr = endDate.toISOString().split('T')[0]
    const statusCounts = new Map<string, number>()
    allDomains.forEach(d => {
      const status = d.status || 'Unknown'
      if (status === 'Active') {
        statusCounts.set(status, (statusCounts.get(status) || 0) + 1)
        return
      }
      const ref = departureDate(d)
      if (!ref) return
      if (ref < periodStartStr || ref > periodEndStr) return
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1)
    })

    const status_breakdown = Array.from(statusCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6) // Limit to 6 statuses

    // Every distinct status present, for the domain list filter dropdown.
    // Unlike status_breakdown this is neither period-restricted nor capped, so
    // the filter always offers every status the tenant actually has
    // (e.g. "Transferred Away", "Grace") instead of a hardcoded set of four.
    const allStatusCounts = new Map<string, number>()
    allDomains.forEach(d => {
      const status = d.status || 'Unknown'
      allStatusCounts.set(status, (allStatusCounts.get(status) || 0) + 1)
    })
    const all_statuses = Array.from(allStatusCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)

    // Calculate breakdown by TLD (top 5 + Others). Only active domains —
    // the chart represents the current TLD mix, not historical.
    const tldCounts = new Map<string, number>()
    allDomains
      .filter(d => d.status === 'Active')
      .forEach(d => {
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
    // active: domains that existed (registered before end of year) and had not left the base before end of year
    // lost: domains that left the base (Expired/Cancelled/Transferred Away, see isLostStatus) whose departure date falls within that year
    const currentYear = new Date().getFullYear()

    const registered_vs_expired = Array.from({ length: 5 }, (_, i) => {
      const year = currentYear - 4 + i
      const endOfYear = new Date(year, 11, 31, 23, 59, 59)
      const startOfYear = new Date(year, 0, 1)

      const active = allDomains.filter(d => {
        if (!d.registrationdate) return false
        const regDate = new Date(d.registrationdate)
        if (regDate > endOfYear) return false // not yet registered
        // For past years: count if expiry (or nextduedate proxy) is after end of year
        if (year < currentYear) {
          const ref = departureDate(d)
          if (!ref) return false
          const expDate = new Date(ref)
          return expDate > endOfYear
        }
        // For current year: count if currently active
        return d.status === 'Active'
      }).length

      const gained = allDomains.filter(d => {
        if (!d.registrationdate) return false
        // Only count registrations that stuck — exclude domains already
        // Cancelled/Expired (quick-cancel / bot-wave signups never acquired).
        if (d.status === 'Cancelled' || d.status === 'Expired') return false
        const regDate = new Date(d.registrationdate)
        return regDate >= startOfYear && regDate <= endOfYear
      }).length

      const lost = allDomains.filter(d => {
        if (!isLostStatus(d.status)) return false
        const ref = departureDate(d)
        if (!ref) return false
        const expDate = new Date(ref)
        if (expDate < startOfYear || expDate > endOfYear) return false
        // Symmetry with `gained`: a domain registered AND gone within the same
        // period was never a sustained domain (quick-cancel / bot-wave signup),
        // so it is neither a real gain nor a real loss. Without this it would
        // show as a one-sided loss spike that the active line never reflects.
        if (d.registrationdate) {
          const regDate = new Date(d.registrationdate)
          if (regDate >= startOfYear && regDate <= endOfYear) return false
        }
        return true
      }).length

      return { year: year.toString(), active, gained, lost }
    })

    // Same series at monthly granularity (last 12 months). Mirrors the yearly
    // logic: past months use the departure-date proxy, the current month uses
    // live status.
    const registered_vs_expired_monthly = Array.from({ length: 12 }, (_, i) => {
      const monthStart = new Date(today.getFullYear(), today.getMonth() - 11 + i, 1)
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59)
      const isCurrentMonth = monthStart.getFullYear() === today.getFullYear()
        && monthStart.getMonth() === today.getMonth()

      const active = allDomains.filter(d => {
        if (!d.registrationdate) return false
        const regDate = new Date(d.registrationdate)
        if (regDate > monthEnd) return false // not yet registered
        if (!isCurrentMonth) {
          const ref = departureDate(d)
          if (!ref) return false
          return new Date(ref) > monthEnd
        }
        return d.status === 'Active'
      }).length

      const gained = allDomains.filter(d => {
        if (!d.registrationdate) return false
        // Only count registrations that stuck — exclude domains already
        // Cancelled/Expired (quick-cancel / bot-wave signups never acquired).
        if (d.status === 'Cancelled' || d.status === 'Expired') return false
        const regDate = new Date(d.registrationdate)
        return regDate >= monthStart && regDate <= monthEnd
      }).length

      const lost = allDomains.filter(d => {
        if (!isLostStatus(d.status)) return false
        const ref = departureDate(d)
        if (!ref) return false
        const expDate = new Date(ref)
        if (expDate < monthStart || expDate > monthEnd) return false
        // Symmetry with `gained`: skip domains registered AND gone within the
        // same month (quick-cancel / bot-wave signups) — never a real loss.
        if (d.registrationdate) {
          const regDate = new Date(d.registrationdate)
          if (regDate >= monthStart && regDate <= monthEnd) return false
        }
        return true
      }).length

      const month = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`
      return { month, active, gained, lost }
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
    const expiringClientsMap: Record<number, string> = {}
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
      new_domains_change: new_domains_change !== null ? Math.round(new_domains_change * 100) / 100 : null,
      total_recurring: Math.round(total_recurring * 100) / 100,
      do_not_renew,
      status_breakdown,
      tld_breakdown,
      all_tlds,
      all_statuses,
      registered_vs_expired,
      registered_vs_expired_monthly,
      expiring_domains,
    }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/domains/stats:', err)
    return error(err instanceof Error ? err : new Error('Failed to get domain stats'))
  }
}
