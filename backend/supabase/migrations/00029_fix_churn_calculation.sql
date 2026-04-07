-- Fix calculate_churn() to use date-driven wasActiveAt logic
-- instead of synced_at-based detection.
--
-- Problems with the old implementation:
--   1. Used synced_at >= period_start to detect churned services — a service
--      cancelled months ago would reappear as "new churn" on every re-sync.
--   2. Counted Suspended services as churned — they are still active customers.
--   3. Denominator was current_active + churned (wrong), not active_at_start.
--
-- This mirrors the wasActiveAt() function in /api/metrics/products-churn/route.ts.

CREATE OR REPLACE FUNCTION calculate_churn(p_instance_id UUID, p_period_days INTEGER DEFAULT 30)
RETURNS TABLE (
    period_start DATE,
    period_end DATE,
    churned_services BIGINT,
    churned_mrr NUMERIC,
    churn_rate NUMERIC
) AS $$
DECLARE
    v_period_start DATE;
    v_period_end DATE;
BEGIN
    v_period_end := CURRENT_DATE;
    v_period_start := v_period_end - p_period_days;

    RETURN QUERY
    WITH service_states AS (
        SELECT
            amount,
            billingcycle,
            -- was_active at period_start
            CASE
                WHEN regdate IS NULL OR regdate > v_period_start                       THEN FALSE
                WHEN terminationdate IS NOT NULL AND terminationdate <= v_period_start  THEN FALSE
                WHEN terminationdate IS NOT NULL AND terminationdate > v_period_start   THEN TRUE
                ELSE domainstatus IN ('Active', 'Suspended')
            END AS was_active,
            -- is_active at period_end
            CASE
                WHEN regdate IS NULL OR regdate > v_period_end                         THEN FALSE
                WHEN terminationdate IS NOT NULL AND terminationdate <= v_period_end    THEN FALSE
                WHEN terminationdate IS NOT NULL AND terminationdate > v_period_end     THEN TRUE
                ELSE domainstatus IN ('Active', 'Suspended')
            END AS is_active
        FROM whmcs_hosting
        WHERE instance_id = p_instance_id
    )
    SELECT
        v_period_start,
        v_period_end,
        COUNT(*)   FILTER (WHERE was_active AND NOT is_active),
        COALESCE(
            SUM(normalize_to_monthly(amount, billingcycle))
                   FILTER (WHERE was_active AND NOT is_active),
            0
        ),
        CASE
            WHEN COUNT(*) FILTER (WHERE was_active) > 0
            THEN ROUND(
                COUNT(*) FILTER (WHERE was_active AND NOT is_active)::NUMERIC
                / COUNT(*) FILTER (WHERE was_active) * 100,
                2
            )
            ELSE 0
        END
    FROM service_states;
END;
$$ LANGUAGE plpgsql STABLE;
