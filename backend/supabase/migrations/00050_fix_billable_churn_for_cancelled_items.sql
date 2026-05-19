-- Fix billable-items churn so cancelled recurring items get counted.
--
-- Bug: 00049's calculate_churn() filtered `WHERE invoice_action = 4` in the
-- billable CTE. When a recurring billable item is cancelled in WHMCS its
-- invoice_action flips from 4 (Recurring) to 0 (Stop), so the row was
-- excluded from the calculation entirely — it never registered as "was
-- active" and therefore couldn't register as churn either.
--
-- Real-world example: a 5.125€ monthly retainer cancelled in the last
-- 30 days never showed in the churn KPI.
--
-- Fix:
--   * Drop `invoice_action = 4` from the WHERE clause.
--   * Move `invoice_action = 4` into the is_active definition (only currently-
--     recurring items count as active *now*).
--   * Guard was_active with `invoice_action = 4 OR duedate >= period_start`
--     so items cancelled long before the period (duedate stale, far in the
--     past) don't get counted every snapshot. Effectively: a cancelled item
--     is only "was active at period_start" if its last scheduled charge
--     hadn't already passed before that date.

CREATE OR REPLACE FUNCTION calculate_churn(p_instance_id UUID, p_period_days INTEGER DEFAULT 30)
RETURNS TABLE (
    period_start DATE,
    period_end DATE,
    churned_services BIGINT,
    churned_mrr NUMERIC,
    churn_rate NUMERIC,
    hosting_churned_services BIGINT,
    hosting_churned_mrr NUMERIC,
    hosting_churn_rate NUMERIC,
    billable_churned_services BIGINT,
    billable_churned_mrr NUMERIC,
    billable_churn_rate NUMERIC,
    domains_churned_services BIGINT,
    domains_churned_mrr NUMERIC,
    domains_churn_rate NUMERIC
) AS $$
DECLARE
    v_period_start DATE;
    v_period_end DATE;
    v_h_active_start BIGINT;  v_h_churned BIGINT;  v_h_churned_mrr NUMERIC;
    v_b_active_start BIGINT;  v_b_churned BIGINT;  v_b_churned_mrr NUMERIC;
    v_d_active_start BIGINT;  v_d_churned BIGINT;  v_d_churned_mrr NUMERIC;
