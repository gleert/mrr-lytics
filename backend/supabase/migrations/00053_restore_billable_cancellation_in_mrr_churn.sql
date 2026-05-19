-- Regression fix: 00052 (MRR-weighted churn) accidentally restored the
-- count-based billable logic from 00049, dropping the 00050+00051
-- improvements that made cancelled billable items reachable.
--
-- Symptom: a 5125 € Magento retainer (invoice_action=0, cancelled_at=NULL,
-- duedate still in the future) should appear as billable churn but didn't,
-- because the WHERE invoice_action=4 filter excluded it before any
-- was_active / is_active check.
--
-- This migration re-applies the 00050+00051 billable logic on top of the
-- MRR-weighted active_mrr_start return shape from 00052.

CREATE OR REPLACE FUNCTION calculate_churn(p_instance_id UUID, p_period_days INTEGER DEFAULT 30)
RETURNS TABLE (
    period_start DATE,
    period_end DATE,
    churned_services BIGINT,
    churned_mrr NUMERIC,
    churn_rate NUMERIC,
    active_mrr_start NUMERIC,
    hosting_churned_services BIGINT,
    hosting_churned_mrr NUMERIC,
    hosting_churn_rate NUMERIC,
    hosting_active_mrr_start NUMERIC,
    billable_churned_services BIGINT,
    billable_churned_mrr NUMERIC,
    billable_churn_rate NUMERIC,
    billable_active_mrr_start NUMERIC,
    domains_churned_services BIGINT,
    domains_churned_mrr NUMERIC,
    domains_churn_rate NUMERIC,
    domains_active_mrr_start NUMERIC
) AS $$
DECLARE
    v_period_start DATE;
    v_period_end DATE;
    v_h_active_mrr NUMERIC; v_h_churned BIGINT; v_h_churned_mrr NUMERIC;
    v_b_active_mrr NUMERIC; v_b_churned BIGINT; v_b_churned_mrr NUMERIC;
    v_d_active_mrr NUMERIC; v_d_churned BIGINT; v_d_churned_mrr NUMERIC;
