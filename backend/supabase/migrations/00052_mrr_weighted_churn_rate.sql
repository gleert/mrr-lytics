-- Convert churn_rate from service-count-based to MRR-weighted across all
-- categories (combined, hosting, billable, domains).
--
-- Before: churn_rate = (services_churned / services_active_at_start) × 100
-- After:  churn_rate = (mrr_churned        / mrr_active_at_start)      × 100
--
-- Rationale: with a catalog that mixes 0.83 €/mo domains and 5000 €/mo
-- billable items, a count-based rate misrepresents revenue impact. The
-- MRR-weighted version is the standard "revenue churn rate" in SaaS.
--
-- Multi-instance aggregation: to compute a portfolio-level MRR-weighted
-- rate correctly we also need active_mrr_at_period_start per instance.
-- calculate_churn now returns it, populate_metrics_daily stores it, and
-- the JS aggregation can do SUM(churned_mrr) / SUM(active_mrr_start)
-- instead of averaging per-instance rates (which gives equal weight to a
-- 100 € instance and a 10 000 € one).
--
-- Historical metrics_daily rows keep their old (count-based) churn_rate
-- and have NULL active_mrr_at_period_start. The trend chart will have a
-- discontinuity at the deploy date.

DROP FUNCTION IF EXISTS calculate_churn(UUID, INTEGER);

