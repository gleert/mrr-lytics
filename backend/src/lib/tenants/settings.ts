import type { SupabaseClient } from '@supabase/supabase-js'

export const ALL_INVOICE_STATUSES = [
  'Paid',
  'Unpaid',
  'Payment Pending',
  'Cancelled',
  'Refunded',
  'Collections',
  'Draft',
] as const

export type RevenueInvoiceStatus = (typeof ALL_INVOICE_STATUSES)[number]

const DEFAULT_STATUSES: RevenueInvoiceStatus[] = ['Paid', 'Unpaid', 'Payment Pending']

/**
 * Resolve the list of invoice statuses that count toward revenue for a tenant.
 *
 * Priority:
 *   1. `settings.revenue_invoice_statuses` array (new explicit config)
 *   2. Legacy `settings.include_cancelled_invoices` boolean (backward compat)
 *   3. Hardcoded default: Paid, Unpaid, Payment Pending
 *
 * Falls back to the default on any lookup error so a broken settings query
 * never turns a dashboard into an empty report.
 */
export async function getRevenueInvoiceStatuses(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<RevenueInvoiceStatus[]> {
  if (!tenantId) return [...DEFAULT_STATUSES]

  const { data, error } = await supabase
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .single()

  if (error || !data) return [...DEFAULT_STATUSES]

  const settings = (data.settings as Record<string, unknown>) || {}

  // New explicit list takes precedence
  if (Array.isArray(settings.revenue_invoice_statuses) && settings.revenue_invoice_statuses.length > 0) {
    return (settings.revenue_invoice_statuses as string[])
      .filter((s): s is RevenueInvoiceStatus => ALL_INVOICE_STATUSES.includes(s as RevenueInvoiceStatus))
  }

  // Legacy boolean fallback
  if (settings.include_cancelled_invoices === true) {
    return [...DEFAULT_STATUSES, 'Cancelled']
  }

  return [...DEFAULT_STATUSES]
}
