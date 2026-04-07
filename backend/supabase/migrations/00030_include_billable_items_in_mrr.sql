-- Include recurring billable items in MRR/ARR calculations.
--
-- Recurring billable items (recur = 1) represent ongoing charges (e.g. monthly
-- maintenance, managed services) that belong in MRR just like hosting services.
--
-- Filters applied to billable items:
--   recur = 1              → item is set to recur
--   duedate <= CURRENT_DATE → billing has already started
--   recurfor = 0            → recurs indefinitely, OR
--   invoicecount < recurfor → still has remaining recurrences

-- ── mv_mrr_current ─────────────────────────────────────────────────────────────
-- Recreate to add recurring billable items via UNION.
-- active_services counts hosting services only (not billable items).

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

    -- Active recurring billable items
    SELECT instance_id, amount, recurcycle AS cycle, 0 AS active_service
    FROM whmcs_billable_items
    WHERE recur = 1
      AND duedate <= CURRENT_DATE
      AND (recurfor = 0 OR invoicecount < recurfor)
) combined
GROUP BY instance_id;

CREATE UNIQUE INDEX idx_mv_mrr_instance ON mv_mrr_current(instance_id);

-- ── mv_mrr_by_cycle ────────────────────────────────────────────────────────────
-- Recreate to keep the cycle breakdown consistent with mv_mrr_current.

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
    WHERE recur = 1
      AND duedate <= CURRENT_DATE
      AND (recurfor = 0 OR invoicecount < recurfor)
) combined
GROUP BY instance_id, cycle;

CREATE UNIQUE INDEX idx_mv_mrr_cycle ON mv_mrr_by_cycle(instance_id, billingcycle);