CREATE OR REPLACE FUNCTION calculate_churn(p_instance_id UUID, p_period_days INTEGER DEFAULT 30)
RETURNS TABLE (
    period_start DATE,
    period_end DATE,
    -- Combined totals (hosting + billable + domains)
    churned_services BIGINT,
    churned_mrr NUMERIC,
    churn_rate NUMERIC,
    active_mrr_start NUMERIC,
    -- Hosting breakdown
    hosting_churned_services BIGINT,
    hosting_churned_mrr NUMERIC,
    hosting_churn_rate NUMERIC,
    hosting_active_mrr_start NUMERIC,
    -- Billable items breakdown
    billable_churned_services BIGINT,
    billable_churned_mrr NUMERIC,
    billable_churn_rate NUMERIC,
    billable_active_mrr_start NUMERIC,
    -- Domains breakdown
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

    -- ---- HOSTING ----
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
        COALESCE(SUM(normalize_to_monthly(amount, billingcycle)) FILTER (WHERE was_active), 0),
        COUNT(*) FILTER (WHERE was_active AND NOT is_active),
        COALESCE(SUM(normalize_to_monthly(amount, billingcycle))
            FILTER (WHERE was_active AND NOT is_active), 0)
    INTO v_h_active_mrr, v_h_churned, v_h_churned_mrr
    FROM service_states;

    -- ---- BILLABLE ITEMS ----
    WITH billable_states AS (
        SELECT
            amount,
            recurcycle,
            CASE
                WHEN LOWER(COALESCE(recurcycle, '')) IN ('months', 'month') THEN GREATEST(COALESCE(recur, 1), 1)
                WHEN LOWER(COALESCE(recurcycle, '')) IN ('years',  'year')  THEN 12 * GREATEST(COALESCE(recur, 1), 1)
                ELSE 1
            END AS cycle_months,
            duedate,
            invoicecount,
            recurfor
        FROM whmcs_billable_items
        WHERE instance_id = p_instance_id
          AND invoice_action = 4
          AND COALESCE(invoicecount, 0) > 0
          AND duedate IS NOT NULL
    ),
    billable_with_start AS (
        SELECT
            amount,
            recurcycle,
            cycle_months,
            recurfor,
            (duedate - (invoicecount * cycle_months || ' months')::INTERVAL)::DATE AS start_date,
            FLOOR(GREATEST(0, (v_period_start - (duedate - (invoicecount * cycle_months || ' months')::INTERVAL)::DATE))::NUMERIC / cycle_months) AS cycles_at_start,
            FLOOR(GREATEST(0, (v_period_end   - (duedate - (invoicecount * cycle_months || ' months')::INTERVAL)::DATE))::NUMERIC / cycle_months) AS cycles_at_end
        FROM billable_states
    ),
    billable_active AS (
        SELECT
            amount,
            recurcycle,
            (start_date <= v_period_start
                AND (COALESCE(recurfor, 0) = 0 OR cycles_at_start < recurfor)) AS was_active,
            (start_date <= v_period_end
                AND (COALESCE(recurfor, 0) = 0 OR cycles_at_end   < recurfor)) AS is_active
        FROM billable_with_start
    )
    SELECT
        COALESCE(SUM(normalize_to_monthly(amount, recurcycle)) FILTER (WHERE was_active), 0),
        COUNT(*) FILTER (WHERE was_active AND NOT is_active),
        COALESCE(SUM(normalize_to_monthly(amount, recurcycle))
            FILTER (WHERE was_active AND NOT is_active), 0)
    INTO v_b_active_mrr, v_b_churned, v_b_churned_mrr
    FROM billable_active;

    -- ---- DOMAINS (proxy) ----
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
                AND COALESCE(status, '') <> 'Active') AS churned,
            CASE
                WHEN COALESCE(recurringamount, 0) > 0 AND COALESCE(registrationperiod, 0) > 0
                THEN recurringamount / (registrationperiod * 12)
                ELSE 0
            END AS monthly_amount
        FROM whmcs_domains
        WHERE instance_id = p_instance_id
    )
    SELECT
        COALESCE(SUM(monthly_amount) FILTER (WHERE was_active), 0),
        COUNT(*) FILTER (WHERE churned),
        COALESCE(SUM(monthly_amount) FILTER (WHERE churned), 0)
    INTO v_d_active_mrr, v_d_churned, v_d_churned_mrr
    FROM domain_states;

    -- Return combined + per-category, all rates MRR-weighted, with
    -- active_mrr_start exposed for cross-instance aggregation.
    RETURN QUERY SELECT
        v_period_start,
        v_period_end,
        v_h_churned + v_b_churned + v_d_churned,
        v_h_churned_mrr + v_b_churned_mrr + v_d_churned_mrr,
        CASE
            WHEN (v_h_active_mrr + v_b_active_mrr + v_d_active_mrr) > 0
            THEN ROUND(
                ((v_h_churned_mrr + v_b_churned_mrr + v_d_churned_mrr)
                    / (v_h_active_mrr + v_b_active_mrr + v_d_active_mrr)) * 100,
                2
            )
            ELSE 0::NUMERIC
        END,
        v_h_active_mrr + v_b_active_mrr + v_d_active_mrr,
        -- Hosting
        v_h_churned,
        v_h_churned_mrr,
        CASE WHEN v_h_active_mrr > 0
             THEN ROUND((v_h_churned_mrr / v_h_active_mrr) * 100, 2)
             ELSE 0::NUMERIC END,
        v_h_active_mrr,
        -- Billable
        v_b_churned,
        v_b_churned_mrr,
        CASE WHEN v_b_active_mrr > 0
             THEN ROUND((v_b_churned_mrr / v_b_active_mrr) * 100, 2)
             ELSE 0::NUMERIC END,
        v_b_active_mrr,
        -- Domains
        v_d_churned,
        v_d_churned_mrr,
        CASE WHEN v_d_active_mrr > 0
             THEN ROUND((v_d_churned_mrr / v_d_active_mrr) * 100, 2)
             ELSE 0::NUMERIC END,
        v_d_active_mrr;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_churn IS
'MRR-weighted churn rate broken down by category (hosting, billable items,
domains). Rate = churned MRR / active MRR at period start. Returns active_mrr_start
columns so multi-instance aggregation can do SUM(churned)/SUM(active) instead of
averaging per-instance rates (which would over-weight tiny instances). Domain churn
still uses an expirydate+status proxy.';

-- ---------------------------------------------------------------------
-- metrics_daily: add active_mrr_start columns for multi-instance aggregation
-- ---------------------------------------------------------------------

ALTER TABLE metrics_daily
    ADD COLUMN IF NOT EXISTS active_mrr_start          DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS hosting_active_mrr_start  DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS billable_active_mrr_start DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS domains_active_mrr_start  DECIMAL(12,2);

