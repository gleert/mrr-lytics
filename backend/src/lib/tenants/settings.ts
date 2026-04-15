import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Invoice statuses used across revenue and client endpoints to decide which
 * rows count toward revenue totals. "Paid", "Unpaid" and "Payment Pending"
 * are always included. "Cancelled" is included only when the tenant has
 * explicitly opted in via `settings.include_cancelled_invoices` — some
 * tenants use cancellation as a rectificativa / credit-note workflow and
 * need those rows to contribute to reported revenue.
 */
const BASE_REVENUE_INVOICE_STATUSES = ['Paid', 'Unpaid', 'Payment Pending'] as const

export type RevenueInvoiceStatus = (typeof BASE_REVENUE_INVOICE_STATUSES)[number] | 'Cancelled'

/**
 * Resolve the list of invoice statuses that should count toward revenue
 * calculations for a given tenant. Falls back to the base list on any
 * lookup error — this is defensive so a broken settings query never turns
 * a dashboard into an empty report.
 */
export async function getRevenueInvoiceStatuses(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<RevenueInvoiceStatus[]> {
  const base = [...BASE_REVENUE_INVOICE_STATUSES] as RevenueInvoiceStatus[]
  if (!tenantId) return base

  const { data, error } = await supabase
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .single()

  if (error || !data) return base

  const settings = (data.settings as Record<string, unknown>) || {}
  if (settings.include_cancelled_invoices === true) {
    return [...base, 'Cancelled']
  }
  return base
}
