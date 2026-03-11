import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'
import { UnauthorizedError } from '@/utils/errors'

export const dynamic = 'force-dynamic'

/**
 * GET /api/clients - Get list of clients with pagination and filters
 * 
 * Query params:
 * - instance_ids: Comma-separated list of WHMCS instance IDs
 * - status: Filter by status (Active, Inactive, Closed, all)
 * - search: Search by whmcs_id
 * - sort: Sort field (whmcs_id, status, datecreated, current_mrr)
 * - order: Sort order (asc, desc)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 100)
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
    const search = searchParams.get('search') || ''
    const sortField = searchParams.get('sort') || 'whmcs_id'
    const sortOrder = searchParams.get('order') || 'asc'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(5000, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))

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

    // Build query
    let query = supabase
      .from('whmcs_clients')
      .select('*', { count: 'exact' })
      .in('instance_id', instanceIds)

    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    // Apply search (by whmcs_id or name)
    if (search) {
      const searchNum = parseInt(search, 10)
      if (!isNaN(searchNum)) {
        query = query.eq('whmcs_id', searchNum)
      } else {
        // Search by name or company
        query = query.or(`firstname.ilike.%${search}%,lastname.ilike.%${search}%,companyname.ilike.%${search}%`)
      }
    }

    // Apply sorting
    const validSortFields = ['whmcs_id', 'status', 'datecreated', 'current_mrr', 'services_count', 'total_paid', 'firstname', 'companyname']
    const field = validSortFields.includes(sortField) ? sortField : 'whmcs_id'
    query = query.order(field, { ascending: sortOrder === 'asc' })

    // Apply pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data: clients, error: queryError, count } = await query

    if (queryError) {
      console.error('Clients query error:', queryError)
      throw new Error(`Failed to fetch clients: ${queryError.message}`)
    }

    // Get primary domains for each client
    const clientIds = clients?.map(c => c.whmcs_id) || []
    let clientDomains: Record<number, string> = {}
    
    if (clientIds.length > 0) {
      // Get first active hosting domain for each client
      const { data: hostingData } = await supabase
        .from('whmcs_hosting')
        .select('client_id, domain')
        .in('instance_id', instanceIds)
        .in('client_id', clientIds)
        .eq('domainstatus', 'Active')
        .order('whmcs_id', { ascending: true })

      // Build map of client_id -> first domain
      hostingData?.forEach(h => {
        if (h.domain && !clientDomains[h.client_id]) {
          clientDomains[h.client_id] = h.domain
        }
      })
    }

    // Enrich clients with primary domain
    const enrichedClients = clients?.map(client => ({
      ...client,
      primary_domain: clientDomains[client.whmcs_id] || null,
    })) || []

    const totalPages = Math.ceil((count || 0) / limit)

    return success({
      clients: enrichedClients,
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
    console.error('Error in /api/clients:', err)
    return error(err instanceof Error ? err : new Error('Failed to get clients'))
  }
}
