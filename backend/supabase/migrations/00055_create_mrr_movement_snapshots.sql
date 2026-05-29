-- ============================================================================
-- 00055: Daily per-entity MRR snapshot -> observed movement events
-- ============================================================================
-- Replaces fragile churn-date PROXIES (terminationdate / nextduedate / duedate /
-- cancelled_at / expirydate) with OBSERVED truth. A daily diff of the active set's
-- per-entity monthly MRR detects the four real movements (new / churn / expansion
-- / contraction) plus reactivation. This is what finally lets us see contraction
-- (e.g. a price halved on a still-active service), which proxies cannot detect at
-- all -- expansion_mrr/contraction_mrr are hardcoded to 0 in mrr-movement today.
--
-- Two tables:
--   entity_mrr_state  -- current state per entity (overwritten each run; bounded
--                        by distinct entities, NOT day-accumulated). Inactive rows
--                        kept as tombstones for reactivation detection.
--   mrr_movement_events -- append-only log of detected transitions (the artifact
--                          downstream endpoints will read for accurate dates).
--
-- Populated by runMovementSnapshot() (backend/src/lib/metrics/movement-snapshot.ts)
-- from the sync flow, gated to full syncs (~once/instance/day).
--
-- Security: like mv_* (see 00054) these hold cross-tenant data and must NEVER be
-- exposed to anon/authenticated. Service role only; the read endpoint authorizes
-- callers in app code.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- entity_mrr_state: one row per (instance, entity_type, entity_id)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS entity_mrr_state (
    instance_id       UUID NOT NULL REFERENCES whmcs_instances(id) ON DELETE CASCADE,
    entity_type       TEXT NOT NULL CHECK (entity_type IN ('hosting', 'billable', 'domain')),
    entity_id         BIGINT NOT NULL,                 -- whmcs_id
    is_active         BOOLEAN NOT NULL,
    -- Full precision (not (12,2)): SUM over thousands of entities must reconcile
    -- with the full-precision live MRR KPI to the cent. Display rounds at the edge.
    monthly_mrr       NUMERIC(14,6) NOT NULL DEFAULT 0,
    first_seen_active DATE,
    last_seen_active  DATE,
    last_changed      DATE NOT NULL,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (instance_id, entity_type, entity_id)
);

-- Fast load of the currently-active set per instance (the diff's hot path).
CREATE INDEX IF NOT EXISTS idx_entity_mrr_state_active
ON entity_mrr_state(instance_id, entity_type) WHERE is_active;

-- ----------------------------------------------------------------------------
-- mrr_movement_events: append-only transition log
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mrr_movement_events (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id    UUID NOT NULL REFERENCES whmcs_instances(id) ON DELETE CASCADE,
    entity_type    TEXT NOT NULL CHECK (entity_type IN ('hosting', 'billable', 'domain')),
    entity_id      BIGINT NOT NULL,                    -- whmcs_id
    event_type     TEXT NOT NULL CHECK (event_type IN ('new', 'churn', 'expansion', 'contraction', 'reactivation')),
    mrr_before     NUMERIC(14,6) NOT NULL DEFAULT 0,   -- full precision; display rounds
    mrr_after      NUMERIC(14,6) NOT NULL DEFAULT 0,
    mrr_delta      NUMERIC(14,6) NOT NULL,             -- mrr_after - mrr_before
    observed_date  DATE NOT NULL,                      -- run date the diff detected it (idempotency key)
    effective_date DATE,                               -- refined real date (terminationdate/cancelled_at/expirydate), nullable
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One event per entity per run -> idempotent re-runs (ON CONFLICT DO UPDATE).
CREATE UNIQUE INDEX IF NOT EXISTS uq_mrr_event_per_day
ON mrr_movement_events(instance_id, entity_type, entity_id, observed_date);

-- Month+instance reads (the read endpoint and future hybrid consumers).
CREATE INDEX IF NOT EXISTS idx_mrr_events_instance_date
ON mrr_movement_events(instance_id, observed_date);

CREATE INDEX IF NOT EXISTS idx_mrr_events_type
ON mrr_movement_events(instance_id, event_type, observed_date);

-- ----------------------------------------------------------------------------
-- RLS + grants (mirror metrics_daily in 00017; honor the 00054 lesson)
-- ----------------------------------------------------------------------------
ALTER TABLE entity_mrr_state    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrr_movement_events ENABLE ROW LEVEL SECURITY;

-- DROP IF EXISTS makes the migration idempotent (CREATE POLICY is not).
DROP POLICY IF EXISTS "Service role can manage entity_mrr_state" ON entity_mrr_state;
CREATE POLICY "Service role can manage entity_mrr_state"
ON entity_mrr_state FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage mrr_movement_events" ON mrr_movement_events;
CREATE POLICY "Service role can manage mrr_movement_events"
ON mrr_movement_events FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- These tables hold cross-tenant data with no RLS tenant predicate; the Data API
-- anon/authenticated roles must never reach them (cf. 00054 matview exposure).
REVOKE ALL ON entity_mrr_state    FROM anon, authenticated, PUBLIC;
REVOKE ALL ON mrr_movement_events FROM anon, authenticated, PUBLIC;
GRANT ALL ON entity_mrr_state    TO service_role;
GRANT ALL ON mrr_movement_events TO service_role;
