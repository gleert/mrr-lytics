/**
 * WHMCS Data Synchronization
 * 
 * This module handles syncing data from WHMCS installations to Supabase.
 * Each WHMCS instance belongs to a tenant and syncs independently.
 * 
 * After a successful sync:
 * 1. Data is upserted into WHMCS mirror tables
 * 2. Materialized views are refreshed
 * 3. A daily metrics snapshot is created (if MRR is higher than existing)
 * 
 * @module lib/whmcs/sync
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createWhmcsClient } from './client'
import {
  dispatchSyncCompleted,
  dispatchSyncFailed,
  dispatchClientNew,
  dispatchClientChurned,
  dispatchSubscriptionCancelled,
} from '@/lib/webhooks'
import {
  dispatchEmailSyncCompleted,
  dispatchEmailSyncFailed,
  dispatchEmailClientNew,
  dispatchEmailClientChurned,
  dispatchEmailSubscriptionCancelled,
} from '@/lib/email'
import {
  dispatchSlackSyncCompleted,
  dispatchSlackSyncFailed,
  dispatchSlackClientNew,
  dispatchSlackClientChurned,
  dispatchSlackSubscriptionCancelled,
} from '@/lib/slack'
import type { WhmcsApiResponse } from './types'

/**
 * Sanitize a date string from WHMCS
 * Handles invalid dates like "0000-00-00" which PostgreSQL doesn't accept
 */
function sanitizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr || dateStr === '0000-00-00' || dateStr.startsWith('0000-')) {
    return null
  }
  return dateStr
}

/**
 * Sanitize a timestamp string from WHMCS
 * Handles invalid timestamps like "0000-00-00 00:00:00"
 */
function sanitizeTimestamp(timestampStr: string | null | undefined): string | null {
  if (!timestampStr || timestampStr.startsWith('0000-00-00')) {
    return null
  }
  return timestampStr
}

/**
 * WHMCS Instance data needed for sync
 */
export interface WhmcsInstance {
  id: string
  tenant_id: string
  name: string
  whmcs_url: string
  whmcs_api_identifier: string | null
  whmcs_api_secret: string | null
  status: 'active' | 'inactive' | 'error'
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  /** Whether the sync completed successfully */
  success: boolean
  /** UUID of the sync log entry */
  sync_log_id: string
  /** Count of records synced per table */
  records_synced: Record<string, number>
  /** Total duration in milliseconds */
  duration_ms: number
  /** UUID of the created/updated snapshot (if any) */
  snapshot_id?: string | null
  /** UUID of the metrics_daily entry (if any) */
  metrics_id?: string | null
  /** Error message if sync failed */
  error?: string
}

/**
 * Sync data from WHMCS to Supabase for a specific instance
 * 
 * This function:
 * 1. Creates a sync log entry with status 'running'
 * 2. Fetches data from WHMCS using the MRRlytics addon API
 * 3. Upserts data into Supabase tables
 * 4. Refreshes materialized views for metrics
 * 5. Creates/updates daily metrics snapshot
 * 6. Updates sync log with results
 * 
 * @param instance - WHMCS instance configuration
 * @param options - Sync options (type, triggered_by)
 * @returns SyncResult with success status and statistics
 */
