-- Per-product churn aggregation for /api/metrics/products-churn.
--
-- Replaces ad-hoc TS logic in the API endpoint that was missing the
-- terminationdate-NULL fallback (most WHMCS cancellations come through
-- with terminationdate=NULL and just a domainstatus change, so the
-- previous endpoint reported 0% churn for nearly every product).
--
-- Mirrors the fallback used by calculate_churn / get_churned_services
-- (see 00015_add_churn_tracking_fields.sql): use terminationdate when
-- present, otherwise treat synced_at as a proxy for the cancellation
-- timestamp.

CREATE OR REPLACE FUNCTION get_product_churn_stats(
    p_instance_id UUID,
    p_period_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    packageid BIGINT,
    active_services BIGINT,
    churned_services BIGINT,
    churned_mrr DECIMAL(10,2)
) AS $$
DECLARE
    v_period_start DATE;
    v_period_end DATE;
BEGIN
    v_period_end := CURRENT_DATE;
    v_period_start := v_period_end - p_period_days;

    RETURN QUERY
    SELECT
        h.packageid,
        COUNT(*) FILTER (WHERE h.domainstatus IN ('Active', 'Suspended'))::BIGINT AS active_services,
        COUNT(*) FILTER (
            WHERE h.domainstatus IN ('Cancelled', 'Terminated')
              AND (
                  (h.terminationdate IS NOT NULL
                       AND h.terminationdate >= v_period_start
                       AND h.terminationdate <= v_period_end)
                  OR
                  (h.terminationdate IS NULL AND h.synced_at >= v_period_start)
              )
        )::BIGINT AS churned_services,
        COALESCE(SUM(
            normalize_to_monthly(h.amount, h.billingcycle)
        ) FILTER (
            WHERE h.domainstatus IN ('Cancelled', 'Terminated')
              AND (
                  (h.terminationdate IS NOT NULL
                       AND h.terminationdate >= v_period_start
                       AND h.terminationdate <= v_period_end)
                  OR
                  (h.terminationdate IS NULL AND h.synced_at >= v_period_start)
              )
        ), 0)::DECIMAL(10,2) AS churned_mrr
    FROM whmcs_hosting h
    WHERE h.instance_id = p_instance_id
      AND h.packageid IS NOT NULL
    GROUP BY h.packageid;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_product_churn_stats IS
    'Per-product churn aggregation. Uses terminationdate when set, otherwise falls back to synced_at + Cancelled/Terminated status (same logic as get_churned_services).';
