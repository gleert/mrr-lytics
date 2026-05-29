/**
 * Daily MRR-movement snapshot/diff.
 *
 * Compares today's active set (per-entity monthly MRR, from ./active-set — the
 * same source as the live KPI) against the persisted per-entity state, and
 * records the OBSERVED movements (new / churn / expansion / contraction /
 * reactivation) into mrr_movement_events. State is then overwritten.
 *
 * This replaces fragile date proxies with observed truth and, crucially, makes
 * expansion/contraction detectable (a price change keeps an entity active, so no
 * proxy can ever see it). Runs once per instance per day from the sync flow.
 *
 * Idempotent per (instance, entity, observed_date): re-running the same day
 * re-upserts the same state and events with no duplicates.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { fetchActiveSet, MRR_EPSILON, type EntityType } from './active-set'

export type MovementEventType = 'new' | 'churn' | 'expansion' | 'contraction' | 'reactivation'

export interface SnapshotResult {
  instance_id: string
  observed_date: string
  seeded: boolean
  events: Record<MovementEventType, number>
}

interface PriorState {
  is_active: boolean
  monthly_mrr: number
  first_seen_active: string | null
  last_changed: string
}

interface StateUpsertRow {
  instance_id: string
  entity_type: EntityType
  entity_id: number
  is_active: boolean
  monthly_mrr: number
  first_seen_active: string | null
  last_seen_active: string | null
  last_changed: string
  updated_at: string
}

interface EventRow {
  instance_id: string
  entity_type: EntityType
  entity_id: number
  event_type: MovementEventType
  mrr_before: number
  mrr_after: number
  mrr_delta: number
  observed_date: string
  effective_date: string | null
}

const keyOf = (type: EntityType, id: number) => `${type}:${id}`

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Server-side today as YYYY-MM-DD. Safe here (runs in the sync request context). */
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function runMovementSnapshot(
  instanceId: string,
  observedDate?: string,
): Promise<SnapshotResult> {
  const observed = observedDate || today()
  const supabase = createAdminClient()

  const events: Record<MovementEventType, number> = {
    new: 0, churn: 0, expansion: 0, contraction: 0, reactivation: 0,
  }

  // 1. Today's active set.
  const activeList = await fetchActiveSet([instanceId])
  const current = new Map<string, { entity_type: EntityType; entity_id: number; monthly_mrr: number }>()
  for (const e of activeList) {
    current.set(keyOf(e.entity_type, e.entity_id), {
      entity_type: e.entity_type,
      entity_id: e.entity_id,
      monthly_mrr: e.monthly_mrr,
    })
  }

  // 2. Prior persisted state.
  const { data: priorRows, error: priorErr } = await supabase
    .from('entity_mrr_state')
    .select('entity_type, entity_id, is_active, monthly_mrr, first_seen_active, last_changed')
    .eq('instance_id', instanceId)
  if (priorErr) throw new Error(`Failed to load entity_mrr_state: ${priorErr.message}`)

  const prior = new Map<string, PriorState>()
  for (const r of priorRows ?? []) {
    prior.set(keyOf(r.entity_type as EntityType, r.entity_id), {
      is_active: r.is_active,
      monthly_mrr: Number(r.monthly_mrr) || 0,
      first_seen_active: r.first_seen_active,
      last_changed: r.last_changed,
    })
  }

  const stateUpserts: StateUpsertRow[] = []
  const eventRows: EventRow[] = []

  // 3. Cold start: seed silently, emit zero events. Suppresses the initial flood.
  const seeded = prior.size === 0
  if (seeded) {
    for (const e of current.values()) {
      stateUpserts.push({
        instance_id: instanceId,
        entity_type: e.entity_type,
        entity_id: e.entity_id,
        is_active: true,
        monthly_mrr: e.monthly_mrr,
        first_seen_active: observed,
        last_seen_active: observed,
        last_changed: observed,
        updated_at: new Date().toISOString(),
      })
    }
    await persist(supabase, stateUpserts, eventRows)
    return { instance_id: instanceId, observed_date: observed, seeded: true, events }
  }

  // 4. Diff current vs prior.
  for (const e of current.values()) {
    const k = keyOf(e.entity_type, e.entity_id)
    const p = prior.get(k)
    const nowMrr = e.monthly_mrr

    let eventType: MovementEventType | null = null
    let before = 0

    if (!p) {
      eventType = 'new'
      before = 0
    } else if (!p.is_active) {
      eventType = 'reactivation'
      before = 0
    } else {
      before = p.monthly_mrr
      const delta = nowMrr - before
      if (delta > MRR_EPSILON) eventType = 'expansion'
      else if (delta < -MRR_EPSILON) eventType = 'contraction'
    }

    if (eventType) {
      events[eventType]++
      eventRows.push({
        instance_id: instanceId,
        entity_type: e.entity_type,
        entity_id: e.entity_id,
        event_type: eventType,
        mrr_before: before,
        mrr_after: nowMrr,
        mrr_delta: nowMrr - before,
        observed_date: observed,
        effective_date: null, // new/expansion/contraction/reactivation observed in real time
      })
    }

    stateUpserts.push({
      instance_id: instanceId,
      entity_type: e.entity_type,
      entity_id: e.entity_id,
      is_active: true,
      monthly_mrr: nowMrr,
      first_seen_active: p?.first_seen_active ?? observed,
      last_seen_active: observed,
      // Bump only when the active state/amount actually changed; otherwise keep
      // the prior date (new entities have no prior → observed).
      last_changed: eventType ? observed : (p?.last_changed ?? observed),
      updated_at: new Date().toISOString(),
    })
  }

  // 5. Churn: prior active, absent from current.
  const churned: { entity_type: EntityType; entity_id: number; before: number }[] = []
  for (const [k, p] of prior) {
    if (!p.is_active) continue
    if (current.has(k)) continue
    const [type, idStr] = k.split(':')
    churned.push({ entity_type: type as EntityType, entity_id: Number(idStr), before: p.monthly_mrr })
  }

  // 5a. Refine churn dates from the raw tables (real cancellation date when known).
  const effectiveByKey = await fetchEffectiveDates(supabase, instanceId, churned)

  for (const c of churned) {
    events.churn++
    eventRows.push({
      instance_id: instanceId,
      entity_type: c.entity_type,
      entity_id: c.entity_id,
      event_type: 'churn',
      mrr_before: c.before,
      mrr_after: 0,
      mrr_delta: -c.before,
      observed_date: observed,
      effective_date: effectiveByKey.get(keyOf(c.entity_type, c.entity_id)) ?? null,
    })
    stateUpserts.push({
      instance_id: instanceId,
      entity_type: c.entity_type,
      entity_id: c.entity_id,
      is_active: false,
      monthly_mrr: 0,
      first_seen_active: prior.get(keyOf(c.entity_type, c.entity_id))?.first_seen_active ?? null,
      last_seen_active: null, // last_seen_active stays whatever it was; not re-touched here
      last_changed: observed,
      updated_at: new Date().toISOString(),
    })
  }

  await persist(supabase, stateUpserts, eventRows)
  return { instance_id: instanceId, observed_date: observed, seeded: false, events }
}

