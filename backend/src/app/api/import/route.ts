/**
 * Import API Endpoint
 * 
 * Handles importing JSON export files from WHMCS MRRlytics addon.
 * This is used for initial bulk imports or when the HTTP API has issues.
 * 
 * POST /api/import
 * Body: JSON export file from WHMCS addon
 * 
 * Query params:
 * - instance_id: UUID of the WHMCS instance to import data for
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Maximum file size: 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024

// Next.js App Router config for large payloads
export const maxDuration = 300 // 5 minutes timeout for large imports
export const dynamic = 'force-dynamic'

/**
 * Attempt to repair malformed JSON
 * Handles: unescaped quotes, control characters in strings
 */
function repairJson(text: string): string {
  // Remove control characters that break JSON (except \n, \r, \t)
  let repaired = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
  
  // Fix unescaped backslashes (common in Windows paths)
  repaired = repaired.replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
  
  // This is tricky - we need to find unescaped quotes inside string values
  // Simple approach: look for patterns like "field": "value with " inside"
  // and escape the inner quotes
  
  // Match string values and escape unescaped inner quotes
  repaired = repaired.replace(
    /"([^"]*?)(?<!\\)"(?=[^:,\}\]\s])/g,
    (match, content) => `"${content}\\"`
  )
  
  return repaired
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Get instance_id from query params
    const instanceId = request.nextUrl.searchParams.get('instance_id')
    
    if (!instanceId) {
      return NextResponse.json(
        { success: false, error: 'Missing instance_id parameter' },
        { status: 400 }
      )
    }
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(instanceId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid instance_id format' },
        { status: 400 }
      )
    }
    
    // Check content length
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 100MB.' },
        { status: 413 }
      )
    }
    
    // Parse JSON body
    let importData: WhmcsExportFormat
    try {
      // Read body as text first to handle large files better
      let bodyText = await request.text()
      
      if (!bodyText || bodyText.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Empty request body' },
          { status: 400 }
        )
      }
      
      console.log(`[Import] Received body: ${bodyText.length} bytes`)
      
      // Clean malformed JSON from WHMCS addon (removes null entries and consecutive commas)
      // This handles cases like: [1, , , 2] or {}, , , {} or }, , {
      // Run multiple passes to catch nested issues
      for (let i = 0; i < 3; i++) {
        bodyText = bodyText
          .replace(/,(\s*),/g, ',')          // }, , { → }, {
          .replace(/,\s*,+/g, ',')           // ,, or , , , → ,
          .replace(/\[\s*,/g, '[')           // [, → [
          .replace(/,\s*\]/g, ']')           // ,] → ]
          .replace(/\{\s*,/g, '{')           // {, → {
          .replace(/,\s*\}/g, '}')           // ,} → }
          .replace(/null\s*,\s*null/g, 'null') // null, null → null
          .replace(/,\s*null\s*,/g, ',')     // , null, → ,
          .replace(/\[\s*null\s*,/g, '[')    // [null, → [
          .replace(/,\s*null\s*\]/g, ']')    // , null] → ]
      }
      
      try {
        importData = JSON.parse(bodyText)
      } catch (parseError) {
        const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown parse error'
        
        // Try to extract position from error message for better debugging
        const posMatch = errorMsg.match(/position (\d+)/)
        if (posMatch) {
          const pos = parseInt(posMatch[1])
          const start = Math.max(0, pos - 100)
          const end = Math.min(bodyText.length, pos + 100)
          const context = bodyText.substring(start, end)
          console.error('[Import] JSON parse error at position', pos)
          console.error('[Import] Context around error:', context)
          
          // Try to fix common issues: unescaped quotes in strings
          // This is a last resort - escape unescaped quotes within string values
          try {
            // More aggressive fix: try to repair the JSON
            const repairedText = repairJson(bodyText)
            importData = JSON.parse(repairedText)
            console.log('[Import] Successfully repaired JSON')
          } catch (repairError) {
            console.error('[Import] Repair also failed:', repairError)
            return NextResponse.json(
              { success: false, error: `Invalid JSON format: ${errorMsg}. Context: ...${context.substring(0, 50)}...` },
              { status: 400 }
            )
          }
        } else {
          console.error('[Import] JSON parse error:', errorMsg)
          console.error('[Import] First 500 chars:', bodyText.substring(0, 500))
          return NextResponse.json(
            { success: false, error: `Invalid JSON format: ${errorMsg}` },
            { status: 400 }
          )
        }
      }
    } catch (readError) {
      const errorMsg = readError instanceof Error ? readError.message : 'Unknown error'
      console.error('[Import] Body read error:', errorMsg)
      return NextResponse.json(
        { success: false, error: `Failed to read request body: ${errorMsg}` },
        { status: 400 }
      )
    }
    
    // Validate import data structure
    if (!importData.data || typeof importData.data !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid export format: missing data object' },
        { status: 400 }
      )
    }
    
    const supabase = createAdminClient()
    
    // Verify instance exists
    const { data: instance, error: instanceError } = await supabase
      .from('whmcs_instances')
      .select('id, tenant_id, name')
      .eq('id', instanceId)
      .single()
    
    if (instanceError || !instance) {
      return NextResponse.json(
        { success: false, error: 'Instance not found' },
        { status: 404 }
      )
    }
    
    // Create sync log entry
    const { data: syncLog, error: logError } = await supabase
      .from('sync_logs')
      .insert({
        instance_id: instanceId,
        sync_type: 'full',
        triggered_by: 'manual',
        status: 'running',
      })
      .select('id')
      .single()
    
    if (logError || !syncLog) {
      return NextResponse.json(
        { success: false, error: `Failed to create sync log: ${logError?.message}` },
        { status: 500 }
      )
    }
    
    // Convert export format to WhmcsApiResponse format
    const whmcsData = convertExportToApiFormat(importData)
    
    // Sync all tables
    const recordsSynced = await syncAllTables(supabase, instanceId, whmcsData)
    
    // Refresh materialized views
    try {
      await supabase.rpc('refresh_metrics_views')
    } catch (e) {
      console.error('Failed to refresh views:', e)
    }
    
    // Create daily metrics snapshot
    let snapshotId: string | null = null
    try {
      const { data: snapshotResult } = await supabase.rpc('create_daily_snapshot', {
        p_instance_id: instanceId,
      })
      snapshotId = snapshotResult
    } catch (e) {
      console.error('Failed to create snapshot:', e)
    }
    
    const durationMs = Date.now() - startTime
    
    // Update sync log
    await supabase
      .from('sync_logs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        records_synced: recordsSynced,
        duration_ms: durationMs,
      })
      .eq('id', syncLog.id)
    
    // Update instance last_sync_at
    await supabase
      .from('whmcs_instances')
      .update({
        last_sync_at: new Date().toISOString(),
        status: 'active',
      })
      .eq('id', instanceId)
    
    return NextResponse.json({
      success: true,
      message: 'Import completed successfully',
      instance_id: instanceId,
      instance_name: instance.name,
      sync_log_id: syncLog.id,
      records_synced: recordsSynced,
      duration_ms: durationMs,
      snapshot_id: snapshotId,
    })
    
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Export file format from WHMCS addon
 */
