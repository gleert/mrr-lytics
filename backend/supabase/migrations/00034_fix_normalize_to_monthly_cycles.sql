-- Fix normalize_to_monthly to handle WHMCS billable item cycle formats.
--
-- WHMCS billable items use "Months" / "Years" (capitalized singular)
-- while hosting services use "monthly" / "annually" (lowercase).
-- LOWER() is already applied so we need to add 'months', 'years', etc.

CREATE OR REPLACE FUNCTION normalize_to_monthly(p_amount NUMERIC, p_cycle TEXT)
RETURNS NUMERIC
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT CASE LOWER(COALESCE(p_cycle, ''))
        -- Hosting service formats
        WHEN 'monthly'        THEN COALESCE(p_amount, 0)
        WHEN 'quarterly'      THEN COALESCE(p_amount, 0) / 3
        WHEN 'semi-annually'  THEN COALESCE(p_amount, 0) / 6
        WHEN 'semiannually'   THEN COALESCE(p_amount, 0) / 6
        WHEN 'annually'       THEN COALESCE(p_amount, 0) / 12
        WHEN 'yearly'         THEN COALESCE(p_amount, 0) / 12
        WHEN 'biennially'     THEN COALESCE(p_amount, 0) / 24
        WHEN 'triennially'    THEN COALESCE(p_amount, 0) / 36
        -- Billable item formats (WHMCS uses singular capitalized, LOWER() handles case)
        WHEN 'months'         THEN COALESCE(p_amount, 0)
        WHEN 'month'          THEN COALESCE(p_amount, 0)
        WHEN 'years'          THEN COALESCE(p_amount, 0) / 12
        WHEN 'year'           THEN COALESCE(p_amount, 0) / 12
        WHEN 'weeks'          THEN COALESCE(p_amount, 0) * (52.0 / 12)
        WHEN 'week'           THEN COALESCE(p_amount, 0) * (52.0 / 12)
        WHEN 'days'           THEN COALESCE(p_amount, 0) * (365.0 / 12)
        WHEN 'day'            THEN COALESCE(p_amount, 0) * (365.0 / 12)
        ELSE 0::NUMERIC
    END
$$;

-- Refresh views to pick up the corrected cycle normalization.
REFRESH MATERIALIZED VIEW mv_mrr_current;
REFRESH MATERIALIZED VIEW mv_mrr_by_cycle;
