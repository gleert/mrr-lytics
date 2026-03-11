-- Migration: Optimize metrics storage and calculations
-- Description: Add calculated columns, create metrics_daily table, and optimize queries
-- 
-- This migration:
-- 1. Adds pre-calculated columns to whmcs_hosting and whmcs_clients
-- 2. Creates metrics_daily table for fast historical queries
-- 3. Creates triggers and functions for automatic updates
-- 4. Adds optimized indexes

-- ============================================================================
-- PART 1: Add calculated columns to existing tables
-- ============================================================================

-- whmcs_hosting: Add monthly_amount (amount normalized to monthly)
ALTER TABLE whmcs_hosting 
ADD COLUMN IF NOT EXISTS monthly_amount DECIMAL(10,2) DEFAULT 0;

-- whmcs_hosting: Add termination tracking
ALTER TABLE whmcs_hosting 
ADD COLUMN IF NOT EXISTS terminationdate DATE;

ALTER TABLE whmcs_hosting 
ADD COLUMN IF NOT EXISTS suspendreason TEXT;

-- whmcs_clients: Add calculated metrics
ALTER TABLE whmcs_clients 
ADD COLUMN IF NOT EXISTS current_mrr DECIMAL(12,2) DEFAULT 0;

ALTER TABLE whmcs_clients 
ADD COLUMN IF NOT EXISTS services_count INTEGER DEFAULT 0;

ALTER TABLE whmcs_clients 
ADD COLUMN IF NOT EXISTS domains_count INTEGER DEFAULT 0;

ALTER TABLE whmcs_clients 
ADD COLUMN IF NOT EXISTS total_paid DECIMAL(12,2) DEFAULT 0;

ALTER TABLE whmcs_clients 
ADD COLUMN IF NOT EXISTS first_payment_date DATE;

ALTER TABLE whmcs_clients 
ADD COLUMN IF NOT EXISTS last_payment_date DATE;

ALTER TABLE whmcs_clients 
ADD COLUMN IF NOT EXISTS defaultgateway TEXT;

ALTER TABLE whmcs_clients 
ADD COLUMN IF NOT EXISTS groupid INTEGER;

ALTER TABLE whmcs_clients 
ADD COLUMN IF NOT EXISTS credit DECIMAL(10,2) DEFAULT 0;

ALTER TABLE whmcs_clients 
ADD COLUMN IF NOT EXISTS language TEXT;

ALTER TABLE whmcs_clients 
ADD COLUMN IF NOT EXISTS lastlogin TIMESTAMPTZ;

ALTER TABLE whmcs_clients 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE whmcs_clients 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ============================================================================
-- PART 2: Create metrics_daily table
-- ============================================================================

CREATE TABLE IF NOT EXISTS metrics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES whmcs_instances(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Revenue metrics
    mrr DECIMAL(12,2) DEFAULT 0,
    arr DECIMAL(12,2) DEFAULT 0,
    revenue_day DECIMAL(12,2) DEFAULT 0,
    revenue_mtd DECIMAL(12,2) DEFAULT 0,
    
    -- Service metrics
    active_services INTEGER DEFAULT 0,
    new_services_day INTEGER DEFAULT 0,
    churned_services_day INTEGER DEFAULT 0,
    suspended_services INTEGER DEFAULT 0,
    
    -- Client metrics
    total_clients INTEGER DEFAULT 0,
    active_clients INTEGER DEFAULT 0,
    inactive_clients INTEGER DEFAULT 0,
    closed_clients INTEGER DEFAULT 0,
    new_clients_day INTEGER DEFAULT 0,
    churned_clients_day INTEGER DEFAULT 0,
    
    -- Domain metrics
    total_domains INTEGER DEFAULT 0,
    active_domains INTEGER DEFAULT 0,
    expiring_domains_30d INTEGER DEFAULT 0,
    
    -- Invoice metrics
    paid_invoices_day INTEGER DEFAULT 0,
    unpaid_invoices INTEGER DEFAULT 0,
    overdue_invoices INTEGER DEFAULT 0,
    amount_paid_day DECIMAL(12,2) DEFAULT 0,
    amount_unpaid DECIMAL(12,2) DEFAULT 0,
    amount_overdue DECIMAL(12,2) DEFAULT 0,
    
    -- Churn metrics
    churn_rate DECIMAL(5,2) DEFAULT 0,
    churned_mrr DECIMAL(12,2) DEFAULT 0,
    
    -- Product metrics (top 10 by MRR)
    top_products JSONB DEFAULT '[]',
    
    -- MRR breakdown
    mrr_by_cycle JSONB DEFAULT '[]',
    mrr_by_product_group JSONB DEFAULT '[]',
    
    -- ARPU (Average Revenue Per User)
    arpu DECIMAL(10,2) DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(instance_id, date)
);