export async function syncInstance(
  instance: WhmcsInstance,
  options: {
    type?: 'full' | 'incremental'
    triggered_by?: 'manual' | 'cron' | 'webhook'
  } = {}
): Promise<SyncResult> {
  const { type = 'full', triggered_by = 'manual' } = options
  const startTime = Date.now()
  const supabase = createAdminClient()

  // Validate instance has API credentials
  if (!instance.whmcs_api_secret) {
    return {
      success: false,
      sync_log_id: '',
      records_synced: {},
      duration_ms: 0,
      error: 'API credentials not configured for this instance',
    }
  }

  // Create sync log entry
  const { data: syncLog, error: logError } = await supabase
    .from('sync_logs')
    .insert({
      instance_id: instance.id,
      sync_type: type,
      triggered_by,
      status: 'running',
    })
    .select('id')
    .single()

  if (logError || !syncLog) {
    throw new Error(`Failed to create sync log: ${logError?.message}`)
  }

  try {
    // Get last successful sync time for incremental sync
    let since: string | undefined
    if (type === 'incremental') {
      const { data: lastSync } = await supabase
        .from('sync_logs')
        .select('completed_at')
        .eq('instance_id', instance.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single()

      since = lastSync?.completed_at || undefined
    }

    // Fetch data from WHMCS
    const whmcsClient = createWhmcsClient(instance.whmcs_url, instance.whmcs_api_secret)
    const whmcsData = await whmcsClient.fetchAll({ since })

    // Sync each table
    const recordsSynced = await syncAllTables(supabase, instance, whmcsData)

    // Check if any records were actually synced
    const totalRecords = Object.values(recordsSynced).reduce((sum: number, count) => sum + (count as number), 0)

    let metricsId: string | null = null
    let snapshotId: string | null = null

    if (totalRecords > 0 || type === 'full') {
      // Update all client metrics (MRR, services count, etc.)
      try {
        await supabase.rpc('update_all_client_metrics', {
          p_instance_id: instance.id,
        })
        console.log(`[Sync] Updated client metrics for instance ${instance.id}`)
      } catch (clientMetricsError) {
        console.error('Failed to update client metrics:', clientMetricsError)
      }

      // Populate metrics_daily (this also refreshes materialized views)
      try {
        const { data: metricsResult } = await supabase.rpc('populate_metrics_daily', {
          p_instance_id: instance.id,
        })
        metricsId = metricsResult
        console.log(`[Sync] Populated metrics_daily for instance ${instance.id}`)
      } catch (metricsError) {
        console.error('Failed to populate metrics_daily:', metricsError)
        // Fallback: just refresh views
        try {
          await supabase.rpc('refresh_metrics_views')
        } catch (refreshError) {
          console.error('Failed to refresh views:', refreshError)
        }
      }

      // Create daily metrics snapshot (legacy, for backwards compatibility)
      try {
        const { data: snapshotResult } = await supabase.rpc('create_daily_snapshot', {
          p_instance_id: instance.id,
        })
        snapshotId = snapshotResult
      } catch (snapshotError) {
        // Log but don't fail the sync if snapshot creation fails
        console.error('Failed to create snapshot after sync:', snapshotError)
      }
    } else {
      console.log(`[Sync] No records changed for instance ${instance.id}, skipping metrics refresh`)
    }

    const duration_ms = Date.now() - startTime

    // Update sync log
    await supabase
      .from('sync_logs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        records_synced: recordsSynced,
        duration_ms,
      })
      .eq('id', syncLog.id)

    // Update instance last_sync_at
    await supabase
      .from('whmcs_instances')
      .update({
        last_sync_at: new Date().toISOString(),
        status: 'active',
      })
      .eq('id', instance.id)

    // Dispatch sync.completed events (webhook + email), fire-and-forget
    const syncCompletedPayload = {
      instance_id: instance.id,
      instance_name: instance.name,
      records_synced: recordsSynced,
      duration_ms,
      snapshot_id: snapshotId,
    }
    dispatchSyncCompleted(instance.tenant_id, syncCompletedPayload)
      .catch((e) => console.error('Failed to dispatch sync.completed webhook:', e))
    dispatchEmailSyncCompleted(instance.tenant_id, syncCompletedPayload)
      .catch((e) => console.error('Failed to dispatch sync.completed email:', e))
    dispatchSlackSyncCompleted(instance.tenant_id, syncCompletedPayload)
      .catch((e) => console.error('Failed to dispatch sync.completed slack:', e))

    return {
      success: true,
      sync_log_id: syncLog.id,
      records_synced: recordsSynced,
      duration_ms,
      snapshot_id: snapshotId,
      metrics_id: metricsId,
    }
  } catch (err) {
    const duration_ms = Date.now() - startTime
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'

    // Update sync log with error
    await supabase
      .from('sync_logs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
        duration_ms,
      })
      .eq('id', syncLog.id)

    // Update instance status to error
    await supabase
      .from('whmcs_instances')
      .update({ status: 'error' })
      .eq('id', instance.id)

    // Dispatch sync.failed events (webhook + email), fire-and-forget
    const syncFailedPayload = {
      instance_id: instance.id,
      instance_name: instance.name,
      error: errorMessage,
    }
    dispatchSyncFailed(instance.tenant_id, syncFailedPayload)
      .catch((e) => console.error('Failed to dispatch sync.failed webhook:', e))
    dispatchEmailSyncFailed(instance.tenant_id, syncFailedPayload)
      .catch((e) => console.error('Failed to dispatch sync.failed email:', e))
    dispatchSlackSyncFailed(instance.tenant_id, syncFailedPayload)
      .catch((e) => console.error('Failed to dispatch sync.failed slack:', e))

    return {
      success: false,
      sync_log_id: syncLog.id,
      records_synced: {},
      duration_ms,
      error: errorMessage,
    }
  }
}

