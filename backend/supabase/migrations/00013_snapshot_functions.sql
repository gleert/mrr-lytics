-- Migration: Create snapshot functions
-- Description: PL/pgSQL functions for creating and managing daily metric snapshots

-- Calculate exponential backoff delay in minutes
-- Pattern: 15min -> 30min -> 1h -> 2h -> 4h (max)
CREATE OR REPLACE FUNCTION calculate_backoff_minutes(p_attempt INTEGER)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT LEAST(15 * POWER(2, p_attempt - 1)::INTEGER, 240)
$$;

-- Get the current attempt count for an instance on a given date
CREATE OR REPLACE FUNCTION get_attempt_count(p_instance_id UUID, p_date DATE)
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
    SELECT COALESCE(MAX(attempt_number), 0)
    FROM snapshot_attempts
    WHERE instance_id = p_instance_id
      AND attempt_date = p_date
$$;

-- Calculate daily revenue (invoices paid today)
CREATE OR REPLACE FUNCTION calculate_daily_revenue(p_instance_id UUID, p_date DATE)
RETURNS DECIMAL(12,2)
LANGUAGE SQL
STABLE
AS $$
    SELECT COALESCE(SUM(total), 0)
    FROM whmcs_invoices
    WHERE instance_id = p_instance_id
      AND status = 'Paid'
      AND DATE(datepaid) = p_date
$$;

-- Get MRR by billing cycle as JSONB array
CREATE OR REPLACE FUNCTION get_mrr_by_cycle_json(p_instance_id UUID)
RETURNS JSONB
LANGUAGE SQL
STABLE
AS $$
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'cycle', billingcycle,
                'count', service_count,
                'mrr', mrr_contribution
            )
        ),
        '[]'::jsonb
    )
    FROM mv_mrr_by_cycle
    WHERE instance_id = p_instance_id
$$;

