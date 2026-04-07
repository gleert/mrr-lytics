-- Include active domain recurring revenue in MRR/ARR materialized views.
--
-- Active domains (status = 'Active') contribute monthly recurring revenue
-- equal to their annual recurringamount normalized to monthly:
--   monthly MRR = recurringamount / (registrationperiod * 12)
--
-- To keep the same pattern as migration 00030 (normalize_to_monthly in outer query),
-- domains are added with:
--   amount = recurringamount / registrationperiod  (annual equivalent for 1 year)
--   cycle  = 'annually'
-- so normalize_to_monthly(amount, 'annually') = amount / 12 = recurringamount / (registrationperiod * 12)

-- ── mv_mrr_current ─────────────────────────────────────────────────────────────

DROP MATERIALIZED VIEW IF EXISTS mv_mrr_current;

CREATE MATERIALIZED VIEW mv_mrr_current AS
SELECT
    instance_id,
    SUM(normalize_to_monthly(amount, cycle))        AS mrr,
    SUM(normalize_to_monthly(amount, cycle) * 12)   AS arr,
    SUM(active_service)                             AS active_services,
    NOW()                                           AS calculated_at
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

    UNION ALL

    -- Active domains (recurringamount covers registrationperiod years → normalize to 1-year equivalent)
    SELECT
        instance_id,
        COALESCE(recurringamount, 0) / COALESCE(NULLIF(registrationperiod, 0), 1) AS amount,
        'annually' AS cycle,
        0 AS active_service
    FROM whmcs_domains
    WHERE status = 'Active'
      AND COALESCE(recurringamount, 0) > 0
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
    WHERE recur = 1
      AND duedate <= CURRENT_DATE
      AND (recurfor = 0 OR invoicecount < recurfor)

    UNION ALL

    -- Active domains under 'annually' cycle
    SELECT
        instance_id,
        'annually' AS cycle,
        COALESCE(recurringamount, 0) / COALESCE(NULLIF(registrationperiod, 0), 1) AS amount
    FROM whmcs_domains
    WHERE status = 'Active'
      AND COALESCE(recurringamount, 0) > 0
) combined
GROUP BY instance_id, cycle;

CREATE UNIQUE INDEX idx_mv_mrr_cycle ON mv_mrr_by_cycle(instance_id, billingcycle);