-- ---------------------------------------------------------------------
-- populate_metrics_daily: write the new active_mrr_start columns
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION populate_metrics_daily(
    p_instance_id UUID,
    p_date DATE DEFAULT CURRENT_DATE,
    p_skip_refresh BOOLEAN DEFAULT FALSE
)
RETURNS UUID AS $$
DECLARE
    v_mrr DECIMAL(12,2);
    v_arr DECIMAL(12,2);
    v_active_services INTEGER;
    v_active_clients INTEGER;
    v_inactive_clients INTEGER;
    v_closed_clients INTEGER;
    v_total_clients INTEGER;
    v_revenue_day DECIMAL(12,2);
    v_revenue_mtd DECIMAL(12,2);
    v_paid_invoices_day INTEGER;
    v_amount_paid_day DECIMAL(12,2);
    v_unpaid_invoices INTEGER;
    v_amount_unpaid DECIMAL(12,2);
    v_overdue_invoices INTEGER;
    v_amount_overdue DECIMAL(12,2);
    v_total_domains INTEGER;
    v_active_domains INTEGER;
    v_expiring_domains INTEGER;
    v_suspended_services INTEGER;
    v_new_services_day INTEGER;
    v_churned_services_day INTEGER;
    v_new_clients_day INTEGER;
    v_churn_rate DECIMAL(5,2);
    v_churned_mrr DECIMAL(12,2);
    v_active_mrr_start DECIMAL(12,2);
    v_churned_services_30d BIGINT;
    v_h_churned BIGINT; v_h_churned_mrr NUMERIC; v_h_churn_rate NUMERIC; v_h_active_mrr NUMERIC;
    v_b_churned BIGINT; v_b_churned_mrr NUMERIC; v_b_churn_rate NUMERIC; v_b_active_mrr NUMERIC;
    v_d_churned BIGINT; v_d_churned_mrr NUMERIC; v_d_churn_rate NUMERIC; v_d_active_mrr NUMERIC;
    v_arpu DECIMAL(10,2);
    v_mrr_by_cycle JSONB;
    v_top_products JSONB;
    v_result_id UUID;
