-- 00056: Coherence fixes from the endpoint audit (2026-06-05)
--
-- #1 /api/metrics/history was sourced from the legacy `metrics_snapshots` table
--    via get_metrics_history(_aggregated). That table is written by the legacy
--    create_daily_snapshot with an "only update if higher" rule, so it LAGS MRR
--    drops by 1-2 days (verified: the €5125 #230 churn hit metrics_daily on
--    2026-05-18 but metrics_snapshots stayed high until 05-20) and its churn
--    series predates the 3-category model. Repoint both RPCs to `metrics_daily`
--    (the ground truth used by the live KPI, daily-mrr and mrr-trend). Output
--    columns are unchanged (date aliased to snapshot_date) so the route/dashboard
--    need no change. churned_services now sums the 3 category counts; the
--    aggregated churn_rate is MRR-weighted (SUM(churned)/SUM(active_start)),
--    matching the churn KPI, instead of a plain AVG of per-instance rates.
--
-- #2 /api/metrics/products-churn (get_product_churn_stats) dated undated
--    cancellations by `synced_at` (mis-counting every recently-synced cancelled
--    service as churned in the current window). Replace with the same hosting
--    boundary logic as calculate_churn (was-active-at-start AND not-active-at-end,
--    dated by regdate/terminationdate), so per-product churn reconciles with the
--    hosting component of the churn KPI. Signature unchanged.

-- ---------------------------------------------------------------------------
-- #1a single-instance history
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_metrics_history(p_instance_id uuid, p_days integer DEFAULT 30)
RETURNS TABLE(snapshot_date date, mrr numeric, arr numeric, active_services integer, active_clients integer, total_clients integer, churned_services integer, churned_mrr numeric, churn_rate numeric, revenue_day numeric)
LANGUAGE sql
STABLE
AS $function$
    SELECT
        md.date AS snapshot_date,
        md.mrr,
        md.arr,
        md.active_services,
        md.active_clients,
        md.total_clients,
        (COALESCE(md.hosting_churned_services, 0)
            + COALESCE(md.billable_churned_services, 0)
            + COALESCE(md.domains_churned_services, 0))::INTEGER AS churned_services,
        COALESCE(md.churned_mrr, 0) AS churned_mrr,
        COALESCE(md.churn_rate, 0) AS churn_rate,
        COALESCE(md.revenue_day, 0) AS revenue_day
    FROM metrics_daily md
    WHERE md.instance_id = p_instance_id
      AND md.date >= CURRENT_DATE - p_days
    ORDER BY md.date DESC
$function$;

-- ---------------------------------------------------------------------------
-- #1b aggregated history (multi-instance)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_metrics_history_aggregated(p_instance_ids uuid[], p_days integer DEFAULT 30)
RETURNS TABLE(snapshot_date date, mrr numeric, arr numeric, active_services bigint, active_clients bigint, total_clients bigint, churned_services bigint, churned_mrr numeric, churn_rate numeric, revenue_day numeric)
LANGUAGE sql
STABLE
AS $function$
    SELECT
        md.date AS snapshot_date,
        SUM(md.mrr)::DECIMAL(12,2) AS mrr,
        SUM(md.arr)::DECIMAL(12,2) AS arr,
        SUM(md.active_services) AS active_services,
        SUM(md.active_clients) AS active_clients,
        SUM(md.total_clients) AS total_clients,
        SUM(COALESCE(md.hosting_churned_services, 0)
            + COALESCE(md.billable_churned_services, 0)
            + COALESCE(md.domains_churned_services, 0)) AS churned_services,
        SUM(COALESCE(md.churned_mrr, 0))::DECIMAL(12,2) AS churned_mrr,
        -- MRR-weighted across instances (not AVG of rates) — matches the churn KPI.
        CASE WHEN SUM(COALESCE(md.active_mrr_start, 0)) > 0
            THEN ROUND((SUM(COALESCE(md.churned_mrr, 0)) / SUM(COALESCE(md.active_mrr_start, 0))) * 100, 2)
            ELSE 0::NUMERIC END AS churn_rate,
        SUM(COALESCE(md.revenue_day, 0))::DECIMAL(12,2) AS revenue_day
    FROM metrics_daily md
    WHERE md.instance_id = ANY(p_instance_ids)
      AND md.date >= CURRENT_DATE - p_days
    GROUP BY md.date
    ORDER BY md.date DESC
$function$;

-- ---------------------------------------------------------------------------
-- #2 per-product churn — mirror calculate_churn's hosting boundary logic
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_product_churn_stats(p_instance_id uuid, p_period_days integer DEFAULT 30)
RETURNS TABLE(packageid bigint, active_services bigint, churned_services bigint, churned_mrr numeric)
LANGUAGE sql
STABLE
AS $function$
    WITH service_states AS (
        SELECT
            h.packageid,
            h.amount,
            h.billingcycle,
            -- was active at period start (CURRENT_DATE - p_period_days)
            CASE
                WHEN h.regdate IS NULL OR h.regdate > (CURRENT_DATE - p_period_days)                        THEN FALSE
                WHEN h.terminationdate IS NOT NULL AND h.terminationdate <= (CURRENT_DATE - p_period_days)  THEN FALSE
                WHEN h.terminationdate IS NOT NULL AND h.terminationdate >  (CURRENT_DATE - p_period_days)  THEN TRUE
                ELSE h.domainstatus IN ('Active', 'Suspended')
            END AS was_active,
            -- is active now (period end = CURRENT_DATE)
            CASE
                WHEN h.regdate IS NULL OR h.regdate > CURRENT_DATE                       THEN FALSE
                WHEN h.terminationdate IS NOT NULL AND h.terminationdate <= CURRENT_DATE THEN FALSE
                WHEN h.terminationdate IS NOT NULL AND h.terminationdate >  CURRENT_DATE THEN TRUE
                ELSE h.domainstatus IN ('Active', 'Suspended')
            END AS is_active
        FROM whmcs_hosting h
        WHERE h.instance_id = p_instance_id
          AND h.packageid IS NOT NULL
    )
    SELECT
        packageid,
        COUNT(*) FILTER (WHERE is_active)::BIGINT AS active_services,
        COUNT(*) FILTER (WHERE was_active AND NOT is_active)::BIGINT AS churned_services,
        COALESCE(SUM(normalize_to_monthly(amount, billingcycle))
            FILTER (WHERE was_active AND NOT is_active), 0)::DECIMAL(10,2) AS churned_mrr
    FROM service_states
    GROUP BY packageid;
$function$;
