-- Migration: Setup pg_cron jobs for automated snapshots
-- Description: Configures scheduled jobs for daily snapshots and retry processing
-- 
-- NOTE: pg_cron is NOT available in Supabase Local development.
-- This migration will only create jobs when running on Supabase Cloud.
-- For local development, snapshots are created via sync endpoint.

-- Only attempt to create cron jobs if pg_cron extension exists
DO $$
BEGIN
    -- Check if pg_cron extension is available
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Remove existing jobs if they exist (for idempotency)
        BEGIN
            PERFORM cron.unschedule('daily-metrics-snapshot');
        EXCEPTION WHEN OTHERS THEN
            -- Job doesn't exist, ignore
            NULL;
        END;
        
        BEGIN
            PERFORM cron.unschedule('retry-pending-snapshots');
        EXCEPTION WHEN OTHERS THEN
            -- Job doesn't exist, ignore
            NULL;
        END;
        
        -- Job 1: Create daily snapshots at midnight UTC
        PERFORM cron.schedule(
            'daily-metrics-snapshot',
            '0 0 * * *',
            'SELECT create_all_daily_snapshots(CURRENT_DATE)'
        );
        
        -- Job 2: Process pending retries every 15 minutes
        PERFORM cron.schedule(
            'retry-pending-snapshots',
            '*/15 * * * *',
            'SELECT process_pending_snapshot_retries()'
        );
        
        RAISE NOTICE 'pg_cron jobs scheduled successfully';
    ELSE
        RAISE NOTICE 'pg_cron not available (local development). Skipping job creation.';
        RAISE NOTICE 'Snapshots will be created via sync endpoint instead.';
    END IF;
END $$;

-- Create a view to check snapshot job status (works even without pg_cron)
CREATE OR REPLACE VIEW v_snapshot_status AS
SELECT 
    ms.instance_id,
    i.name as instance_name,
    ms.snapshot_date,
    ms.mrr,
    ms.arr,
    ms.active_clients,
    ms.churn_rate,
    ms.attempt_count,
    ms.updated_at
FROM metrics_snapshots ms
JOIN whmcs_instances i ON i.id = ms.instance_id
ORDER BY ms.snapshot_date DESC, i.name;

COMMENT ON VIEW v_snapshot_status IS 'Overview of recent snapshots across all instances';