/**
 * Sync all active instances for a tenant
 */
export async function syncTenantInstances(
  tenantId: string,
  options: {
    type?: 'full' | 'incremental'
    triggered_by?: 'manual' | 'cron' | 'webhook'
  } = {}
): Promise<{ results: SyncResult[]; total: number; succeeded: number; failed: number }> {
  const supabase = createAdminClient()

  // Get all active instances for this tenant
  const { data: instances, error: instancesError } = await supabase
    .from('whmcs_instances')
    .select('id, tenant_id, name, whmcs_url, whmcs_api_identifier, whmcs_api_secret, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')

  if (instancesError) {
    throw new Error(`Failed to fetch instances: ${instancesError.message}`)
  }

  if (!instances || instances.length === 0) {
    return { results: [], total: 0, succeeded: 0, failed: 0 }
  }

  // Sync each instance
  const results = await Promise.allSettled(
    instances.map((instance) => syncInstance(instance as WhmcsInstance, options))
  )

  const syncResults: SyncResult[] = results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    }
    return {
      success: false,
      sync_log_id: '',
      records_synced: {},
      duration_ms: 0,
      error: result.reason?.message || 'Unknown error',
    }
  })

  return {
    results: syncResults,
    total: syncResults.length,
    succeeded: syncResults.filter((r) => r.success).length,
    failed: syncResults.filter((r) => !r.success).length,
  }
}

const CHURNED_STATUSES = ['Inactive', 'Closed']

/**
 * Sync all WHMCS tables to Supabase for an instance
 */
