-- Migration: Filter spam clients (Closed without services) from metrics
-- Clients with status='Closed' that never had any service are spam signups
-- and should not count toward closed_clients, total_clients, or retention metrics.

-- 1. Recreate mv_client_summary excluding spam clients
DROP MATERIALIZED VIEW IF EXISTS mv_client_summary;

CREATE MATERIALIZED VIEW mv_client_summary AS
SELECT
    c.instance_id,
    COUNT(*) FILTER (WHERE c.status = 'Active') as active_clients,
    COUNT(*) FILTER (WHERE c.status = 'Inactive') as inactive_clients,
    COUNT(*) FILTER (
        WHERE c.status = 'Closed'
        AND EXISTS (
            SELECT 1 FROM whmcs_hosting h
            WHERE h.instance_id = c.instance_id
            AND h.client_id = c.whmcs_id
        )
    ) as closed_clients,
    -- Total only counts real clients (exclude Closed without services)
    COUNT(*) FILTER (
        WHERE c.status != 'Closed'
        OR EXISTS (
            SELECT 1 FROM whmcs_hosting h
            WHERE h.instance_id = c.instance_id
            AND h.client_id = c.whmcs_id
        )
    ) as total_clients,
    MIN(c.datecreated) as first_client_date,
    MAX(c.datecreated) as last_client_date
FROM whmcs_clients c
GROUP BY c.instance_id;

-- Create index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_client_summary_instance
ON mv_client_summary (instance_id);

-- 2. Update populate_metrics_daily to use corrected view
-- (The function reads from mv_client_summary, so refreshing the view is enough)

-- 3. Refresh the view now to apply changes
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_client_summary;
