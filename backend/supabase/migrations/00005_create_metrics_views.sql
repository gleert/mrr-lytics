-- Migration: Create materialized views for metrics
-- Description: Pre-calculated metrics views for performance (per instance)

-- MRR by instance (materialized for performance)
CREATE MATERIALIZED VIEW mv_mrr_current AS
SELECT 
    instance_id,
    SUM(
        CASE LOWER(COALESCE(billingcycle, ''))
            WHEN 'monthly' THEN COALESCE(amount, 0)
            WHEN 'quarterly' THEN COALESCE(amount, 0) / 3
            WHEN 'semi-annually' THEN COALESCE(amount, 0) / 6
            WHEN 'semiannually' THEN COALESCE(amount, 0) / 6
            WHEN 'annually' THEN COALESCE(amount, 0) / 12
            WHEN 'biennially' THEN COALESCE(amount, 0) / 24
            WHEN 'triennially' THEN COALESCE(amount, 0) / 36
            ELSE 0
        END
    ) as mrr,
    SUM(
        CASE LOWER(COALESCE(billingcycle, ''))
            WHEN 'monthly' THEN COALESCE(amount, 0) * 12
            WHEN 'quarterly' THEN COALESCE(amount, 0) * 4
            WHEN 'semi-annually' THEN COALESCE(amount, 0) * 2
            WHEN 'semiannually' THEN COALESCE(amount, 0) * 2
            WHEN 'annually' THEN COALESCE(amount, 0)
            WHEN 'biennially' THEN COALESCE(amount, 0) / 2
            WHEN 'triennially' THEN COALESCE(amount, 0) / 3
            ELSE 0
        END
    ) as arr,
    COUNT(*) as active_services,
    NOW() as calculated_at
FROM whmcs_hosting
WHERE domainstatus = 'Active'
GROUP BY instance_id;

CREATE UNIQUE INDEX idx_mv_mrr_instance ON mv_mrr_current(instance_id);

-- MRR by billing cycle (per instance)
CREATE MATERIALIZED VIEW mv_mrr_by_cycle AS
SELECT 
    instance_id,
    billingcycle,
    COUNT(*) as service_count,
    SUM(amount) as raw_amount,
    SUM(
        CASE LOWER(COALESCE(billingcycle, ''))
            WHEN 'monthly' THEN COALESCE(amount, 0)
            WHEN 'quarterly' THEN COALESCE(amount, 0) / 3
            WHEN 'semi-annually' THEN COALESCE(amount, 0) / 6
            WHEN 'semiannually' THEN COALESCE(amount, 0) / 6
            WHEN 'annually' THEN COALESCE(amount, 0) / 12
            WHEN 'biennially' THEN COALESCE(amount, 0) / 24
            WHEN 'triennially' THEN COALESCE(amount, 0) / 36
            ELSE 0
        END
    ) as mrr_contribution
FROM whmcs_hosting
WHERE domainstatus = 'Active'
GROUP BY instance_id, billingcycle;

CREATE UNIQUE INDEX idx_mv_mrr_cycle ON mv_mrr_by_cycle(instance_id, billingcycle);

-- Revenue by product (per instance)
CREATE MATERIALIZED VIEW mv_revenue_by_product AS
SELECT 
    h.instance_id,
    p.whmcs_id as product_id,
    p.name as product_name,
    p.type as product_type,
    COUNT(*) as active_count,
    SUM(h.amount) as total_raw_amount,
    SUM(
        CASE LOWER(COALESCE(h.billingcycle, ''))
            WHEN 'monthly' THEN COALESCE(h.amount, 0)
            WHEN 'quarterly' THEN COALESCE(h.amount, 0) / 3
            WHEN 'semi-annually' THEN COALESCE(h.amount, 0) / 6
            WHEN 'semiannually' THEN COALESCE(h.amount, 0) / 6
            WHEN 'annually' THEN COALESCE(h.amount, 0) / 12
            WHEN 'biennially' THEN COALESCE(h.amount, 0) / 24
            WHEN 'triennially' THEN COALESCE(h.amount, 0) / 36
            ELSE 0
        END
    ) as mrr
FROM whmcs_hosting h
LEFT JOIN whmcs_products p ON h.instance_id = p.instance_id AND h.packageid = p.whmcs_id
WHERE h.domainstatus = 'Active'
GROUP BY h.instance_id, p.whmcs_id, p.name, p.type;

CREATE UNIQUE INDEX idx_mv_revenue_product ON mv_revenue_by_product(instance_id, product_id);

