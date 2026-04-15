/**
 * Live MRR calculation from raw WHMCS tables.
 *
 * Single source of truth for MRR across the live dashboard endpoints
 * (/api/metrics, /api/metrics/mrr, /api/metrics/mrr-breakdown). Reads
 * directly from whmcs_hosting, whmcs_billable_items and whmcs_domains so
 * the result always matches the sum of the MRR breakdown components.
 *
 * The materialized view mv_mrr_current stays in use for historical
 * snapshots (metrics_daily, create_all_daily_snapshots) but is NOT the
 * source for live UI values any more — it can lag between syncs and
 * produces discrepancies when paired with breakdown endpoints that read
 * raw tables.
 */

import { createAdminClient } from '@/lib/supabase/admin'

const CYCLE_TO_MONTHS: Record<string, number> = {
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

export interface HostingRow {
  instance_id: string
  packageid: number | null
  amount: number
  billingcycle: string | null
  monthly: number
}

export interface BillableRow {
  instance_id: string
  whmcs_id: number
  amount: number
  recurcycle: string | null
  monthly: number
}

export interface DomainRow {
  instance_id: string
  monthly: number
}

export interface MrrLiveResult {
  total: number
  arr: number
  active_services: number
  mrr_by_cycle: { cycle: string; count: number; mrr: number }[]
  by_category: { hosting: number; billable: number; domains: number }
  calculated_at: string
  rows: {
    hosting: HostingRow[]
    billable: BillableRow[]
    domains: DomainRow[]
  }
}

export async function calculateMrrLive(instanceIds: string[]): Promise<MrrLiveResult> {
  if (instanceIds.length === 0) {
    return {
      total: 0,
      arr: 0,
      active_services: 0,
      mrr_by_cycle: [],
      by_category: { hosting: 0, billable: 0, domains: 0 },
      calculated_at: new Date().toISOString(),
      rows: { hosting: [], billable: [], domains: [] },
    }
  }

  const supabase = createAdminClient()

  const [
    { data: hostingServices, error: hostingError },
    { data: billableItemsRaw, error: billableError },
    { data: activeDomains, error: domainError },
  ] = await Promise.all([
    supabase
      .from('whmcs_hosting')
      .select('instance_id, packageid, amount, billingcycle')
      .in('instance_id', instanceIds)
      .eq('domainstatus', 'Active'),
    supabase
      .from('whmcs_billable_items')
      .select('instance_id, whmcs_id, amount, recurcycle, recurfor, invoicecount')
      .in('instance_id', instanceIds)
      .eq('invoice_action', 4)
      .gt('invoicecount', 0)
      .limit(10000),
    supabase
      .from('whmcs_domains')
      .select('instance_id, recurringamount, registrationperiod')
      .in('instance_id', instanceIds)
      .eq('status', 'Active'),
  ])

  if (hostingError) throw new Error(`Failed to fetch hosting data: ${hostingError.message}`)
  if (billableError) throw new Error(`Failed to fetch billable items: ${billableError.message}`)
  if (domainError) throw new Error(`Failed to fetch domains: ${domainError.message}`)

  const hostingRows: HostingRow[] = (hostingServices ?? []).map((h) => {
    const amount = Number(h.amount) || 0
    return {
      instance_id: h.instance_id,
      packageid: h.packageid,
      amount,
      billingcycle: h.billingcycle,
      monthly: toMonthlyAmount(amount, h.billingcycle),
    }
  })

  const activeBillable = (billableItemsRaw ?? []).filter(
    (item) => (item.recurfor ?? 0) === 0 || (item.invoicecount ?? 0) < (item.recurfor ?? 0)
  )
  const billableRows: BillableRow[] = activeBillable.map((b) => {
    const amount = Number(b.amount) || 0
    return {
      instance_id: b.instance_id,
      whmcs_id: b.whmcs_id,
      amount,
      recurcycle: b.recurcycle,
      monthly: toMonthlyAmount(amount, b.recurcycle),
    }
  })

  const domainRows: DomainRow[] = (activeDomains ?? [])
    .map((d) => {
      const annual = Number(d.recurringamount) || 0
      const period = Number(d.registrationperiod) || 1
      const monthly = annual > 0 && period > 0 ? annual / (period * 12) : 0
      return { instance_id: d.instance_id, monthly }
    })
    .filter((d) => d.monthly > 0)

  const hostingMrr = hostingRows.reduce((s, r) => s + r.monthly, 0)
  const billableMrr = billableRows.reduce((s, r) => s + r.monthly, 0)
  const domainsMrr = domainRows.reduce((s, r) => s + r.monthly, 0)
  const total = hostingMrr + billableMrr + domainsMrr

  const cycleMap = new Map<string, { count: number; mrr: number }>()
  const addCycle = (cycle: string, mrr: number) => {
    const existing = cycleMap.get(cycle) || { count: 0, mrr: 0 }
    cycleMap.set(cycle, { count: existing.count + 1, mrr: existing.mrr + mrr })
  }
  hostingRows.forEach((r) => {
    if (r.monthly > 0) addCycle((r.billingcycle || 'unknown').toLowerCase(), r.monthly)
  })
  billableRows.forEach((r) => {
    if (r.monthly > 0) addCycle((r.recurcycle || 'unknown').toLowerCase(), r.monthly)
  })
  domainRows.forEach((r) => addCycle('annually', r.monthly))

  const mrr_by_cycle = Array.from(cycleMap.entries()).map(([cycle, d]) => ({
    cycle,
    count: d.count,
    mrr: d.mrr,
  }))

  const active_services =
    hostingRows.filter((r) => r.monthly > 0).length +
    billableRows.filter((r) => r.monthly > 0).length +
    domainRows.length

  return {
    total,
    arr: total * 12,
    active_services,
    mrr_by_cycle,
    by_category: { hosting: hostingMrr, billable: billableMrr, domains: domainsMrr },
    calculated_at: new Date().toISOString(),
    rows: { hosting: hostingRows, billable: billableRows, domains: domainRows },
  }
}
