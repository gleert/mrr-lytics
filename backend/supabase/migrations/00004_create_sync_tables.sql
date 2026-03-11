-- Migration: Create sync management tables
-- Description: Tables for tracking synchronization history and status per WHMCS instance

-- Sync logs (per instance)
CREATE TABLE sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES whmcs_instances(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    sync_type TEXT DEFAULT 'full' CHECK (sync_type IN ('full', 'incremental')),
    records_synced JSONB DEFAULT '{}',
    error_message TEXT,
    duration_ms INTEGER,
    triggered_by TEXT DEFAULT 'manual' CHECK (triggered_by IN ('manual', 'cron', 'webhook'))
);

-- Indexes
CREATE INDEX idx_sync_logs_instance ON sync_logs(instance_id);
CREATE INDEX idx_sync_logs_instance_date ON sync_logs(instance_id, started_at DESC);
CREATE INDEX idx_sync_logs_status ON sync_logs(instance_id, status);

-- Enable RLS
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Service role can manage sync_logs"
ON sync_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Helper function to get last successful sync for an instance
CREATE OR REPLACE FUNCTION get_last_sync(p_instance_id UUID)
RETURNS TIMESTAMPTZ AS $$
BEGIN
    RETURN (
        SELECT completed_at 
        FROM sync_logs 
        WHERE instance_id = p_instance_id 
          AND status = 'completed' 
        ORDER BY completed_at DESC 
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Comments
COMMENT ON TABLE sync_logs IS 'Tracks synchronization history between WHMCS instances and this system';
COMMENT ON COLUMN sync_logs.records_synced IS 'JSON object with counts per table synced';
