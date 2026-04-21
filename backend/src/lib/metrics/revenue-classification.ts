import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Invoice-line item types that always represent recurring revenue.
 *
 * Includes every Domain variant (Register/Transfer/Renew) because MRRlytics
 * counts all active domains in MRR via whmcs_domains (see migration 00037),
 * so the first domain payment must also count as recurring revenue —
 * otherwise KPI "Recurring Revenue" and KPI "MRR" would disagree on whether
 * a fresh domain contributes.
 *
 * PromoHosting is included because it represents a discount applied to a
 * recurring hosting service (typically a negative amount each billing
 * cycle). Treating it as recurring keeps the recurring/onetime split
 * reflecting net recurring revenue instead of inflating recurring and
 * deflating one-time.
 */
export const RECURRING_TYPES = [
  'Hosting',
  'Domain',
  'DomainRenew',
  'DomainRegister',
  'DomainTransfer',
  'PromoHosting',
] as const

/**
 * Load the set of `instance_id:whmcs_id` keys for every recurring billable
 * item (`invoice_action = 4`). Pair with `isRecurringItem` to classify
 * invoice lines whose `type='Item'` and `relid` points to one of these.
 */
export async function fetchRecurringBillableSet(
  supabase: SupabaseClient,
  instanceIds: string[],
): Promise<Set<string>> {
  if (instanceIds.length === 0) return new Set()
  const { data } = await supabase
    .from('whmcs_billable_items')
    .select('instance_id, whmcs_id')
    .in('instance_id', instanceIds)
    .eq('invoice_action', 4)
    .limit(10000)
  return new Set((data ?? []).map(r => `${r.instance_id}:${r.whmcs_id}`))
}

/**
 * True when the invoice line represents recurring revenue.
 *
 * - Types in RECURRING_TYPES are always recurring.
 * - `type='Item'` is recurring only if its `relid` matches a whmcs_id in
 *   `recurringBillableSet` (a billable item with `invoice_action = 4`).
 * - Everything else is one-time.
 */
export function isRecurringItem(
  type: string | null,
  relid: number | null,
  instanceId: string | null | undefined,
  recurringBillableSet: Set<string>,
): boolean {
  if (type && (RECURRING_TYPES as readonly string[]).includes(type)) {
    return true
  }
  if (type === 'Item' && relid != null && instanceId) {
    return recurringBillableSet.has(`${instanceId}:${relid}`)
  }
  return false
}

/**
 * True when the invoice line is a credit note / refund / abono.
 *
 * WHMCS stores these as invoice items with an empty/null `type` and a
 * negative `amount`. Descriptions are free text ("Abono factura NNN",
 * "Credit note for invoice NNN", "Descuento 50%"). They reverse a previous
 * transaction so they are conceptually one-time, but the volume is high
 * enough (~ -€160k across paid invoices in the sample tenant) that they
 * warrant a dedicated breakdown bucket instead of being lumped into
 * "Other" / "One-time".
 */
export function isCreditNote(
  type: string | null,
  amount: number,
): boolean {
  return (type === null || type === '') && amount < 0
}
