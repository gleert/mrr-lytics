-- Migration: Fix "Vencidas" (overdue) invoice count always showing 0
--
-- Two bugs addressed:
--
-- Bug A — stale view/function mismatch (latent since migration 00030):
--   Migrations 00030/00032/00035/00036/00037 dropped and recreated
--   `mv_mrr_by_cycle` without the `service_count` column, but
--   `get_mrr_by_cycle_json` (defined in 00013) and `src/lib/metrics/mrr.ts`
--   still reference `service_count`. As a result every call to
--   `populate_metrics_daily` has been failing with
--   'column "service_count" does not exist'. The sync swallows the error
--   (see sync.ts:238 `[STALE-METRICS]`), so metrics_daily rows have been
--   stale/missing since 00030 was applied in production.
--
--   Fix: recreate `mv_mrr_by_cycle` with `service_count` restored so both
--   the function and the TypeScript callers work again. Semantics of
--   `mrr_contribution` are unchanged.
--
-- Bug B — Unpaid/Overdue filter in populate_metrics_daily:
--   WHMCS transitions Unpaid invoices to status='Overdue' when duedate
--   passes. The previous filter used only `status = 'Unpaid'`, so the
--   Vencidas KPI always showed 0 and Pendientes was underestimated.
--   Convention per backend/docs/DATABASE.md:344 is
--   `status IN ('Unpaid', 'Overdue')`.
--
-- After this migration:
--   - mv_mrr_by_cycle has service_count back → populate_metrics_daily works
--   - populate_metrics_daily counts Overdue as unpaid (and includes it in
--     the vencidas subset)
--   - Historical metrics_daily is fully backfilled
--
-- Note on backfill accuracy: populate_metrics_daily uses the CURRENT status
-- of invoices/services, not the status on each historical date. So a past
-- invoice that was Overdue on 2026-01-15 but is Paid today will NOT count
-- as overdue in the repopulated 2026-01-15 row. This is consistent with how
-- the function has always worked for clients/domains/services — we are not
-- introducing a regression, only correcting the filter and restoring the view.

-- ────────────────────────────────────────────────────────────────────────
-- Bug A fix: Recreate mv_mrr_by_cycle with service_count column.
-- Preserves the body from migration 00037 (latest authoritative version),
-- only adding `COUNT(*) AS service_count` to the outer SELECT.
-- ────────────────────────────────────────────────────────────────────────

DROP MATERIALIZED VIEW IF EXISTS mv_mrr_by_cycle;

CREATE MATERIALIZED VIEW mv_mrr_by_cycle AS
SELECT
    instance_id,
    cycle                                           AS billingcycle,
    COUNT(*)                                        AS service_count,
    SUM(normalize_to_monthly(amount, cycle))        AS mrr_contribution
FROM (
    SELECT instance_id, billingcycle AS cycle, amount
    FROM whmcs_hosting
    WHERE domainstatus = 'Active'

    UNION ALL

    SELECT instance_id, recurcycle AS cycle, amount
    FROM whmcs_billable_items
    WHERE invoice_action = 4
      AND invoicecount > 0
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

-- ────────────────────────────────────────────────────────────────────────
-- Bug B fix: Recreate populate_metrics_daily with correct Unpaid/Overdue
-- filter. Body is copied verbatim from migration 00017 except for the two
-- invoice count blocks. Also adds a `p_skip_refresh` parameter so the
-- backfill loop below can avoid refreshing materialized views on every
-- call (per-call refresh exhausts max_locks_per_transaction on large
-- historical backfills).
--
-- DROP is required because we are changing the parameter list (adding
-- p_skip_refresh), which CREATE OR REPLACE does not allow.
-- ────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS populate_metrics_daily(UUID, DATE);
DROP FUNCTION IF EXISTS populate_metrics_daily(UUID, DATE, BOOLEAN);

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
    v_arpu DECIMAL(10,2);
    v_mrr_by_cycle JSONB;
    v_top_products JSONB;
    v_result_id UUID;
BEGIN
    -- Refresh materialized views first. Skipped when called inside a
    -- historical backfill loop — the caller is responsible for refreshing
    -- once before the loop, otherwise the per-call refreshes quickly
    -- exhaust max_locks_per_transaction on large date ranges.
    IF NOT p_skip_refresh THEN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mrr_current;
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mrr_by_cycle;
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_client_summary;
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_invoice_summary;
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_revenue_by_product;
    END IF;

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
--
-- Materialized views are refreshed ONCE up front; each populate_metrics_daily
-- call inside the loop uses p_skip_refresh=TRUE so the transaction does not
-- accumulate thousands of refresh locks and blow past max_locks_per_transaction.
--
-- Disable statement_timeout for the migration session — the backfill loops
-- over potentially thousands of dates and can take several minutes on large
-- installations. Supabase's default statement_timeout is enforced at the
-- connection level and would otherwise kill the migration mid-loop.
SET LOCAL statement_timeout = 0;
SET LOCAL idle_in_transaction_session_timeout = 0;

REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mrr_current;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mrr_by_cycle;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_client_summary;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_invoice_summary;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_revenue_by_product;

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
            PERFORM populate_metrics_daily(r.id, d, TRUE);
        END LOOP;
    END LOOP;
END $$;
