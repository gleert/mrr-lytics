/**
 * Active-set: the single definition of "which entities are active right now and
 * what monthly MRR each contributes".
 *
 * This is the SAME membership + per-entity amount that the live MRR KPI uses
 * (see calculateMrrLive in ./mrr-live, which imports the math primitives from
 * here). The daily movement snapshot (./movement-snapshot) consumes
 * fetchActiveSet(), so the snapshot reconciles with the KPI *by construction* —
 * there is one definition of the rules, not a SQL copy (mv_mrr_current) plus N
 * endpoint copies drifting apart (a recurring bug source historically).
 *
 * IMPORTANT: amounts here are kept at FULL precision (no per-entity rounding) so
 * SUM(active monthly_mrr) matches the KPI total to the cent. Rounding for display
 * happens at the edges.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export type EntityType = 'hosting' | 'billable' | 'domain'

/** Half a cent — below this an entity is treated as zero MRR (excluded). */
export const MRR_EPSILON = 0.005

export const CYCLE_TO_MONTHS: Record<string, number> = {
  monthly: 1,
  months: 1,
  month: 1,
  quarterly: 3,
  'semi-annually': 6,
  semiannually: 6,
  annually: 12,
  yearly: 12,
  years: 12,
  year: 12,
  biennially: 24,
  triennially: 36,
}

export function toMonthlyAmount(amount: number, cycle: string | null | undefined): number {
  if (!cycle) return 0
  const divisor = CYCLE_TO_MONTHS[cycle.toLowerCase()]
  if (!divisor) return 0
  return amount / divisor
}

/** Domain MRR: annual recurringamount / (registrationperiod * 12). Period defaults to 1. */
export function domainMonthly(
  recurringamount: number | string | null,
  registrationperiod: number | null,
): number {
  const annual = Number(recurringamount) || 0
  const period = Number(registrationperiod) || 1
  return annual > 0 && period > 0 ? annual / (period * 12) : 0
}

/**
 * Recurring billable items (invoice_action=4, invoicecount>0) are only still
 * active if they haven't exhausted their fixed recurfor schedule. recurfor=0
 * means it recurs forever. Mirrors the JS filter in calculateMrrLive.
 */
export function isBillableLifecycleActive(
  recurfor: number | null,
  invoicecount: number | null,
): boolean {
  return (recurfor ?? 0) === 0 || (invoicecount ?? 0) < (recurfor ?? 0)
}

export interface ActiveEntity {
  instance_id: string
  entity_type: EntityType
  entity_id: number // whmcs_id
  monthly_mrr: number
}

/**
 * Fetch the active set across instances: hosting (domainstatus=Active), recurring
 * billable items (invoice_action=4 AND invoicecount>0 AND lifecycle active), and
 * domains (status=Active). Entities with monthly_mrr <= MRR_EPSILON are excluded
 * (same as the KPI). Used by the daily movement snapshot.
 *
 * The query filters here MUST stay identical to calculateMrrLive's queries —
 * both define the same active set.
 */
export async function fetchActiveSet(instanceIds: string[]): Promise<ActiveEntity[]> {
  if (instanceIds.length === 0) return []

  const supabase = createAdminClient()

  const [hostingRes, billableRes, domainRes] = await Promise.all([
    supabase
      .from('whmcs_hosting')
      .select('instance_id, whmcs_id, amount, billingcycle')
      .in('instance_id', instanceIds)
      .eq('domainstatus', 'Active')
      .limit(10000),
    supabase
      .from('whmcs_billable_items')
      .select('instance_id, whmcs_id, amount, recurcycle, recurfor, invoicecount')
      .in('instance_id', instanceIds)
      .eq('invoice_action', 4)
      .gt('invoicecount', 0)
      .limit(10000),
    supabase
      .from('whmcs_domains')
      .select('instance_id, whmcs_id, recurringamount, registrationperiod')
      .in('instance_id', instanceIds)
      .eq('status', 'Active')
      .limit(10000),
  ])

  if (hostingRes.error) throw new Error(`Failed to fetch hosting active set: ${hostingRes.error.message}`)
  if (billableRes.error) throw new Error(`Failed to fetch billable active set: ${billableRes.error.message}`)
  if (domainRes.error) throw new Error(`Failed to fetch domain active set: ${domainRes.error.message}`)

  const out: ActiveEntity[] = []

  for (const h of hostingRes.data ?? []) {
    const monthly = toMonthlyAmount(Number(h.amount) || 0, h.billingcycle)
    if (monthly > MRR_EPSILON) {
      out.push({ instance_id: h.instance_id, entity_type: 'hosting', entity_id: h.whmcs_id, monthly_mrr: monthly })
    }
  }

  for (const b of billableRes.data ?? []) {
    if (!isBillableLifecycleActive(b.recurfor, b.invoicecount)) continue
    const monthly = toMonthlyAmount(Number(b.amount) || 0, b.recurcycle)
    if (monthly > MRR_EPSILON) {
      out.push({ instance_id: b.instance_id, entity_type: 'billable', entity_id: b.whmcs_id, monthly_mrr: monthly })
    }
  }

  for (const d of domainRes.data ?? []) {
    const monthly = domainMonthly(d.recurringamount, d.registrationperiod)
    if (monthly > MRR_EPSILON) {
      out.push({ instance_id: d.instance_id, entity_type: 'domain', entity_id: d.whmcs_id, monthly_mrr: monthly })
    }
  }

  return out
}