-- Client summary per instance
CREATE MATERIALIZED VIEW mv_client_summary AS
SELECT 
    instance_id,
    COUNT(*) FILTER (WHERE status = 'Active') as active_clients,
    COUNT(*) FILTER (WHERE status = 'Inactive') as inactive_clients,
    COUNT(*) FILTER (WHERE status = 'Closed') as closed_clients,
    COUNT(*) as total_clients,
    MIN(datecreated) as first_client_date,
    MAX(datecreated) as last_client_date
FROM whmcs_clients
GROUP BY instance_id;

CREATE UNIQUE INDEX idx_mv_client_summary ON mv_client_summary(instance_id);

-- Invoice summary per instance
CREATE MATERIALIZED VIEW mv_invoice_summary AS
SELECT 
    instance_id,
    COUNT(*) FILTER (WHERE status = 'Paid') as paid_count,
    COUNT(*) FILTER (WHERE status = 'Unpaid') as unpaid_count,
    COUNT(*) FILTER (WHERE status = 'Cancelled') as cancelled_count,
    COALESCE(SUM(total) FILTER (WHERE status = 'Paid'), 0) as total_paid,
    COALESCE(SUM(total) FILTER (WHERE status = 'Unpaid'), 0) as total_unpaid,
    COALESCE(SUM(total) FILTER (WHERE status = 'Paid' AND datepaid >= NOW() - INTERVAL '30 days'), 0) as revenue_last_30_days,
    COALESCE(SUM(total) FILTER (WHERE status = 'Paid' AND datepaid >= NOW() - INTERVAL '90 days'), 0) as revenue_last_90_days
FROM whmcs_invoices
GROUP BY instance_id;

CREATE UNIQUE INDEX idx_mv_invoice_summary ON mv_invoice_summary(instance_id);

-- Helper function to normalize billing cycle to monthly
CREATE OR REPLACE FUNCTION normalize_to_monthly(p_amount NUMERIC, p_cycle TEXT)
RETURNS NUMERIC
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT CASE LOWER(COALESCE(p_cycle, ''))
        WHEN 'monthly' THEN COALESCE(p_amount, 0)
        WHEN 'quarterly' THEN COALESCE(p_amount, 0) / 3
        WHEN 'semi-annually' THEN COALESCE(p_amount, 0) / 6
        WHEN 'semiannually' THEN COALESCE(p_amount, 0) / 6
        WHEN 'annually' THEN COALESCE(p_amount, 0) / 12
        WHEN 'biennially' THEN COALESCE(p_amount, 0) / 24
        WHEN 'triennially' THEN COALESCE(p_amount, 0) / 36
        ELSE 0::NUMERIC
    END
$$;

-- Function to refresh all metrics views
CREATE OR REPLACE FUNCTION refresh_metrics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mrr_current;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mrr_by_cycle;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_revenue_by_product;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_client_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_invoice_summary;
END;
$$ LANGUAGE plpgsql;

-- Churn calculation function (per instance)
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
    v_churned_services BIGINT;
    v_churned_mrr NUMERIC;
    v_active_at_start BIGINT;
BEGIN
    v_period_end := CURRENT_DATE;
    v_period_start := v_period_end - p_period_days;
    
    -- Count services that became inactive/cancelled during the period
    SELECT 
        COUNT(*),
        COALESCE(SUM(normalize_to_monthly(amount, billingcycle)), 0)
    INTO v_churned_services, v_churned_mrr
    FROM whmcs_hosting
    WHERE instance_id = p_instance_id
      AND domainstatus IN ('Cancelled', 'Terminated', 'Suspended')
      AND synced_at >= v_period_start;
    
    -- Estimate active services at start of period (current active + churned)
    SELECT COUNT(*) + v_churned_services
    INTO v_active_at_start
    FROM whmcs_hosting
    WHERE instance_id = p_instance_id
      AND domainstatus = 'Active';
    
    RETURN QUERY SELECT 
        v_period_start,
        v_period_end,
        v_churned_services,
        v_churned_mrr,
        CASE WHEN v_active_at_start > 0 
             THEN ROUND((v_churned_services::NUMERIC / v_active_at_start) * 100, 2)
             ELSE 0 
        END;
END;
$$ LANGUAGE plpgsql STABLE;

-- Comments
COMMENT ON FUNCTION normalize_to_monthly IS 'Converts any billing cycle amount to monthly equivalent';
COMMENT ON MATERIALIZED VIEW mv_mrr_current IS 'Current MRR and ARR per WHMCS instance';
COMMENT ON FUNCTION calculate_churn IS 'Calculates churn metrics for a specific instance and period';