-- Main function: Create or update daily snapshot for an instance
-- Returns: snapshot_id if created/updated, NULL if existing snapshot had higher MRR
CREATE OR REPLACE FUNCTION create_daily_snapshot(p_instance_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_attempt_number INTEGER;
    v_snapshot_id UUID;
    v_mrr DECIMAL(12,2);
    v_arr DECIMAL(12,2);
    v_active_services INTEGER;
    v_active_clients INTEGER;
    v_inactive_clients INTEGER;
    v_closed_clients INTEGER;
    v_total_clients INTEGER;
    v_churn RECORD;
    v_paid_invoices INTEGER;
    v_unpaid_invoices INTEGER;
    v_revenue_day DECIMAL(12,2);
    v_mrr_by_cycle JSONB;
    v_existing_mrr DECIMAL(12,2);
    v_attempt_id UUID;
BEGIN
    -- Get current attempt number
    v_attempt_number := get_attempt_count(p_instance_id, p_date) + 1;
    
    -- Create attempt record (initially pending)
    INSERT INTO snapshot_attempts (instance_id, attempt_date, attempt_number, status)
    VALUES (p_instance_id, p_date, v_attempt_number, 'pending')
    RETURNING id INTO v_attempt_id;
    
    BEGIN
        -- Fetch MRR metrics from materialized view
        SELECT mrr, arr, active_services
        INTO v_mrr, v_arr, v_active_services
        FROM mv_mrr_current
        WHERE instance_id = p_instance_id;
        
        -- Default values if no data
        v_mrr := COALESCE(v_mrr, 0);
        v_arr := COALESCE(v_arr, 0);
        v_active_services := COALESCE(v_active_services, 0);
        
        -- Fetch client summary
        SELECT active_clients, inactive_clients, closed_clients, total_clients
        INTO v_active_clients, v_inactive_clients, v_closed_clients, v_total_clients
        FROM mv_client_summary
        WHERE instance_id = p_instance_id;
        
        v_active_clients := COALESCE(v_active_clients, 0);
        v_inactive_clients := COALESCE(v_inactive_clients, 0);
        v_closed_clients := COALESCE(v_closed_clients, 0);
        v_total_clients := COALESCE(v_total_clients, 0);
        
        -- Fetch invoice summary
        SELECT paid_count, unpaid_count
        INTO v_paid_invoices, v_unpaid_invoices
        FROM mv_invoice_summary
        WHERE instance_id = p_instance_id;
        
        v_paid_invoices := COALESCE(v_paid_invoices, 0);
        v_unpaid_invoices := COALESCE(v_unpaid_invoices, 0);
        
        -- Calculate churn (30 day period)
        SELECT churned_services, churned_mrr, churn_rate
        INTO v_churn
        FROM calculate_churn(p_instance_id, 30);
        
        -- Calculate daily revenue
        v_revenue_day := calculate_daily_revenue(p_instance_id, p_date);
        
        -- Get MRR by cycle
        v_mrr_by_cycle := get_mrr_by_cycle_json(p_instance_id);
        
        -- Check existing snapshot for this day
        SELECT mrr INTO v_existing_mrr
        FROM metrics_snapshots
        WHERE instance_id = p_instance_id
          AND snapshot_date = p_date;
        
        -- Only update if new MRR is higher (or no existing snapshot)
        IF v_existing_mrr IS NULL OR v_mrr > v_existing_mrr THEN
            -- Upsert the snapshot
            INSERT INTO metrics_snapshots (
                instance_id, snapshot_date, snapshot_at,
                mrr, arr, active_services,
                active_clients, inactive_clients, closed_clients, total_clients,
                churned_services, churned_mrr, churn_rate,
                revenue_day, paid_invoices, unpaid_invoices,
                mrr_by_cycle, attempt_count, updated_at
            ) VALUES (
                p_instance_id, p_date, NOW(),
                v_mrr, v_arr, v_active_services,
                v_active_clients, v_inactive_clients, v_closed_clients, v_total_clients,
                COALESCE(v_churn.churned_services, 0),
                COALESCE(v_churn.churned_mrr, 0),
                COALESCE(v_churn.churn_rate, 0),
                v_revenue_day, v_paid_invoices, v_unpaid_invoices,
                v_mrr_by_cycle, v_attempt_number, NOW()
            )
            ON CONFLICT (instance_id, snapshot_date) DO UPDATE SET
                snapshot_at = NOW(),
                mrr = EXCLUDED.mrr,
                arr = EXCLUDED.arr,
                active_services = EXCLUDED.active_services,
                active_clients = EXCLUDED.active_clients,
                inactive_clients = EXCLUDED.inactive_clients,
                closed_clients = EXCLUDED.closed_clients,
                total_clients = EXCLUDED.total_clients,
                churned_services = EXCLUDED.churned_services,
                churned_mrr = EXCLUDED.churned_mrr,
                churn_rate = EXCLUDED.churn_rate,
                revenue_day = EXCLUDED.revenue_day,
                paid_invoices = EXCLUDED.paid_invoices,
                unpaid_invoices = EXCLUDED.unpaid_invoices,
                mrr_by_cycle = EXCLUDED.mrr_by_cycle,
                attempt_count = EXCLUDED.attempt_count,
                updated_at = NOW()
            RETURNING id INTO v_snapshot_id;
            
            -- Mark this attempt as selected, others as superseded
            UPDATE snapshot_attempts
            SET status = 'success', mrr_calculated = v_mrr, was_selected = TRUE
            WHERE id = v_attempt_id;
            
            UPDATE snapshot_attempts
            SET status = 'superseded', was_selected = FALSE
            WHERE instance_id = p_instance_id
              AND attempt_date = p_date
              AND id != v_attempt_id
              AND was_selected = TRUE;
            
            RETURN v_snapshot_id;
        ELSE
            -- Existing snapshot has higher MRR, mark this attempt as superseded
            UPDATE snapshot_attempts
            SET status = 'superseded', mrr_calculated = v_mrr, was_selected = FALSE
            WHERE id = v_attempt_id;
            
            RETURN NULL;
        END IF;
        
    EXCEPTION WHEN OTHERS THEN
        -- Log the failure and schedule retry
        UPDATE snapshot_attempts
        SET 
            status = 'failed',
            error_message = SQLERRM,
            next_retry_at = NOW() + (calculate_backoff_minutes(v_attempt_number) || ' minutes')::INTERVAL
        WHERE id = v_attempt_id;
        
        -- Re-raise the exception for the caller to handle
        RAISE;
    END;
END;
$$;

-- Create snapshots for all active instances
CREATE OR REPLACE FUNCTION create_all_daily_snapshots(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
    instance_id UUID,
    instance_name TEXT,
    success BOOLEAN,
    snapshot_id UUID,
    error_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_instance RECORD;
    v_snapshot_id UUID;
    v_error TEXT;
BEGIN
    FOR v_instance IN 
        SELECT i.id, i.name 
        FROM whmcs_instances i 
        WHERE i.status = 'active'
    LOOP
        BEGIN
            v_snapshot_id := create_daily_snapshot(v_instance.id, p_date);
            
            instance_id := v_instance.id;
            instance_name := v_instance.name;
            success := TRUE;
            snapshot_id := v_snapshot_id;
            error_message := NULL;
            RETURN NEXT;
            
        EXCEPTION WHEN OTHERS THEN
            instance_id := v_instance.id;
            instance_name := v_instance.name;
            success := FALSE;
            snapshot_id := NULL;
            error_message := SQLERRM;
            RETURN NEXT;
        END;
    END LOOP;
END;
$$;

-- Process pending retries (called by pg_cron every 15 minutes)
CREATE OR REPLACE FUNCTION process_pending_snapshot_retries()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER := 0;
    v_attempt RECORD;
BEGIN
    FOR v_attempt IN 
        SELECT DISTINCT instance_id, attempt_date
        FROM snapshot_attempts
        WHERE status = 'failed'
          AND next_retry_at IS NOT NULL
          AND next_retry_at <= NOW()
          -- Don't retry if we already have a successful snapshot for today
          AND NOT EXISTS (
              SELECT 1 FROM metrics_snapshots ms
              WHERE ms.instance_id = snapshot_attempts.instance_id
                AND ms.snapshot_date = snapshot_attempts.attempt_date
          )
          -- Only retry within 24 hours of the attempt date
          AND attempt_date >= CURRENT_DATE - INTERVAL '1 day'
    LOOP
        BEGIN
            PERFORM create_daily_snapshot(v_attempt.instance_id, v_attempt.attempt_date);
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            -- Error already logged in create_daily_snapshot
            NULL;
        END;
    END LOOP;
    
    RETURN v_count;
END;
$$;

-- Get metrics history for an instance
CREATE OR REPLACE FUNCTION get_metrics_history(
    p_instance_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    snapshot_date DATE,
    mrr DECIMAL(12,2),
    arr DECIMAL(12,2),
    active_services INTEGER,
    active_clients INTEGER,
    total_clients INTEGER,
    churned_services INTEGER,
    churned_mrr DECIMAL(12,2),
    churn_rate DECIMAL(5,2),
    revenue_day DECIMAL(12,2)
)
LANGUAGE SQL
STABLE
AS $$
    SELECT 
        ms.snapshot_date,
        ms.mrr,
        ms.arr,
        ms.active_services,
        ms.active_clients,
        ms.total_clients,
        ms.churned_services,
        ms.churned_mrr,
        ms.churn_rate,
        ms.revenue_day
    FROM metrics_snapshots ms
    WHERE ms.instance_id = p_instance_id
      AND ms.snapshot_date >= CURRENT_DATE - p_days
    ORDER BY ms.snapshot_date DESC
$$;

-- Get aggregated metrics history across multiple instances
CREATE OR REPLACE FUNCTION get_metrics_history_aggregated(
    p_instance_ids UUID[],
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    snapshot_date DATE,
    mrr DECIMAL(12,2),
    arr DECIMAL(12,2),
    active_services BIGINT,
    active_clients BIGINT,
    total_clients BIGINT,
    churned_services BIGINT,
    churned_mrr DECIMAL(12,2),
    churn_rate DECIMAL(5,2),
    revenue_day DECIMAL(12,2)
)
LANGUAGE SQL
STABLE
AS $$
    SELECT 
        ms.snapshot_date,
        SUM(ms.mrr)::DECIMAL(12,2) as mrr,
        SUM(ms.arr)::DECIMAL(12,2) as arr,
        SUM(ms.active_services) as active_services,
        SUM(ms.active_clients) as active_clients,
        SUM(ms.total_clients) as total_clients,
        SUM(ms.churned_services) as churned_services,
        SUM(ms.churned_mrr)::DECIMAL(12,2) as churned_mrr,
        AVG(ms.churn_rate)::DECIMAL(5,2) as churn_rate,
        SUM(ms.revenue_day)::DECIMAL(12,2) as revenue_day
    FROM metrics_snapshots ms
    WHERE ms.instance_id = ANY(p_instance_ids)
      AND ms.snapshot_date >= CURRENT_DATE - p_days
    GROUP BY ms.snapshot_date
    ORDER BY ms.snapshot_date DESC
$$;

-- Comments
COMMENT ON FUNCTION create_daily_snapshot IS 'Creates or updates daily snapshot for an instance. Only updates if MRR is higher than existing.';
COMMENT ON FUNCTION create_all_daily_snapshots IS 'Creates snapshots for all active instances. Called by pg_cron at midnight.';
COMMENT ON FUNCTION process_pending_snapshot_retries IS 'Processes failed snapshots that are due for retry. Called by pg_cron every 15 minutes.';
COMMENT ON FUNCTION get_metrics_history IS 'Returns metrics history for a single instance over specified days.';
COMMENT ON FUNCTION get_metrics_history_aggregated IS 'Returns aggregated metrics history across multiple instances.';
