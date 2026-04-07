-- Fix billable items MRR condition: duedate is the NEXT billing date in WHMCS,
-- not the start date. Items with future duedates are actively recurring.
-- Replace duedate <= CURRENT_DATE with invoicecount > 0 (has been billed at least once).

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
    -- invoice_action = 4 → Recurring in WHMCS
    -- invoicecount > 0   → has been billed at least once (service started)
    -- recurfor = 0 OR invoicecount < recurfor → not yet completed
    SELECT instance_id, amount, recurcycle AS cycle, 0 AS active_service
    FROM whmcs_billable_items
    WHERE invoice_action = 4
      AND invoicecount > 0
      AND (recurfor = 0 OR invoicecount < recurfor)
) combined
GROUP BY instance_id;

CREATE UNIQUE INDEX idx_mv_mrr_instance ON mv_mrr_current(instance_id);

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
      AND invoicecount > 0
      AND (recurfor = 0 OR invoicecount < recurfor)
) combined
GROUP BY instance_id, cycle;

CREATE UNIQUE INDEX idx_mv_mrr_cycle ON mv_mrr_by_cycle(instance_id, billingcycle);