interface WhmcsExportFormat {
  meta?: {
    whmcs_version?: string
    php_version?: string
    exported_at?: string
    timezone?: string
  }
  data: {
    hosting?: Array<Record<string, unknown>>
    domains?: Array<Record<string, unknown>>
    products?: Array<Record<string, unknown>>
    product_groups?: Array<Record<string, unknown>>
    billable_items?: Array<Record<string, unknown>>
    invoices?: Array<Record<string, unknown>>
    invoice_items?: Array<Record<string, unknown>>
    clients?: Array<Record<string, unknown>>
    cancellation_requests?: Array<Record<string, unknown>>
  }
  record_counts?: Record<string, number>
  errors?: Record<string, unknown>
  success?: boolean
}

/**
 * Internal data format for import processing
 * Uses 'any' to handle flexible JSON input from exports
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ImportData = any

/**
 * Convert export format to internal format for processing
 */
function convertExportToApiFormat(exportData: WhmcsExportFormat): {
  data: {
    hosting: ImportData[]
    domains: ImportData[]
    products: ImportData[]
    product_groups: ImportData[]
    billable_items: ImportData[]
    invoices: ImportData[]
    invoice_items: ImportData[]
    clients: ImportData[]
    cancellation_requests: ImportData[]
  }
} {
  return {
    data: {
      hosting: (exportData.data.hosting ?? []).map(normalizeRecord),
      domains: (exportData.data.domains ?? []).map(normalizeRecord),
      products: (exportData.data.products ?? []).map(normalizeRecord),
      product_groups: (exportData.data.product_groups ?? []).map(normalizeRecord),
      billable_items: (exportData.data.billable_items ?? []).map(normalizeRecord),
      invoices: (exportData.data.invoices ?? []).map(normalizeRecord),
      invoice_items: (exportData.data.invoice_items ?? []).map(normalizeRecord),
      clients: (exportData.data.clients ?? []).map(normalizeRecord),
      cancellation_requests: (exportData.data.cancellation_requests ?? []).map(normalizeRecord),
    },
  }
}

