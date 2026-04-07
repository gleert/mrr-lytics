-- Fix recurring billable item detection.
--
-- In WHMCS, the correct way to identify a recurring billable item is
-- invoiceaction = 4 (Recurring). The `recur` field is the recurrence
-- interval (not a boolean flag). Previous logic used recur = 1 which
-- incorrectly excluded items with recur > 1 (e.g., every 3 months).
--
-- Changes:
--   1. Add invoice_action column to whmcs_billable_items
--   2. Rebuild mv_mrr_current using invoice_action = 4
--   3. Rebuild mv_mrr_by_cycle using invoice_action = 4

-- ── Add invoice_action column ──────────────────────────────────────────────────
ALTER TABLE whmcs_billable_items
    ADD COLUMN IF NOT EXISTS invoice_action INTEGER;

-- ── mv_mrr_current ─────────────────────────────────────────────────────────────

DROP MATERIALIZED VIEW IF EXISTS mv_mrr_current;

CREATE MATERIALIZED VIEW mv_mrr_current AS
SELECT
    instance_id,
    SUM(normalize_to_monthly(amount, cycle))      AS mrr,
    SUM(normalize_to_monthly(amount, cycle) * 12) AS arr,
    SUM(active_service)                           AS active_services,
    NOW()                                         AS calculated_at
FROM (
    -- Active hosting services
    SELECT instance_id, amount, billingcycle AS cycle, 1 AS active_service
    FROM whmcs_hosting
    WHERE domainstatus = 'Active'

    UNION ALL

    -- Active recurring billable items (invoiceaction = 4 → Recurring)
    SELECT instance_id, amount, recurcycle AS cycle, 0 AS active_service
    FROM whmcs_billable_items
    WHERE invoice_action = 4
      AND duedate <= CURRENT_DATE
      AND (recurfor = 0 OR invoicecount < recurfor)
) combined
GROUP BY instance_id;

CREATE UNIQUE INDEX idx_mv_mrr_instance ON mv_mrr_current(instance_id);

-- ── mv_mrr_by_cycle ────────────────────────────────────────────────────────────

DROP MATERIALIZED VIEW IF EXISTS mv_mrr_by_cycle;

CREATE MATERIALIZED VIEW mv_mrr_by_cycle AS
SELECT
    instance_id,
    cycle                                           AS billingcycle,
    SUM(normalize_to_monthly(amount, cycle))        AS mrr_contribution
FROM (
    SELECT instance_id, billingcycle AS cycle, amount
    FROM whmcs_hosting
    WHERE domainstatus = 'Active'

    UNION ALL

    SELECT instance_id, recurcycle AS cycle, amount
    FROM whmcs_billable_items
    WHERE invoice_action = 4
      AND duedate <= CURRENT_DATE
      AND (recurfor = 0 OR invoicecount < recurfor)
) combined
GROUP BY instance_id, cycle;

CREATE UNIQUE INDEX idx_mv_mrr_cycle ON mv_mrr_by_cycle(instance_id, billingcycle);