BEGIN
    v_period_end := CURRENT_DATE;
    v_period_start := v_period_end - p_period_days;

    -- HOSTING (unchanged from 00052)
    WITH service_states AS (
        SELECT
            amount, billingcycle,
            CASE
                WHEN regdate IS NULL OR regdate > v_period_start                       THEN FALSE
                WHEN terminationdate IS NOT NULL AND terminationdate <= v_period_start THEN FALSE
                WHEN terminationdate IS NOT NULL AND terminationdate > v_period_start  THEN TRUE
                ELSE domainstatus IN ('Active', 'Suspended')
            END AS was_active,
            CASE
                WHEN regdate IS NULL OR regdate > v_period_end                         THEN FALSE
                WHEN terminationdate IS NOT NULL AND terminationdate <= v_period_end   THEN FALSE
                WHEN terminationdate IS NOT NULL AND terminationdate > v_period_end    THEN TRUE
                ELSE domainstatus IN ('Active', 'Suspended')
            END AS is_active
        FROM whmcs_hosting WHERE instance_id = p_instance_id
    )
    SELECT
        COALESCE(SUM(normalize_to_monthly(amount, billingcycle)) FILTER (WHERE was_active), 0),
        COUNT(*) FILTER (WHERE was_active AND NOT is_active),
        COALESCE(SUM(normalize_to_monthly(amount, billingcycle))
            FILTER (WHERE was_active AND NOT is_active), 0)
    INTO v_h_active_mrr, v_h_churned, v_h_churned_mrr
    FROM service_states;

    -- BILLABLE ITEMS — restore 00051 logic on top of MRR-weighted shape.
    -- Filter no longer excludes invoice_action != 4; cancelled items
    -- (invoice_action=0) are reachable so they can be detected as churn.
    WITH billable_states AS (
        SELECT
            amount, recurcycle, invoice_action, duedate, cancelled_at,
            CASE
                WHEN LOWER(COALESCE(recurcycle, '')) IN ('months', 'month') THEN GREATEST(COALESCE(recur, 1), 1)
                WHEN LOWER(COALESCE(recurcycle, '')) IN ('years',  'year')  THEN 12 * GREATEST(COALESCE(recur, 1), 1)
                ELSE 1
            END AS cycle_months,
            invoicecount, recurfor
        FROM whmcs_billable_items
        WHERE instance_id = p_instance_id
          AND COALESCE(invoicecount, 0) > 0
          AND duedate IS NOT NULL
    ),
    billable_with_start AS (
        SELECT
            amount, recurcycle, cycle_months, recurfor, invoice_action, duedate, cancelled_at,
            (duedate - (invoicecount * cycle_months || ' months')::INTERVAL)::DATE AS start_date,
            FLOOR(GREATEST(0, (v_period_start - (duedate - (invoicecount * cycle_months || ' months')::INTERVAL)::DATE))::NUMERIC / cycle_months) AS cycles_at_start,
            FLOOR(GREATEST(0, (v_period_end   - (duedate - (invoicecount * cycle_months || ' months')::INTERVAL)::DATE))::NUMERIC / cycle_months) AS cycles_at_end
        FROM billable_states
    ),
    billable_active AS (
        SELECT
            amount, recurcycle,
            -- was_active at period_start: lifecycle covers period_start AND one of
            --   - currently recurring
            --   - cancellation observed after period_start
            --   - legacy cancellation (cancelled_at unknown) with duedate still in the future
            (start_date <= v_period_start
                AND (COALESCE(recurfor, 0) = 0 OR cycles_at_start < recurfor)
                AND (
                    invoice_action = 4
                    OR (cancelled_at IS NOT NULL AND cancelled_at::DATE > v_period_start)
                    OR (cancelled_at IS NULL     AND duedate >= v_period_start)
                )
            ) AS was_active,
            (start_date <= v_period_end
                AND (COALESCE(recurfor, 0) = 0 OR cycles_at_end < recurfor)
                AND invoice_action = 4
            ) AS is_active
        FROM billable_with_start
    )
    SELECT
        COALESCE(SUM(normalize_to_monthly(amount, recurcycle)) FILTER (WHERE was_active), 0),
        COUNT(*) FILTER (WHERE was_active AND NOT is_active),
        COALESCE(SUM(normalize_to_monthly(amount, recurcycle))
            FILTER (WHERE was_active AND NOT is_active), 0)
    INTO v_b_active_mrr, v_b_churned, v_b_churned_mrr
    FROM billable_active;

    -- DOMAINS (unchanged from 00052)
    WITH domain_states AS (
        SELECT
            recurringamount, registrationperiod, status, expirydate,
            (expirydate IS NOT NULL AND expirydate >= v_period_start) AS was_active,
            (expirydate IS NOT NULL
                AND expirydate >= v_period_start
                AND expirydate <  v_period_end
                AND COALESCE(status, '') <> 'Active') AS churned,
            CASE
                WHEN COALESCE(recurringamount, 0) > 0 AND COALESCE(registrationperiod, 0) > 0
                THEN recurringamount / (registrationperiod * 12)
                ELSE 0
            END AS monthly_amount
        FROM whmcs_domains WHERE instance_id = p_instance_id
    )
    SELECT
        COALESCE(SUM(monthly_amount) FILTER (WHERE was_active), 0),
        COUNT(*) FILTER (WHERE churned),
        COALESCE(SUM(monthly_amount) FILTER (WHERE churned), 0)
    INTO v_d_active_mrr, v_d_churned, v_d_churned_mrr
    FROM domain_states;

    RETURN QUERY SELECT
        v_period_start, v_period_end,
        v_h_churned + v_b_churned + v_d_churned,
        v_h_churned_mrr + v_b_churned_mrr + v_d_churned_mrr,
        CASE
            WHEN (v_h_active_mrr + v_b_active_mrr + v_d_active_mrr) > 0
            THEN ROUND(
                ((v_h_churned_mrr + v_b_churned_mrr + v_d_churned_mrr)
                    / (v_h_active_mrr + v_b_active_mrr + v_d_active_mrr)) * 100, 2)
            ELSE 0::NUMERIC
        END,
        v_h_active_mrr + v_b_active_mrr + v_d_active_mrr,
        v_h_churned, v_h_churned_mrr,
        CASE WHEN v_h_active_mrr > 0 THEN ROUND((v_h_churned_mrr / v_h_active_mrr) * 100, 2) ELSE 0::NUMERIC END,
        v_h_active_mrr,
        v_b_churned, v_b_churned_mrr,
        CASE WHEN v_b_active_mrr > 0 THEN ROUND((v_b_churned_mrr / v_b_active_mrr) * 100, 2) ELSE 0::NUMERIC END,
        v_b_active_mrr,
        v_d_churned, v_d_churned_mrr,
        CASE WHEN v_d_active_mrr > 0 THEN ROUND((v_d_churned_mrr / v_d_active_mrr) * 100, 2) ELSE 0::NUMERIC END,
        v_d_active_mrr;
END;
$$ LANGUAGE plpgsql STABLE;
