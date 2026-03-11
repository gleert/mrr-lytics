-- Migration: Add fields for improved churn tracking
-- Description: Adds termination dates and cancellation request tracking

-- Add new columns to whmcs_hosting for better churn tracking
ALTER TABLE whmcs_hosting 
    ADD COLUMN IF NOT EXISTS terminationdate DATE,
    ADD COLUMN IF NOT EXISTS suspendreason TEXT,
    ADD COLUMN IF NOT EXISTS overideautosuspend INTEGER,
    ADD COLUMN IF NOT EXISTS overidesuspenduntil DATE;

-- Add new columns to whmcs_clients for better analytics
ALTER TABLE whmcs_clients
    ADD COLUMN IF NOT EXISTS defaultgateway TEXT,
    ADD COLUMN IF NOT EXISTS groupid INTEGER,
    ADD COLUMN IF NOT EXISTS lastlogin TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS credit DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS language TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Create cancellation requests table for precise churn tracking
CREATE TABLE IF NOT EXISTS whmcs_cancellation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES whmcs_instances(id) ON DELETE CASCADE,
    whmcs_id BIGINT NOT NULL,
    relid BIGINT NOT NULL,              -- Related hosting ID (whmcs_hosting.whmcs_id)
    reason TEXT,                         -- Cancellation reason
    type TEXT,                           -- 'Immediate' or 'End of Billing Period'
    created_at TIMESTAMPTZ,              -- When request was created in WHMCS
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(instance_id, whmcs_id)
);

-- Index for joining with hosting
CREATE INDEX IF NOT EXISTS idx_cancel_requests_instance ON whmcs_cancellation_requests(instance_id);
CREATE INDEX IF NOT EXISTS idx_cancel_requests_relid ON whmcs_cancellation_requests(instance_id, relid);
CREATE INDEX IF NOT EXISTS idx_cancel_requests_created ON whmcs_cancellation_requests(instance_id, created_at DESC);

-- Index for termination date queries
CREATE INDEX IF NOT EXISTS idx_hosting_termination ON whmcs_hosting(instance_id, terminationdate) 
    WHERE terminationdate IS NOT NULL;

-- Enable RLS
ALTER TABLE whmcs_cancellation_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Service role can manage whmcs_cancellation_requests"
ON whmcs_cancellation_requests FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Update churn calculation function to use terminationdate when available
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
    
    -- Count services that were terminated during the period
    -- Use terminationdate if available, fallback to synced_at
    SELECT 
        COUNT(*),
        COALESCE(SUM(normalize_to_monthly(amount, billingcycle)), 0)
    INTO v_churned_services, v_churned_mrr
    FROM whmcs_hosting
    WHERE instance_id = p_instance_id
      AND domainstatus IN ('Cancelled', 'Terminated', 'Suspended')
      AND (
          -- Use terminationdate if available and within period
          (terminationdate IS NOT NULL AND terminationdate >= v_period_start AND terminationdate <= v_period_end)
          OR
          -- Fallback to synced_at if no terminationdate
          (terminationdate IS NULL AND synced_at >= v_period_start)
      );
    
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

-- Function to get churn details (individual services)
CREATE OR REPLACE FUNCTION get_churned_services(
    p_instance_id UUID, 
    p_period_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    hosting_id UUID,
    whmcs_id BIGINT,
    domain TEXT,
    product_name TEXT,
    amount DECIMAL(10,2),
    billingcycle TEXT,
    mrr_lost DECIMAL(10,2),
    status TEXT,
    termination_date DATE,
    cancellation_reason TEXT,
    cancellation_type TEXT
) AS $$
DECLARE
    v_period_start DATE;
BEGIN
    v_period_start := CURRENT_DATE - p_period_days;
    
    RETURN QUERY
    SELECT 
        h.id as hosting_id,
        h.whmcs_id,
        h.domain,
        p.name as product_name,
        h.amount,
        h.billingcycle,
        normalize_to_monthly(h.amount, h.billingcycle) as mrr_lost,
        h.domainstatus as status,
        h.terminationdate as termination_date,
        cr.reason as cancellation_reason,
        cr.type as cancellation_type
    FROM whmcs_hosting h
    LEFT JOIN whmcs_products p ON h.instance_id = p.instance_id AND h.packageid = p.whmcs_id
    LEFT JOIN whmcs_cancellation_requests cr ON h.instance_id = cr.instance_id AND h.whmcs_id = cr.relid
    WHERE h.instance_id = p_instance_id
      AND h.domainstatus IN ('Cancelled', 'Terminated')
      AND (
          (h.terminationdate IS NOT NULL AND h.terminationdate >= v_period_start)
          OR
          (h.terminationdate IS NULL AND h.synced_at >= v_period_start)
      )
    ORDER BY COALESCE(h.terminationdate, h.synced_at::date) DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Comments
COMMENT ON TABLE whmcs_cancellation_requests IS 'Cancellation requests from WHMCS for precise churn tracking';
COMMENT ON COLUMN whmcs_hosting.terminationdate IS 'Date when the service was terminated/cancelled in WHMCS';
COMMENT ON FUNCTION get_churned_services IS 'Returns detailed list of churned services with cancellation info';