/**
 * For churned entities, look up the real cancellation-effective date from the raw
 * tables: hosting terminationdate, billable cancelled_at, domain expirydate.
 * Returns a Map key -> YYYY-MM-DD (only entries that resolved).
 */
async function fetchEffectiveDates(
  supabase: ReturnType<typeof createAdminClient>,
  instanceId: string,
  churned: { entity_type: EntityType; entity_id: number }[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const hostingIds = churned.filter((c) => c.entity_type === 'hosting').map((c) => c.entity_id)
  const billableIds = churned.filter((c) => c.entity_type === 'billable').map((c) => c.entity_id)
  const domainIds = churned.filter((c) => c.entity_type === 'domain').map((c) => c.entity_id)

  const toDate = (v: string | null): string | null => {
    if (!v || v === '0000-00-00') return null
    const s = String(v).slice(0, 10)
    return s > '0001-01-01' ? s : null
  }

  const tasks: Promise<void>[] = []

  if (hostingIds.length) {
    tasks.push(
      (async () => {
        for (const ids of chunk(hostingIds, 500)) {
          const { data } = await supabase
            .from('whmcs_hosting')
            .select('whmcs_id, terminationdate')
            .eq('instance_id', instanceId)
            .in('whmcs_id', ids)
          for (const r of data ?? []) {
            const d = toDate(r.terminationdate)
            if (d) out.set(keyOf('hosting', r.whmcs_id), d)
          }
        }
      })(),
    )
  }
  if (billableIds.length) {
    tasks.push(
      (async () => {
        for (const ids of chunk(billableIds, 500)) {
          const { data } = await supabase
            .from('whmcs_billable_items')
            .select('whmcs_id, cancelled_at')
            .eq('instance_id', instanceId)
            .in('whmcs_id', ids)
          for (const r of data ?? []) {
            const d = toDate(r.cancelled_at)
            if (d) out.set(keyOf('billable', r.whmcs_id), d)
          }
        }
      })(),
    )
  }
  if (domainIds.length) {
    tasks.push(
      (async () => {
        for (const ids of chunk(domainIds, 500)) {
          const { data } = await supabase
            .from('whmcs_domains')
            .select('whmcs_id, expirydate')
            .eq('instance_id', instanceId)
            .in('whmcs_id', ids)
          for (const r of data ?? []) {
            const d = toDate(r.expirydate)
            if (d) out.set(keyOf('domain', r.whmcs_id), d)
          }
        }
      })(),
    )
  }

  await Promise.all(tasks)
  return out
}

async function persist(
  supabase: ReturnType<typeof createAdminClient>,
  stateUpserts: StateUpsertRow[],
  eventRows: EventRow[],
): Promise<void> {
  // Churn rows carry last_seen_active=null which we do NOT want to overwrite the
  // existing value with. Split them out and update only the churn-relevant columns.
  const activeRows = stateUpserts.filter((r) => r.is_active)
  const churnRows = stateUpserts.filter((r) => !r.is_active)

  for (const batch of chunk(activeRows, 500)) {
    const { error } = await supabase
      .from('entity_mrr_state')
      .upsert(batch, { onConflict: 'instance_id,entity_type,entity_id' })
    if (error) throw new Error(`Failed to upsert active entity_mrr_state: ${error.message}`)
  }

  // Churn: update in place, preserving last_seen_active / first_seen_active.
  for (const r of churnRows) {
    const { error } = await supabase
      .from('entity_mrr_state')
      .update({
        is_active: false,
        monthly_mrr: 0,
        last_changed: r.last_changed,
        updated_at: r.updated_at,
      })
      .eq('instance_id', r.instance_id)
      .eq('entity_type', r.entity_type)
      .eq('entity_id', r.entity_id)
    if (error) throw new Error(`Failed to mark churn in entity_mrr_state: ${error.message}`)
  }

  for (const batch of chunk(eventRows, 500)) {
    const { error } = await supabase
      .from('mrr_movement_events')
      .upsert(batch, { onConflict: 'instance_id,entity_type,entity_id,observed_date' })
    if (error) throw new Error(`Failed to insert mrr_movement_events: ${error.message}`)
  }
}
