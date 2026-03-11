-- Migration: Create metrics_snapshots table
-- Description: Stores daily snapshots of metrics per instance
-- Selection criteria: The snapshot with the highest MRR of the day is kept

CREATE TABLE metrics_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES whmcs_instances(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- MRR/ARR (primary selection criteria)
    mrr DECIMAL(12,2) NOT NULL DEFAULT 0,
    arr DECIMAL(12,2) NOT NULL DEFAULT 0,
    active_services INTEGER NOT NULL DEFAULT 0,
    
    -- Clients
    active_clients INTEGER NOT NULL DEFAULT 0,
    inactive_clients INTEGER NOT NULL DEFAULT 0,
    closed_clients INTEGER NOT NULL DEFAULT 0,
    total_clients INTEGER NOT NULL DEFAULT 0,
    
    -- Churn (calculated vs previous day)
    churned_services INTEGER DEFAULT 0,
    churned_mrr DECIMAL(12,2) DEFAULT 0,
    churn_rate DECIMAL(5,2) DEFAULT 0,
    
    -- Revenue
    revenue_day DECIMAL(12,2) DEFAULT 0,
    paid_invoices INTEGER DEFAULT 0,
    unpaid_invoices INTEGER DEFAULT 0,
    
    -- MRR by billing cycle (JSONB for flexibility)
    mrr_by_cycle JSONB DEFAULT '[]',
    
    -- Metadata
    attempt_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Only one snapshot per day per instance
    UNIQUE(instance_id, snapshot_date)
);

-- Indexes for time-series queries
CREATE INDEX idx_snapshots_instance_date ON metrics_snapshots(instance_id, snapshot_date DESC);
CREATE INDEX idx_snapshots_date ON metrics_snapshots(snapshot_date DESC);
CREATE INDEX idx_snapshots_instance_mrr ON metrics_snapshots(instance_id, mrr DESC);

-- Enable RLS
ALTER TABLE metrics_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage all snapshots
CREATE POLICY "Service role can manage metrics_snapshots"
ON metrics_snapshots FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Comments
COMMENT ON TABLE metrics_snapshots IS 'Daily snapshots of metrics per WHMCS instance. Only the snapshot with highest MRR is kept for each day.';
COMMENT ON COLUMN metrics_snapshots.snapshot_date IS 'The date this snapshot represents (one per day)';
COMMENT ON COLUMN metrics_snapshots.mrr IS 'Monthly Recurring Revenue - used as selection criteria for best snapshot';
COMMENT ON COLUMN metrics_snapshots.attempt_count IS 'Number of attempts it took to create this snapshot';
COMMENT ON COLUMN metrics_snapshots.mrr_by_cycle IS 'JSON array of MRR breakdown by billing cycle';