-- Indexes for metrics_daily
CREATE INDEX IF NOT EXISTS idx_metrics_daily_lookup 
ON metrics_daily(instance_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_metrics_daily_date 
ON metrics_daily(date DESC);

CREATE INDEX IF NOT EXISTS idx_metrics_daily_mrr 
ON metrics_daily(instance_id, mrr DESC);

-- Enable RLS
ALTER TABLE metrics_daily ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Service role can manage metrics_daily"
ON metrics_daily FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- PART 3: Additional indexes for optimized queries
-- ============================================================================

-- Clients by MRR (for top clients)
CREATE INDEX IF NOT EXISTS idx_clients_mrr 
ON whmcs_clients(instance_id, current_mrr DESC) 
WHERE current_mrr > 0;

-- Clients by status
CREATE INDEX IF NOT EXISTS idx_clients_status 
ON whmcs_clients(instance_id, status);

-- Hosting by product (for product analytics)
CREATE INDEX IF NOT EXISTS idx_hosting_product 
ON whmcs_hosting(instance_id, packageid, domainstatus);

-- Hosting by client (for client details)
CREATE INDEX IF NOT EXISTS idx_hosting_client 
ON whmcs_hosting(instance_id, client_id, domainstatus);

-- Hosting monthly amount (for MRR calculations)
CREATE INDEX IF NOT EXISTS idx_hosting_monthly_amount 
ON whmcs_hosting(instance_id, monthly_amount DESC) 
WHERE domainstatus = 'Active';

-- Invoices by payment date (for revenue reports)
CREATE INDEX IF NOT EXISTS idx_invoices_paid_date 
ON whmcs_invoices(instance_id, datepaid DESC) 
WHERE status = 'Paid';

-- Invoices unpaid/overdue
CREATE INDEX IF NOT EXISTS idx_invoices_unpaid 
ON whmcs_invoices(instance_id, duedate) 
WHERE status = 'Unpaid';

-- Domains by expiry
CREATE INDEX IF NOT EXISTS idx_domains_expiry 
ON whmcs_domains(instance_id, expirydate) 
WHERE status = 'Active';

-- ============================================================================
-- PART 4: Trigger to auto-calculate monthly_amount on hosting
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_monthly_amount()
RETURNS TRIGGER AS $$
BEGIN
    NEW.monthly_amount := CASE LOWER(COALESCE(NEW.billingcycle, ''))
        WHEN 'monthly' THEN COALESCE(NEW.amount, 0)
        WHEN 'quarterly' THEN COALESCE(NEW.amount, 0) / 3
        WHEN 'semi-annually' THEN COALESCE(NEW.amount, 0) / 6
        WHEN 'semiannually' THEN COALESCE(NEW.amount, 0) / 6
        WHEN 'annually' THEN COALESCE(NEW.amount, 0) / 12
        WHEN 'biennially' THEN COALESCE(NEW.amount, 0) / 24
        WHEN 'triennially' THEN COALESCE(NEW.amount, 0) / 36
        ELSE 0
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hosting_monthly_amount ON whmcs_hosting;
CREATE TRIGGER trg_hosting_monthly_amount
BEFORE INSERT OR UPDATE OF amount, billingcycle ON whmcs_hosting
FOR EACH ROW EXECUTE FUNCTION calculate_monthly_amount();

-- ============================================================================
-- PART 5: Function to update client metrics
-- ============================================================================

CREATE OR REPLACE FUNCTION update_client_metrics(p_instance_id UUID, p_client_id BIGINT DEFAULT NULL)
RETURNS void AS $$
BEGIN
    -- Update metrics for specific client or all clients in instance
    UPDATE whmcs_clients c
    SET 
        current_mrr = COALESCE((
            SELECT SUM(monthly_amount)
            FROM whmcs_hosting h
            WHERE h.instance_id = c.instance_id
              AND h.client_id = c.whmcs_id
              AND h.domainstatus = 'Active'
        ), 0),
        services_count = COALESCE((
            SELECT COUNT(*)
            FROM whmcs_hosting h
            WHERE h.instance_id = c.instance_id
              AND h.client_id = c.whmcs_id
              AND h.domainstatus = 'Active'
        ), 0),
        domains_count = COALESCE((
            SELECT COUNT(*)
            FROM whmcs_domains d
            WHERE d.instance_id = c.instance_id
              AND d.client_id = c.whmcs_id
              AND d.status = 'Active'
        ), 0),
        total_paid = COALESCE((
            SELECT SUM(total)
            FROM whmcs_invoices i
            WHERE i.instance_id = c.instance_id
              AND i.client_id = c.whmcs_id
              AND i.status = 'Paid'
        ), 0),
        first_payment_date = (
            SELECT MIN(DATE(datepaid))
            FROM whmcs_invoices i
            WHERE i.instance_id = c.instance_id
              AND i.client_id = c.whmcs_id
              AND i.status = 'Paid'
              AND i.datepaid IS NOT NULL
        ),
        last_payment_date = (
            SELECT MAX(DATE(datepaid))
            FROM whmcs_invoices i
            WHERE i.instance_id = c.instance_id
              AND i.client_id = c.whmcs_id
              AND i.status = 'Paid'
              AND i.datepaid IS NOT NULL
        )
    WHERE c.instance_id = p_instance_id
      AND (p_client_id IS NULL OR c.whmcs_id = p_client_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 6: Function to update all client metrics for an instance
-- ============================================================================

CREATE OR REPLACE FUNCTION update_all_client_metrics(p_instance_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- First ensure all hosting has monthly_amount calculated
    UPDATE whmcs_hosting
    SET monthly_amount = CASE LOWER(COALESCE(billingcycle, ''))
        WHEN 'monthly' THEN COALESCE(amount, 0)
        WHEN 'quarterly' THEN COALESCE(amount, 0) / 3
        WHEN 'semi-annually' THEN COALESCE(amount, 0) / 6
        WHEN 'semiannually' THEN COALESCE(amount, 0) / 6
        WHEN 'annually' THEN COALESCE(amount, 0) / 12
        WHEN 'biennially' THEN COALESCE(amount, 0) / 24
        WHEN 'triennially' THEN COALESCE(amount, 0) / 36
        ELSE 0
    END
    WHERE instance_id = p_instance_id
      AND (monthly_amount IS NULL OR monthly_amount = 0);
    
    -- Then update all client metrics
    PERFORM update_client_metrics(p_instance_id, NULL);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 7: Function to populate metrics_daily (called after sync)
-- ============================================================================

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
    
    -- Default if no data
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

    -- Unpaid invoices
    SELECT COALESCE(COUNT(*), 0), COALESCE(SUM(total), 0)
    INTO v_unpaid_invoices, v_amount_unpaid
    FROM whmcs_invoices
    WHERE instance_id = p_instance_id
      AND status = 'Unpaid';

    -- Overdue invoices
    SELECT COALESCE(COUNT(*), 0), COALESCE(SUM(total), 0)
    INTO v_overdue_invoices, v_amount_overdue
    FROM whmcs_invoices
    WHERE instance_id = p_instance_id
      AND status = 'Unpaid'
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

-- ============================================================================
-- PART 8: Function to get metrics for a specific date (fast lookup)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_metrics_for_date(
    p_instance_ids UUID[],
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    date DATE,
    mrr DECIMAL(12,2),
    arr DECIMAL(12,2),
    revenue_day DECIMAL(12,2),
    active_services BIGINT,
    total_clients BIGINT,
    active_clients BIGINT,
    inactive_clients BIGINT,
    closed_clients BIGINT,
    unpaid_invoices BIGINT,
    amount_unpaid DECIMAL(12,2),
    churn_rate DECIMAL(5,2),
    arpu DECIMAL(10,2)
)
LANGUAGE SQL
STABLE
AS $$
    SELECT 
        md.date,
        SUM(md.mrr)::DECIMAL(12,2),
        SUM(md.arr)::DECIMAL(12,2),
        SUM(md.revenue_day)::DECIMAL(12,2),
        SUM(md.active_services),
        SUM(md.total_clients),
        SUM(md.active_clients),
        SUM(md.inactive_clients),
        SUM(md.closed_clients),
        SUM(md.unpaid_invoices),
        SUM(md.amount_unpaid)::DECIMAL(12,2),
        AVG(md.churn_rate)::DECIMAL(5,2),
        CASE WHEN SUM(md.active_clients) > 0 
             THEN (SUM(md.mrr) / SUM(md.active_clients))::DECIMAL(10,2)
             ELSE 0 
        END
    FROM metrics_daily md
    WHERE md.instance_id = ANY(p_instance_ids)
      AND md.date = p_date
    GROUP BY md.date
$$;

-- ============================================================================
-- PART 9: Function to get metrics range (for charts)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_metrics_range(
    p_instance_ids UUID[],
    p_start_date DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    date DATE,
    mrr DECIMAL(12,2),
    arr DECIMAL(12,2),
    revenue_day DECIMAL(12,2),
    active_services BIGINT,
    active_clients BIGINT,
    total_clients BIGINT,
    churn_rate DECIMAL(5,2),
    arpu DECIMAL(10,2)
)
LANGUAGE SQL
STABLE
AS $$
    SELECT 
        md.date,
        SUM(md.mrr)::DECIMAL(12,2),
        SUM(md.arr)::DECIMAL(12,2),
        SUM(md.revenue_day)::DECIMAL(12,2),
        SUM(md.active_services),
        SUM(md.active_clients),
        SUM(md.total_clients),
        AVG(md.churn_rate)::DECIMAL(5,2),
        CASE WHEN SUM(md.active_clients) > 0 
             THEN (SUM(md.mrr) / SUM(md.active_clients))::DECIMAL(10,2)
             ELSE 0 
        END
    FROM metrics_daily md
    WHERE md.instance_id = ANY(p_instance_ids)
      AND md.date BETWEEN p_start_date AND p_end_date
    GROUP BY md.date
    ORDER BY md.date ASC
$$;

-- ============================================================================
-- PART 10: Function to get top clients by MRR
-- ============================================================================

CREATE OR REPLACE FUNCTION get_top_clients_by_mrr(
    p_instance_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    client_id BIGINT,
    status TEXT,
    current_mrr DECIMAL(12,2),
    services_count INTEGER,
    domains_count INTEGER,
    total_paid DECIMAL(12,2),
    tenure_days INTEGER
)
LANGUAGE SQL
STABLE
AS $$
    SELECT 
        whmcs_id,
        status,
        current_mrr,
        services_count,
        domains_count,
        total_paid,
        CASE WHEN datecreated IS NOT NULL 
             THEN (CURRENT_DATE - datecreated)::INTEGER
             ELSE 0 
        END as tenure_days
    FROM whmcs_clients
    WHERE instance_id = p_instance_id
      AND current_mrr > 0
    ORDER BY current_mrr DESC
    LIMIT p_limit
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE metrics_daily IS 'Pre-calculated daily metrics for fast queries. Updated after each sync.';
COMMENT ON COLUMN metrics_daily.mrr IS 'Monthly Recurring Revenue for this day';
COMMENT ON COLUMN metrics_daily.arpu IS 'Average Revenue Per User (MRR / active_clients)';
COMMENT ON COLUMN metrics_daily.top_products IS 'Top 10 products by MRR as JSONB array';

COMMENT ON FUNCTION populate_metrics_daily IS 'Populates/updates metrics_daily for an instance. Call after sync.';
COMMENT ON FUNCTION get_metrics_for_date IS 'Fast lookup of metrics for a specific date across instances';
COMMENT ON FUNCTION get_metrics_range IS 'Get metrics range for charts (aggregated across instances)';
COMMENT ON FUNCTION get_top_clients_by_mrr IS 'Get top N clients by MRR for an instance';