BEGIN
    IF NOT p_skip_refresh THEN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mrr_current;
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mrr_by_cycle;
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_client_summary;
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_invoice_summary;
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_revenue_by_product;
    END IF;

    SELECT COALESCE(mrr, 0), COALESCE(arr, 0), COALESCE(active_services, 0)
    INTO v_mrr, v_arr, v_active_services
    FROM mv_mrr_current
    WHERE instance_id = p_instance_id;

    v_mrr := COALESCE(v_mrr, 0);
    v_arr := COALESCE(v_arr, 0);
    v_active_services := COALESCE(v_active_services, 0);

    SELECT
        COALESCE(active_clients, 0),
        COALESCE(inactive_clients, 0),
        COALESCE(closed_clients, 0),
        COALESCE(total_clients, 0)
    INTO v_active_clients, v_inactive_clients, v_closed_clients, v_total_clients
    FROM mv_client_summary
    WHERE instance_id = p_instance_id;

    v_active_clients := COALESCE(v_active_clients, 0);
    v_inactive_clients := COALESCE(v_inactive_clients, 0);
    v_closed_clients := COALESCE(v_closed_clients, 0);
    v_total_clients := COALESCE(v_total_clients, 0);

    SELECT COALESCE(COUNT(*), 0), COALESCE(SUM(total), 0)
    INTO v_paid_invoices_day, v_amount_paid_day
    FROM whmcs_invoices
    WHERE instance_id = p_instance_id
      AND status = 'Paid'
      AND DATE(datepaid) = p_date;

    v_revenue_day := v_amount_paid_day;

    SELECT COALESCE(SUM(total), 0)
    INTO v_revenue_mtd
    FROM whmcs_invoices
    WHERE instance_id = p_instance_id
      AND status = 'Paid'
      AND DATE(datepaid) >= DATE_TRUNC('month', p_date)
      AND DATE(datepaid) <= p_date;

    SELECT COALESCE(COUNT(*), 0), COALESCE(SUM(total), 0)
    INTO v_unpaid_invoices, v_amount_unpaid
    FROM whmcs_invoices
    WHERE instance_id = p_instance_id
      AND status IN ('Unpaid', 'Overdue');

    SELECT COALESCE(COUNT(*), 0), COALESCE(SUM(total), 0)
    INTO v_overdue_invoices, v_amount_overdue
    FROM whmcs_invoices
    WHERE instance_id = p_instance_id
      AND status IN ('Unpaid', 'Overdue')
      AND duedate < p_date;

    SELECT COALESCE(COUNT(*), 0)
    INTO v_total_domains
    FROM whmcs_domains
    WHERE instance_id = p_instance_id;

    SELECT COALESCE(COUNT(*), 0)
    INTO v_active_domains
    FROM whmcs_domains
    WHERE instance_id = p_instance_id
      AND status = 'Active';

    SELECT COALESCE(COUNT(*), 0)
    INTO v_expiring_domains
    FROM whmcs_domains
    WHERE instance_id = p_instance_id
      AND status = 'Active'
      AND expirydate BETWEEN p_date AND p_date + 30;

    SELECT COALESCE(COUNT(*), 0)
    INTO v_suspended_services
    FROM whmcs_hosting
    WHERE instance_id = p_instance_id
      AND domainstatus = 'Suspended';

    SELECT COALESCE(COUNT(*), 0)
    INTO v_new_services_day
    FROM whmcs_hosting
    WHERE instance_id = p_instance_id
      AND regdate = p_date;

    SELECT COALESCE(COUNT(*), 0)
    INTO v_churned_services_day
    FROM whmcs_hosting
    WHERE instance_id = p_instance_id
      AND domainstatus IN ('Cancelled', 'Terminated')
      AND DATE(synced_at) = p_date;

    SELECT COALESCE(COUNT(*), 0)
    INTO v_new_clients_day
    FROM whmcs_clients
    WHERE instance_id = p_instance_id
      AND datecreated = p_date;

    -- Churn (30 days) — pull combined + per-category breakdown + active_mrr
    SELECT
        COALESCE(churn_rate, 0),
        COALESCE(churned_mrr, 0),
        COALESCE(churned_services, 0),
        COALESCE(active_mrr_start, 0),
        COALESCE(hosting_churned_services, 0),
        COALESCE(hosting_churned_mrr, 0),
        COALESCE(hosting_churn_rate, 0),
        COALESCE(hosting_active_mrr_start, 0),
        COALESCE(billable_churned_services, 0),
        COALESCE(billable_churned_mrr, 0),
        COALESCE(billable_churn_rate, 0),
        COALESCE(billable_active_mrr_start, 0),
        COALESCE(domains_churned_services, 0),
        COALESCE(domains_churned_mrr, 0),
        COALESCE(domains_churn_rate, 0),
        COALESCE(domains_active_mrr_start, 0)
    INTO
        v_churn_rate, v_churned_mrr, v_churned_services_30d, v_active_mrr_start,
        v_h_churned, v_h_churned_mrr, v_h_churn_rate, v_h_active_mrr,
        v_b_churned, v_b_churned_mrr, v_b_churn_rate, v_b_active_mrr,
        v_d_churned, v_d_churned_mrr, v_d_churn_rate, v_d_active_mrr
    FROM calculate_churn(p_instance_id, 30);

    v_churn_rate := COALESCE(v_churn_rate, 0);
    v_churned_mrr := COALESCE(v_churned_mrr, 0);
    v_active_mrr_start := COALESCE(v_active_mrr_start, 0);

    v_arpu := CASE WHEN v_active_clients > 0
              THEN ROUND(v_mrr / v_active_clients, 2)
              ELSE 0
              END;

    v_mrr_by_cycle := COALESCE(get_mrr_by_cycle_json(p_instance_id), '[]'::jsonb);

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'product_id', product_id,
            'product_name', product_name,
            'product_type', product_type,
            'active_count', active_count,
            'mrr', mrr
        ) ORDER BY mrr DESC
    ), '[]'::jsonb)
    INTO v_top_products
    FROM (
        SELECT product_id, product_name, product_type, active_count, mrr
        FROM mv_revenue_by_product
        WHERE instance_id = p_instance_id
        ORDER BY mrr DESC
        LIMIT 10
    ) t;

    INSERT INTO metrics_daily (
        instance_id, date,
        mrr, arr, revenue_day, revenue_mtd,
        active_services, new_services_day, churned_services_day, suspended_services,
        total_clients, active_clients, inactive_clients, closed_clients,
        new_clients_day, churned_clients_day,
        total_domains, active_domains, expiring_domains_30d,
        paid_invoices_day, unpaid_invoices, overdue_invoices,
        amount_paid_day, amount_unpaid, amount_overdue,
        churn_rate, churned_mrr, active_mrr_start,
        hosting_churned_services, hosting_churned_mrr, hosting_churn_rate, hosting_active_mrr_start,
        billable_churned_services, billable_churned_mrr, billable_churn_rate, billable_active_mrr_start,
        domains_churned_services, domains_churned_mrr, domains_churn_rate, domains_active_mrr_start,
        top_products, mrr_by_cycle,
        arpu,
        updated_at
    ) VALUES (
        p_instance_id, p_date,
        v_mrr, v_arr, v_revenue_day, v_revenue_mtd,
        v_active_services, v_new_services_day, v_churned_services_day, v_suspended_services,
        v_total_clients, v_active_clients, v_inactive_clients, v_closed_clients,
        v_new_clients_day, 0,
        v_total_domains, v_active_domains, v_expiring_domains,
        v_paid_invoices_day, v_unpaid_invoices, v_overdue_invoices,
        v_amount_paid_day, v_amount_unpaid, v_amount_overdue,
        v_churn_rate, v_churned_mrr, v_active_mrr_start,
        v_h_churned, v_h_churned_mrr, v_h_churn_rate, v_h_active_mrr,
        v_b_churned, v_b_churned_mrr, v_b_churn_rate, v_b_active_mrr,
        v_d_churned, v_d_churned_mrr, v_d_churn_rate, v_d_active_mrr,
        v_top_products, v_mrr_by_cycle,
        v_arpu,
        NOW()
    )
    ON CONFLICT (instance_id, date) DO UPDATE SET
        mrr = EXCLUDED.mrr,
        arr = EXCLUDED.arr,
        revenue_day = EXCLUDED.revenue_day,
        revenue_mtd = EXCLUDED.revenue_mtd,
        active_services = EXCLUDED.active_services,
        new_services_day = EXCLUDED.new_services_day,
        churned_services_day = EXCLUDED.churned_services_day,
        suspended_services = EXCLUDED.suspended_services,
        total_clients = EXCLUDED.total_clients,
        active_clients = EXCLUDED.active_clients,
        inactive_clients = EXCLUDED.inactive_clients,
        closed_clients = EXCLUDED.closed_clients,
        new_clients_day = EXCLUDED.new_clients_day,
        total_domains = EXCLUDED.total_domains,
        active_domains = EXCLUDED.active_domains,
        expiring_domains_30d = EXCLUDED.expiring_domains_30d,
        paid_invoices_day = EXCLUDED.paid_invoices_day,
        unpaid_invoices = EXCLUDED.unpaid_invoices,
        overdue_invoices = EXCLUDED.overdue_invoices,
        amount_paid_day = EXCLUDED.amount_paid_day,
        amount_unpaid = EXCLUDED.amount_unpaid,
        amount_overdue = EXCLUDED.amount_overdue,
        churn_rate = EXCLUDED.churn_rate,
        churned_mrr = EXCLUDED.churned_mrr,
        active_mrr_start = EXCLUDED.active_mrr_start,
        hosting_churned_services  = EXCLUDED.hosting_churned_services,
        hosting_churned_mrr       = EXCLUDED.hosting_churned_mrr,
        hosting_churn_rate        = EXCLUDED.hosting_churn_rate,
        hosting_active_mrr_start  = EXCLUDED.hosting_active_mrr_start,
        billable_churned_services = EXCLUDED.billable_churned_services,
        billable_churned_mrr      = EXCLUDED.billable_churned_mrr,
        billable_churn_rate       = EXCLUDED.billable_churn_rate,
        billable_active_mrr_start = EXCLUDED.billable_active_mrr_start,
        domains_churned_services  = EXCLUDED.domains_churned_services,
        domains_churned_mrr       = EXCLUDED.domains_churned_mrr,
        domains_churn_rate        = EXCLUDED.domains_churn_rate,
        domains_active_mrr_start  = EXCLUDED.domains_active_mrr_start,
        top_products = EXCLUDED.top_products,
        mrr_by_cycle = EXCLUDED.mrr_by_cycle,
        arpu = EXCLUDED.arpu,
        updated_at = NOW()
    RETURNING id INTO v_result_id;

    RETURN v_result_id;
END;
$$ LANGUAGE plpgsql;