async function syncAllTables(
  supabase: ReturnType<typeof createAdminClient>,
  instance: WhmcsInstance,
  data: WhmcsApiResponse
): Promise<Record<string, number>> {
  const instanceId = instance.id
  const counts: Record<string, number> = {}

  // ─── Clients ──────────────────────────────────────────────────────────────

  if (data.data.clients.length > 0) {
    // Read existing client statuses BEFORE upsert (needed for churn detection)
    const { data: existingClients } = await supabase
      .from('whmcs_clients')
      .select('whmcs_id, status')
      .eq('instance_id', instanceId)

    const existingClientMap = new Map(
      (existingClients ?? []).map((c) => [c.whmcs_id as number, c.status as string])
    )

    const { error } = await supabase.from('whmcs_clients').upsert(
      data.data.clients.map((c) => ({
        instance_id: instanceId,
        whmcs_id: c.id,
        firstname: c.firstname || null,
        lastname: c.lastname || null,
        companyname: c.companyname || null,
        email: c.email || null,
        currency: c.currency,
        defaultgateway: c.defaultgateway,
        groupid: c.groupid,
        status: c.status,
        datecreated: sanitizeDate(c.datecreated),
        lastlogin: sanitizeTimestamp(c.lastlogin),
        credit: c.credit,
        language: c.language,
        created_at: sanitizeTimestamp(c.created_at),
        updated_at: sanitizeTimestamp(c.updated_at),
        synced_at: new Date().toISOString(),
      })),
      { onConflict: 'instance_id,whmcs_id' }
    )
    if (error) console.error('Sync clients error:', error)
    counts.clients = data.data.clients.length

    // Dispatch client.new and client.churned events (fire-and-forget per client)
    for (const c of data.data.clients) {
      const prevStatus = existingClientMap.get(c.id)
      const payload = {
        client_id: c.id,
        email: c.email || '',
        first_name: c.firstname || '',
        last_name: c.lastname || '',
        company_name: c.companyname || null,
        instance_id: instanceId,
        instance_name: instance.name,
      }

      if (prevStatus === undefined) {
        // Brand new client — not in DB before this sync
        const newClientPayload = {
          ...payload,
          date_created: c.datecreated || new Date().toISOString(),
        }
        dispatchClientNew(instance.tenant_id, newClientPayload)
          .catch((e) => console.error('dispatchClientNew error:', e))
        dispatchEmailClientNew(instance.tenant_id, newClientPayload)
          .catch((e) => console.error('dispatchEmailClientNew error:', e))
        dispatchSlackClientNew(instance.tenant_id, newClientPayload)
          .catch((e) => console.error('dispatchSlackClientNew error:', e))
      } else if (
        c.status && CHURNED_STATUSES.includes(c.status) &&
        !CHURNED_STATUSES.includes(prevStatus)
      ) {
        // Client just transitioned to a churned status
        const churnPayload = {
          ...payload,
          status: c.status,
          previous_status: prevStatus,
        }
        dispatchClientChurned(instance.tenant_id, churnPayload)
          .catch((e) => console.error('dispatchClientChurned error:', e))
        dispatchEmailClientChurned(instance.tenant_id, churnPayload)
          .catch((e) => console.error('dispatchEmailClientChurned error:', e))
        dispatchSlackClientChurned(instance.tenant_id, churnPayload)
          .catch((e) => console.error('dispatchSlackClientChurned error:', e))
      }
    }
  }

  // Sync products
  if (data.data.products.length > 0) {
    const { error } = await supabase.from('whmcs_products').upsert(
      data.data.products.map((p) => ({
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
      data.data.product_groups.map((g) => ({
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

  // ─── Hosting ──────────────────────────────────────────────────────────────

  if (data.data.hosting.length > 0) {
    // Read existing hosting statuses BEFORE upsert (needed for cancellation detection)
    const { data: existingHosting } = await supabase
      .from('whmcs_hosting')
      .select('whmcs_id, domainstatus')
      .eq('instance_id', instanceId)

    const existingHostingMap = new Map(
      (existingHosting ?? []).map((h) => [h.whmcs_id as number, h.domainstatus as string])
    )

    // Build in-memory lookup maps from already-fetched data
    const clientEmailMap = new Map(
      data.data.clients.map((c) => [c.id, c.email || ''])
    )
    const productNameMap = new Map(
      data.data.products.map((p) => [p.id, p.name || ''])
    )

    const { error } = await supabase.from('whmcs_hosting').upsert(
      data.data.hosting.map((h) => ({
        instance_id: instanceId,
        whmcs_id: h.id,
        client_id: h.userid,
        packageid: h.packageid,
        domain: h.domain,
        paymentmethod: h.paymentmethod,
        firstpaymentamount: h.firstpaymentamount,
        amount: h.amount,
        billingcycle: h.billingcycle,
        nextduedate: sanitizeDate(h.nextduedate),
        nextinvoicedate: sanitizeDate(h.nextinvoicedate),
        domainstatus: h.domainstatus,
        terminationdate: sanitizeDate(h.terminationdate),
        suspendreason: h.suspendreason,
        regdate: sanitizeDate(h.regdate),
        synced_at: new Date().toISOString(),
      })),
      { onConflict: 'instance_id,whmcs_id' }
    )
    if (error) console.error('Sync hosting error:', error)
    counts.hosting = data.data.hosting.length

    // Dispatch subscription.cancelled for newly-cancelled services
    for (const h of data.data.hosting) {
      const prevStatus = existingHostingMap.get(h.id)
      if (
        h.domainstatus === 'Cancelled' &&
        prevStatus !== undefined &&
        prevStatus !== 'Cancelled'
      ) {
        const cancelPayload = {
          service_id: h.id,
          client_id: h.userid,
          client_email: clientEmailMap.get(h.userid) || '',
          product_name: productNameMap.get(h.packageid ?? 0) || '',
          domain: h.domain || null,
          amount: Number(h.amount) || 0,
          billing_cycle: h.billingcycle || '',
          cancellation_date: sanitizeDate(h.terminationdate) || new Date().toISOString(),
          instance_id: instanceId,
          instance_name: instance.name,
        }
        dispatchSubscriptionCancelled(instance.tenant_id, cancelPayload)
          .catch((e) => console.error('dispatchSubscriptionCancelled error:', e))
        dispatchEmailSubscriptionCancelled(instance.tenant_id, cancelPayload)
          .catch((e) => console.error('dispatchEmailSubscriptionCancelled error:', e))
        dispatchSlackSubscriptionCancelled(instance.tenant_id, cancelPayload)
          .catch((e) => console.error('dispatchSlackSubscriptionCancelled error:', e))
      }
    }
  }

  // Sync domains
  if (data.data.domains.length > 0) {
    const { error } = await supabase.from('whmcs_domains').upsert(
      data.data.domains.map((d) => ({
        instance_id: instanceId,
        whmcs_id: d.id,
        client_id: d.userid,
        orderid: d.orderid,
        type: d.type,
        registrationdate: sanitizeDate(d.registrationdate),
        domain: d.domain,
        firstpaymentamount: d.firstpaymentamount,
        recurringamount: d.recurringamount,
        registrationperiod: d.registrationperiod,
        expirydate: sanitizeDate(d.expirydate),
        nextduedate: sanitizeDate(d.nextduedate),
        nextinvoicedate: sanitizeDate(d.nextinvoicedate),
        paymentmethod: d.paymentmethod,
        status: d.status,
        dnsmanagement: d.dnsmanagement === 1,
        emailforwarding: d.emailforwarding === 1,
        idprotection: d.idprotection === 1,
        donotrenew: d.donotrenew === 1,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: 'instance_id,whmcs_id' }
    )
    if (error) console.error('Sync domains error:', error)
    counts.domains = data.data.domains.length
  }

  // Sync invoices (batch to avoid payload size limits)
  if (data.data.invoices.length > 0) {
    const BATCH_SIZE = 500
    const items = data.data.invoices.map((i) => ({
      instance_id: instanceId,
      whmcs_id: i.id,
      client_id: i.userid,
      invoicenum: i.invoicenum,
      date: sanitizeDate(i.date),
      duedate: sanitizeDate(i.duedate),
      datepaid: sanitizeDate(i.datepaid),
      subtotal: i.subtotal,
      credit: i.credit,
      tax: i.tax,
      tax2: i.tax2,
      total: i.total,
      status: i.status,
      paymentmethod: i.paymentmethod,
      synced_at: new Date().toISOString(),
    }))
    
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('whmcs_invoices').upsert(batch, { onConflict: 'instance_id,whmcs_id' })
      if (error) {
        console.error(`Sync invoices error (batch ${i / BATCH_SIZE + 1}):`, error)
        break
      }
    }
    counts.invoices = data.data.invoices.length
  }

  // Sync invoice items (batch to avoid payload size limits)
  if (data.data.invoice_items.length > 0) {
    const BATCH_SIZE = 500
    const items = data.data.invoice_items.map((item) => ({
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
    }))
    
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('whmcs_invoice_items').upsert(batch, { onConflict: 'instance_id,whmcs_id' })
      if (error) {
        console.error(`Sync invoice_items error (batch ${i / BATCH_SIZE + 1}):`, error)
        break
      }
    }
    counts.invoice_items = data.data.invoice_items.length
  }

  // Sync billable items
  if (data.data.billable_items.length > 0) {
    const { error } = await supabase.from('whmcs_billable_items').upsert(
      data.data.billable_items.map((b) => ({
        instance_id: instanceId,
        whmcs_id: b.id,
        client_id: b.userid,
        description: b.description,
        amount: b.amount,
        recur: b.recur,
        recurcycle: b.recurcycle,
        recurfor: b.recurfor,
        duedate: sanitizeDate(b.duedate),
        invoicecount: b.invoicecount,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: 'instance_id,whmcs_id' }
    )
    if (error) console.error('Sync billable_items error:', error)
    counts.billable_items = data.data.billable_items.length
  }

  // Sync cancellation requests (for precise churn tracking)
  if (data.data.cancellation_requests && data.data.cancellation_requests.length > 0) {
    const { error } = await supabase.from('whmcs_cancellation_requests').upsert(
      data.data.cancellation_requests.map((cr) => ({
        instance_id: instanceId,
        whmcs_id: cr.id,
        relid: cr.relid,
        reason: cr.reason,
        type: cr.type,
        created_at: sanitizeTimestamp(cr.created_at),
        synced_at: new Date().toISOString(),
      })),
      { onConflict: 'instance_id,whmcs_id' }
    )
    if (error) console.error('Sync cancellation_requests error:', error)
    counts.cancellation_requests = data.data.cancellation_requests.length
  }

  return counts
}

// Legacy export for backwards compatibility
// TODO: Remove after updating all callers
export const syncTenant = syncTenantInstances