/**
 * Normalize a record to expected format
 */
function normalizeRecord(record: Record<string, unknown>): Record<string, unknown> {
  // Ensure id exists and is a number
  const normalized: Record<string, unknown> = { ...record }
  
  if (typeof normalized.id === 'string') {
    normalized.id = parseInt(normalized.id, 10)
  }
  
  // Normalize userid/client_id
  if (typeof normalized.userid === 'string') {
    normalized.userid = parseInt(normalized.userid, 10)
  }
  
  return normalized
}

/**
 * Sync all WHMCS tables to Supabase
 * (Duplicated from sync.ts to avoid circular imports)
 */
async function syncAllTables(
  supabase: ReturnType<typeof createAdminClient>,
  instanceId: string,
  data: { data: { [key: string]: ImportData[] } }
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}

  // Sync clients
  if (data.data.clients.length > 0) {
    const { error } = await supabase.from('whmcs_clients').upsert(
      data.data.clients.map((c: Record<string, unknown>) => ({
        instance_id: instanceId,
        whmcs_id: c.id,
        currency: c.currency,
        defaultgateway: c.defaultgateway,
        groupid: c.groupid,
        status: c.status,
        datecreated: c.datecreated,
        lastlogin: c.lastlogin,
        credit: c.credit,
        language: c.language,
        created_at: c.created_at,
        updated_at: c.updated_at,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: 'instance_id,whmcs_id' }
    )
    if (error) console.error('Sync clients error:', error)
    counts.clients = data.data.clients.length
  }

  // Sync products
  if (data.data.products.length > 0) {
    const { error } = await supabase.from('whmcs_products').upsert(
      data.data.products.map((p: Record<string, unknown>) => ({
        instance_id: instanceId,
        whmcs_id: p.id,
        gid: p.gid,
        name: p.name,
        type: p.type,
        paytype: p.paytype,
        hidden: p.hidden,
        retired: p.retired,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: 'instance_id,whmcs_id' }
    )
    if (error) console.error('Sync products error:', error)
    counts.products = data.data.products.length
  }

  // Sync product groups
  if (data.data.product_groups && data.data.product_groups.length > 0) {
    const { error } = await supabase.from('whmcs_product_groups').upsert(
      data.data.product_groups.map((g: Record<string, unknown>) => ({
        instance_id: instanceId,
        whmcs_id: g.id,
        name: g.name,
        slug: g.slug,
        hidden: g.hidden,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: 'instance_id,whmcs_id' }
    )
    if (error) console.error('Sync product_groups error:', error)
    counts.product_groups = data.data.product_groups.length
  }

  // Sync hosting
  if (data.data.hosting.length > 0) {
    const { error } = await supabase.from('whmcs_hosting').upsert(
      data.data.hosting.map((h: Record<string, unknown>) => ({
        instance_id: instanceId,
        whmcs_id: h.id,
        client_id: h.userid,
        packageid: h.packageid,
        domain: h.domain,
        paymentmethod: h.paymentmethod,
        firstpaymentamount: h.firstpaymentamount,
        amount: h.amount,
        billingcycle: h.billingcycle,
        nextduedate: h.nextduedate,
        nextinvoicedate: h.nextinvoicedate,
        domainstatus: h.domainstatus,
        terminationdate: h.terminationdate,
        suspendreason: h.suspendreason,
        regdate: h.regdate,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: 'instance_id,whmcs_id' }
    )
    if (error) console.error('Sync hosting error:', error)
    counts.hosting = data.data.hosting.length
  }

  // Sync domains
  if (data.data.domains.length > 0) {
    const { error } = await supabase.from('whmcs_domains').upsert(
      data.data.domains.map((d: Record<string, unknown>) => ({
        instance_id: instanceId,
        whmcs_id: d.id,
        client_id: d.userid,
        domain: d.domain,
        firstpaymentamount: d.firstpaymentamount,
        recurringamount: d.recurringamount,
        registrationperiod: d.registrationperiod,
        expirydate: d.expirydate,
        nextduedate: d.nextduedate,
        status: d.status,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: 'instance_id,whmcs_id' }
    )
    if (error) console.error('Sync domains error:', error)
    counts.domains = data.data.domains.length
  }

  // Sync invoices
  if (data.data.invoices.length > 0) {
    const { error } = await supabase.from('whmcs_invoices').upsert(
      data.data.invoices.map((i: Record<string, unknown>) => ({
        instance_id: instanceId,
        whmcs_id: i.id,
        client_id: i.userid,
        invoicenum: i.invoicenum,
        date: i.date,
        duedate: i.duedate,
        datepaid: i.datepaid,
        subtotal: i.subtotal,
        credit: i.credit,
        tax: i.tax,
        tax2: i.tax2,
        total: i.total,
        status: i.status,
        paymentmethod: i.paymentmethod,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: 'instance_id,whmcs_id' }
    )
    if (error) console.error('Sync invoices error:', error)
    counts.invoices = data.data.invoices.length
  }

  // Sync invoice items
  if (data.data.invoice_items.length > 0) {
    const { error } = await supabase.from('whmcs_invoice_items').upsert(
      data.data.invoice_items.map((item: Record<string, unknown>) => ({
        instance_id: instanceId,
        whmcs_id: item.id,
        invoice_id: item.invoiceid,
        client_id: item.userid,
        type: item.type,
        relid: item.relid,
        description: item.description,
        amount: item.amount,
        taxed: item.taxed,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: 'instance_id,whmcs_id' }
    )
    if (error) console.error('Sync invoice_items error:', error)
    counts.invoice_items = data.data.invoice_items.length
  }

  // Sync billable items
  if (data.data.billable_items.length > 0) {
    const { error } = await supabase.from('whmcs_billable_items').upsert(
      data.data.billable_items.map((b: Record<string, unknown>) => ({
        instance_id: instanceId,
        whmcs_id: b.id,
        client_id: b.userid,
        description: b.description,
        amount: b.amount,
        recur: b.recur,
        recurcycle: b.recurcycle,
        recurfor: b.recurfor,
        duedate: b.duedate,
        invoicecount: b.invoicecount,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: 'instance_id,whmcs_id' }
    )
    if (error) console.error('Sync billable_items error:', error)
    counts.billable_items = data.data.billable_items.length
  }

  // Sync cancellation requests
  if (data.data.cancellation_requests && data.data.cancellation_requests.length > 0) {
    const { error } = await supabase.from('whmcs_cancellation_requests').upsert(
      data.data.cancellation_requests.map((cr: Record<string, unknown>) => ({
        instance_id: instanceId,
        whmcs_id: cr.id,
        relid: cr.relid,
        reason: cr.reason,
        type: cr.type,
        created_at: cr.created_at,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: 'instance_id,whmcs_id' }
    )
    if (error) console.error('Sync cancellation_requests error:', error)
    counts.cancellation_requests = data.data.cancellation_requests.length
  }

  return counts
}
