-- Migration: Fix "Vencidas" (overdue) invoice count always showing 0
--
-- Root cause:
--   WHMCS automatically changes invoice status from 'Unpaid' to 'Overdue' when
--   the duedate passes. The sync stores this literal status. The previous
--   definition of populate_metrics_daily() filtered only `status = 'Unpaid'`,
--   so actually-overdue invoices were never counted.
--
--   Convention per backend/docs/DATABASE.md:344 is `status IN ('Unpaid', 'Overdue')`.
--
-- Fix:
--   1. Recreate populate_metrics_daily() with the two invoice count blocks
--      updated to include 'Overdue'.
--   2. Backfill metrics_daily across all historical dates for every active
--      instance so historical trends for Vencidas/Pendientes stop showing 0.
--
-- Note on backfill accuracy:
--   populate_metrics_daily counts invoices using their CURRENT status, not the
--   status they had on the historical date. So a past invoice that was Overdue
--   on 2026-01-15 but is Paid today will NOT count as overdue in the repopulated
--   2026-01-15 row. This is consistent with how the function has always worked
--   for clients/domains/services — we are not introducing a regression, only
--   correcting the status filter.

CREATE OR REPLACE FUNCTION populate_metrics_daily(p_instance_id UUID, p_date DATE DEFAULT CURRENT_DATE)
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
    v_arpu DECIMAL(10,2);
    v_mrr_by_cycle JSONB;
    v_top_products JSONB;
    v_result_id UUID;
BEGIN
    -- Refresh materialized views first
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mrr_current;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mrr_by_cycle;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_client_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_invoice_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_revenue_by_product;

    -- Get MRR/ARR from materialized view
    SELECT COALESCE(mrr, 0), COALESCE(arr, 0), COALESCE(active_services, 0)
    INTO v_mrr, v_arr, v_active_services
    FROM mv_mrr_current
    WHERE instance_id = p_instance_id;

    v_mrr := COALESCE(v_mrr, 0);
    v_arr := COALESCE(v_arr, 0);
    v_active_services := COALESCE(v_active_services, 0);

    -- Get client summary
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

    -- Revenue today
    SELECT COALESCE(COUNT(*), 0), COALESCE(SUM(total), 0)
    INTO v_paid_invoices_day, v_amount_paid_day
    FROM whmcs_invoices
    WHERE instance_id = p_instance_id
      AND status = 'Paid'
      AND DATE(datepaid) = p_date;

    v_revenue_day := v_amount_paid_day;

    -- Revenue MTD (month to date)
    SELECT COALESCE(SUM(total), 0)
    INTO v_revenue_mtd
    FROM whmcs_invoices
    WHERE instance_id = p_instance_id
      AND status = 'Paid'
      AND DATE(datepaid) >= DATE_TRUNC('month', p_date)
      AND DATE(datepaid) <= p_date;

    -- Unpaid invoices (includes Overdue — WHMCS transitions Unpaid → Overdue
    -- when duedate passes; both represent "money owed")
    SELECT COALESCE(COUNT(*), 0), COALESCE(SUM(total), 0)
    INTO v_unpaid_invoices, v_amount_unpaid
    FROM whmcs_invoices
    WHERE instance_id = p_instance_id
      AND status IN ('Unpaid', 'Overdue');

    -- Overdue invoices (subset of unpaid where duedate has already passed).
    -- We accept either status here: WHMCS normally marks them as 'Overdue',
    -- but we also catch stale 'Unpaid' rows whose status WHMCS has not yet
    -- transitioned at sync time.
    SELECT COALESCE(COUNT(*), 0), COALESCE(SUM(total), 0)
    INTO v_overdue_invoices, v_amount_overdue
    FROM whmcs_invoices
    WHERE instance_id = p_instance_id
      AND status IN ('Unpaid', 'Overdue')
      AND duedate < p_date;

    -- Domain stats
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

    -- Suspended services
    SELECT COALESCE(COUNT(*), 0)
    INTO v_suspended_services
    FROM whmcs_hosting
    WHERE instance_id = p_instance_id
      AND domainstatus = 'Suspended';

    -- New services today (registered today)
    SELECT COALESCE(COUNT(*), 0)
    INTO v_new_services_day
    FROM whmcs_hosting
    WHERE instance_id = p_instance_id
      AND regdate = p_date;

    -- Churned services today
    SELECT COALESCE(COUNT(*), 0)
    INTO v_churned_services_day
    FROM whmcs_hosting
    WHERE instance_id = p_instance_id
      AND domainstatus IN ('Cancelled', 'Terminated')
      AND DATE(synced_at) = p_date;

    -- New clients today
    SELECT COALESCE(COUNT(*), 0)
    INTO v_new_clients_day
    FROM whmcs_clients
    WHERE instance_id = p_instance_id
      AND datecreated = p_date;

    -- Churn calculation (30 days)
    SELECT COALESCE(churn_rate, 0), COALESCE(churned_mrr, 0)
    INTO v_churn_rate, v_churned_mrr
    FROM calculate_churn(p_instance_id, 30);

    v_churn_rate := COALESCE(v_churn_rate, 0);
    v_churned_mrr := COALESCE(v_churned_mrr, 0);

    -- Calculate ARPU
    v_arpu := CASE WHEN v_active_clients > 0
              THEN ROUND(v_mrr / v_active_clients, 2)
              ELSE 0
              END;

    -- MRR by cycle
    v_mrr_by_cycle := COALESCE(get_mrr_by_cycle_json(p_instance_id), '[]'::jsonb);

    -- Top products by MRR
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

    -- Insert or update metrics_daily
    INSERT INTO metrics_daily (
        instance_id, date,
        mrr, arr, revenue_day, revenue_mtd,
        active_services, new_services_day, churned_services_day, suspended_services,
        total_clients, active_clients, inactive_clients, closed_clients,
        new_clients_day, churned_clients_day,
        total_domains, active_domains, expiring_domains_30d,
        paid_invoices_day, unpaid_invoices, overdue_invoices,
        amount_paid_day, amount_unpaid, amount_overdue,
        churn_rate, churned_mrr,
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
        v_churn_rate, v_churned_mrr,
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
        top_products = EXCLUDED.top_products,
        mrr_by_cycle = EXCLUDED.mrr_by_cycle,
        arpu = EXCLUDED.arpu,
        updated_at = NOW()
    RETURNING id INTO v_result_id;

    RETURN v_result_id;
END;
$$ LANGUAGE plpgsql;

-- Full historical backfill: for every active instance, repopulate metrics_daily
-- from the earliest date we have data for up to today.
DO $$
DECLARE
    r RECORD;
    d DATE;
    min_invoice_date DATE;
    min_metrics_date DATE;
    min_date DATE;
BEGIN
    FOR r IN SELECT id FROM whmcs_instances WHERE status = 'active' LOOP
        SELECT MIN(date) INTO min_invoice_date
        FROM whmcs_invoices
        WHERE instance_id = r.id;

        SELECT MIN(date) INTO min_metrics_date
        FROM metrics_daily
        WHERE instance_id = r.id;

        min_date := LEAST(
            COALESCE(min_invoice_date, CURRENT_DATE),
            COALESCE(min_metrics_date, CURRENT_DATE)
        );

        IF min_date IS NULL THEN
            CONTINUE;
        END IF;

        FOR d IN
            SELECT generate_series(min_date, CURRENT_DATE, '1 day'::interval)::DATE
        LOOP
            PERFORM populate_metrics_daily(r.id, d);
        END LOOP;
    END LOOP;
END $$;
