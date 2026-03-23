-- Fix: instances with status='error' (after a failed sync) were hidden from
-- get_tenant_instances, which caused the dashboard to show no data at all.
-- Include 'error' instances so users can still see their historical metrics
-- and know that the sync needs attention.

CREATE OR REPLACE FUNCTION get_tenant_instances(p_user_id UUID, p_tenant_id UUID)
RETURNS TABLE (
  instance_id UUID,
  instance_name TEXT,
  instance_slug TEXT,
  whmcs_url TEXT,
  status TEXT,
  last_sync_at TIMESTAMPTZ
) AS $$
BEGIN
  -- First verify user has access to this tenant
  IF NOT EXISTS (
    SELECT 1 FROM user_tenants
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    i.id as instance_id,
    i.name as instance_name,
    i.slug as instance_slug,
    i.whmcs_url,
    i.status,
    i.last_sync_at
  FROM whmcs_instances i
  WHERE i.tenant_id = p_tenant_id
    AND i.status IN ('active', 'error')
  ORDER BY i.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_tenant_instances IS 'Returns all WHMCS instances (active + error) for a tenant that the user can access';
