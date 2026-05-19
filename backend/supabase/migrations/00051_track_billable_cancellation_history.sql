-- Track when recurring billable items get cancelled.
--
-- Problem: whmcs_billable_items has no cancellation timestamp. Once a row
-- flips from invoice_action=4 (Recurring) to 0 (Stop), we lose the date.
-- 00050's churn calculation uses duedate as a proxy, which counts old
-- cancellations as new churn whenever duedate happens to remain in the
-- future (typical for annual items where duedate is set to the next
-- scheduled charge that will never run).
--
-- Fix: add cancelled_at and populate it via a BEFORE UPDATE trigger that
-- fires on the 4→other transition. Going forward we know exactly when a
-- cancellation occurred. Existing cancelled rows keep cancelled_at = NULL
-- and continue to use the duedate proxy in calculate_churn (no backfill,
-- so no one-time churn spike).

-- ---------------------------------------------------------------------
-- 1. Column
-- ---------------------------------------------------------------------

ALTER TABLE whmcs_billable_items
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_whmcs_billable_items_cancelled_at
    ON whmcs_billable_items (instance_id, cancelled_at)
    WHERE cancelled_at IS NOT NULL;

COMMENT ON COLUMN whmcs_billable_items.cancelled_at IS
'Timestamp when invoice_action transitioned away from 4 (Recurring). NULL
either because the item is still recurring or because the cancellation
happened before this column existed (00051). Maintained by trigger.';

-- ---------------------------------------------------------------------
-- 2. Trigger
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION whmcs_billable_items_track_cancellation()
RETURNS TRIGGER AS $$
BEGIN
    -- Transition: currently recurring → no longer recurring
    IF OLD.invoice_action = 4
       AND COALESCE(NEW.invoice_action, -1) <> 4
       AND NEW.cancelled_at IS NULL
    THEN
        NEW.cancelled_at := NOW();
    -- Reactivation: no longer recurring → recurring again
    ELSIF OLD.invoice_action <> 4
          AND COALESCE(NEW.invoice_action, -1) = 4
    THEN
        NEW.cancelled_at := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS whmcs_billable_items_cancellation_trigger
    ON whmcs_billable_items;

CREATE TRIGGER whmcs_billable_items_cancellation_trigger
    BEFORE UPDATE ON whmcs_billable_items
    FOR EACH ROW
    EXECUTE FUNCTION whmcs_billable_items_track_cancellation();

-- ---------------------------------------------------------------------
-- 3. calculate_churn: prefer cancelled_at, fall back to duedate proxy
-- ---------------------------------------------------------------------

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

    -- HOSTING (unchanged)
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

    -- BILLABLE ITEMS — cancelled_at preferred, duedate fallback when NULL
    WITH billable_states AS (
        SELECT
            amount,
            recurcycle,
            invoice_action,
            duedate,
            cancelled_at,
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
            cancelled_at,
            (duedate - (invoicecount * cycle_months || ' months')::INTERVAL)::DATE AS start_date,
            FLOOR(GREATEST(0, (v_period_start - (duedate - (invoicecount * cycle_months || ' months')::INTERVAL)::DATE))::NUMERIC / cycle_months) AS cycles_at_start,
            FLOOR(GREATEST(0, (v_period_end   - (duedate - (invoicecount * cycle_months || ' months')::INTERVAL)::DATE))::NUMERIC / cycle_months) AS cycles_at_end
        FROM billable_states
    ),
    billable_active AS (
        SELECT
            amount,
            recurcycle,
            -- was_active at period_start:
            --   lifecycle covers period_start AND one of:
            --     - currently recurring (invoice_action = 4)
            --     - we observed the cancellation AFTER period_start (cancelled_at > period_start)
            --     - legacy: cancelled_at unknown, fall back to duedate >= period_start
            (start_date <= v_period_start
                AND (COALESCE(recurfor, 0) = 0 OR cycles_at_start < recurfor)
                AND (
                    invoice_action = 4
                    OR (cancelled_at IS NOT NULL AND cancelled_at::DATE > v_period_start)
                    OR (cancelled_at IS NULL     AND duedate >= v_period_start)
                )
            ) AS was_active,
            -- is_active at period_end: lifecycle still in range AND currently recurring
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

    -- DOMAINS (unchanged)
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
