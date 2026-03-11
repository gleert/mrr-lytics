-- Migration: Create snapshot_attempts table
-- Description: Logs all snapshot creation attempts for auditing and retry logic

CREATE TABLE snapshot_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES whmcs_instances(id) ON DELETE CASCADE,
    attempt_date DATE NOT NULL,
    attempt_at TIMESTAMPTZ DEFAULT NOW(),
    attempt_number INTEGER NOT NULL DEFAULT 1,
    
    -- Result
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'superseded', 'pending')),
    mrr_calculated DECIMAL(12,2),
    error_message TEXT,
    
    -- Whether this attempt was selected as the final snapshot
    was_selected BOOLEAN DEFAULT FALSE,
    
    -- Next retry info (for pending/failed)
    next_retry_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_attempts_instance_date ON snapshot_attempts(instance_id, attempt_date DESC);
CREATE INDEX idx_attempts_status ON snapshot_attempts(status) WHERE status IN ('pending', 'failed');
CREATE INDEX idx_attempts_retry ON snapshot_attempts(next_retry_at) WHERE status = 'pending' AND next_retry_at IS NOT NULL;

-- Enable RLS
ALTER TABLE snapshot_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Service role can manage snapshot_attempts"
ON snapshot_attempts FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Comments
COMMENT ON TABLE snapshot_attempts IS 'Audit log of all snapshot creation attempts with retry tracking';
COMMENT ON COLUMN snapshot_attempts.status IS 'success=worked, failed=error, superseded=replaced by higher MRR, pending=scheduled retry';
COMMENT ON COLUMN snapshot_attempts.was_selected IS 'True if this attempt was chosen as the final snapshot for the day';
COMMENT ON COLUMN snapshot_attempts.next_retry_at IS 'When to retry this snapshot (exponential backoff)';