BEGIN
    v_period_end := CURRENT_DATE;
    v_period_start := v_period_end - p_period_days;

    -- ---- HOSTING ---- (unchanged from 00049)
    WITH service_states AS (
        SELECT
            amount,
            billingcycle,
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
        FROM whmcs_hosting
        WHERE instance_id = p_instance_id
    )
    SELECT
        COUNT(*) FILTER (WHERE was_active),
        COUNT(*) FILTER (WHERE was_active AND NOT is_active),
        COALESCE(
            SUM(normalize_to_monthly(amount, billingcycle))
                FILTER (WHERE was_active AND NOT is_active),
            0
        )
    INTO v_h_active_start, v_h_churned, v_h_churned_mrr
    FROM service_states;

    -- ---- BILLABLE ITEMS ---- (cancelled items now reachable)
    WITH billable_states AS (
        SELECT
            amount,
            recurcycle,
            invoice_action,
            duedate,
            CASE
                WHEN LOWER(COALESCE(recurcycle, '')) IN ('months', 'month') THEN GREATEST(COALESCE(recur, 1), 1)
                WHEN LOWER(COALESCE(recurcycle, '')) IN ('years',  'year')  THEN 12 * GREATEST(COALESCE(recur, 1), 1)
                ELSE 1
            END AS cycle_months,
            invoicecount,
            recurfor
        FROM whmcs_billable_items
        WHERE instance_id = p_instance_id
          AND COALESCE(invoicecount, 0) > 0
          AND duedate IS NOT NULL
    ),
    billable_with_start AS (
        SELECT
            amount,
            recurcycle,
            cycle_months,
            recurfor,
            invoice_action,
            duedate,
            (duedate - (invoicecount * cycle_months || ' months')::INTERVAL)::DATE AS start_date,
            FLOOR(GREATEST(0, (v_period_start - (duedate - (invoicecount * cycle_months || ' months')::INTERVAL)::DATE))::NUMERIC / cycle_months) AS cycles_at_start,
            FLOOR(GREATEST(0, (v_period_end   - (duedate - (invoicecount * cycle_months || ' months')::INTERVAL)::DATE))::NUMERIC / cycle_months) AS cycles_at_end
        FROM billable_states
    ),
    billable_active AS (
        SELECT
            amount,
            recurcycle,
            -- Was active at period_start if:
            --   lifecycle window covers period_start (start_date <= period_start AND not past recurfor)
            --   AND either currently recurring (invoice_action=4) OR last scheduled charge (duedate)
            --   was still on/after period_start. The duedate guard prevents items cancelled long
            --   ago (duedate stale, far in the past) from being counted as churn every snapshot.
            (start_date <= v_period_start
                AND (COALESCE(recurfor, 0) = 0 OR cycles_at_start < recurfor)
                AND (invoice_action = 4 OR duedate >= v_period_start)
            ) AS was_active,
            -- Is active at period_end if lifecycle still in range AND still recurring now.
            (start_date <= v_period_end
                AND (COALESCE(recurfor, 0) = 0 OR cycles_at_end < recurfor)
                AND invoice_action = 4
            ) AS is_active
        FROM billable_with_start
    )
    SELECT
        COUNT(*) FILTER (WHERE was_active),
        COUNT(*) FILTER (WHERE was_active AND NOT is_active),
        COALESCE(
            SUM(normalize_to_monthly(amount, recurcycle))
                FILTER (WHERE was_active AND NOT is_active),
            0
        )
    INTO v_b_active_start, v_b_churned, v_b_churned_mrr
    FROM billable_active;

    -- ---- DOMAINS ---- (unchanged from 00049)
    WITH domain_states AS (
        SELECT
            recurringamount,
            registrationperiod,
            status,
            expirydate,
            (expirydate IS NOT NULL AND expirydate >= v_period_start) AS was_active,
            (expirydate IS NOT NULL
                AND expirydate >= v_period_start
                AND expirydate <  v_period_end
                AND COALESCE(status, '') <> 'Active') AS churned
        FROM whmcs_domains
        WHERE instance_id = p_instance_id
    )
    SELECT
        COUNT(*) FILTER (WHERE was_active),
        COUNT(*) FILTER (WHERE churned),
        COALESCE(
            SUM(
                CASE
                    WHEN COALESCE(recurringamount, 0) > 0 AND COALESCE(registrationperiod, 0) > 0
                    THEN recurringamount / (registrationperiod * 12)
                    ELSE 0
                END
            ) FILTER (WHERE churned),
            0
        )
    INTO v_d_active_start, v_d_churned, v_d_churned_mrr
    FROM domain_states;

    RETURN QUERY SELECT
        v_period_start,
        v_period_end,
        v_h_churned + v_b_churned + v_d_churned,
        v_h_churned_mrr + v_b_churned_mrr + v_d_churned_mrr,
        CASE
            WHEN (v_h_active_start + v_b_active_start + v_d_active_start) > 0
            THEN ROUND(
                ((v_h_churned + v_b_churned + v_d_churned)::NUMERIC
                    / (v_h_active_start + v_b_active_start + v_d_active_start)) * 100,
                2
            )
            ELSE 0::NUMERIC
        END,
        v_h_churned,
        v_h_churned_mrr,
        CASE WHEN v_h_active_start > 0
             THEN ROUND((v_h_churned::NUMERIC / v_h_active_start) * 100, 2)
             ELSE 0::NUMERIC END,
        v_b_churned,
        v_b_churned_mrr,
        CASE WHEN v_b_active_start > 0
             THEN ROUND((v_b_churned::NUMERIC / v_b_active_start) * 100, 2)
             ELSE 0::NUMERIC END,
        v_d_churned,
        v_d_churned_mrr,
        CASE WHEN v_d_active_start > 0
             THEN ROUND((v_d_churned::NUMERIC / v_d_active_start) * 100, 2)
             ELSE 0::NUMERIC END;
END;
$$ LANGUAGE plpgsql STABLE;
