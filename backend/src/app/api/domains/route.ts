import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'
import { parseDateRange } from '@/utils/date-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/domains - Get list of domains with pagination and filters
 * 
 * Query params:
 * - instance_ids: Comma-separated list of WHMCS instance IDs
 * - status: Filter by status (Active, Pending, Expired, Cancelled, all)
 * - search: Search by domain name
 * - sort: Sort field (domain, status, registrationdate, expirydate, recurringamount)
 * - order: Sort order (asc, desc)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 100)
 * - period: Date range filter
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
    const statusFilter = searchParams.get('status') || 'all'
    const tldFilter = searchParams.get('tld') || 'all'
    const search = searchParams.get('search') || ''
    const sortField = searchParams.get('sort') || 'domain'
    const sortOrder = searchParams.get('order') || 'asc'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(5000, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const period = searchParams.get('period') || '30d'

    // Support multiple instance IDs
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

    // Parse date range for filtering
    const { startDate, endDate } = parseDateRange(period, null, null)

    // Build query
    let query = supabase
      .from('whmcs_domains')
      .select('*', { count: 'exact' })
      .in('instance_id', instanceIds)

    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    // Apply TLD filter
    if (tldFilter && tldFilter !== 'all') {
      // Filter domains ending with the TLD (e.g., ".com", ".es")
      const escapedTld = tldFilter.replace(/[%_\\]/g, '\\$&')
      query = query.ilike('domain', `%${escapedTld}`)
    }

    // Note: Date filter is NOT applied to the list - we show all domains
    // The period filter only affects the stats/KPIs endpoint

    // Apply search (by domain name)
    if (search) {
      const escapedSearch = search.replace(/[%_\\]/g, '\\$&')
      query = query.ilike('domain', `%${escapedSearch}%`)
    }

    // Apply sorting
    const validSortFields = ['domain', 'status', 'registrationdate', 'expirydate', 'nextduedate', 'recurringamount', 'whmcs_id']
    const field = validSortFields.includes(sortField) ? sortField : 'domain'
    query = query.order(field, { ascending: sortOrder === 'asc' })

    // Apply pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data: domains, error: queryError, count } = await query

    if (queryError) {
      console.error('Domains query error:', queryError)
      throw new Error(`Failed to fetch domains: ${queryError.message}`)
    }

    // Get client info for each domain
    const clientIds = [...new Set(domains?.map(d => d.client_id) || [])]
    let clientsMap: Record<number, { firstname: string | null; lastname: string | null; companyname: string | null }> = {}
    
    if (clientIds.length > 0) {
      const { data: clientsData } = await supabase
        .from('whmcs_clients')
        .select('whmcs_id, firstname, lastname, companyname')
        .in('instance_id', instanceIds)
        .in('whmcs_id', clientIds)

      clientsData?.forEach(c => {
        clientsMap[c.whmcs_id] = {
          firstname: c.firstname,
          lastname: c.lastname,
          companyname: c.companyname,
        }
      })
    }

    // Enrich domains with client info
    const enrichedDomains = domains?.map(domain => ({
      ...domain,
      client_name: clientsMap[domain.client_id]?.companyname || 
        [clientsMap[domain.client_id]?.firstname, clientsMap[domain.client_id]?.lastname].filter(Boolean).join(' ') || 
        null,
    })) || []

    const totalPages = Math.ceil((count || 0) / limit)

    return success({
      domains: enrichedDomains,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    }, { instance_ids: instanceIds })
  } catch (err) {
    console.error('Error in /api/domains:', err)
    return error(err instanceof Error ? err : new Error('Failed to get domains'))
  }
}
