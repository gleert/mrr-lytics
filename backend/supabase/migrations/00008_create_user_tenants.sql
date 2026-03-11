-- Migration: Create user_tenants table for multi-tenant access
-- Allows users to have access to multiple tenants (organizations)

-- User-Tenant relationship table (many-to-many)
CREATE TABLE user_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'viewer',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Each user can only have one relationship per tenant
  CONSTRAINT unique_user_tenant UNIQUE (user_id, tenant_id)
);

-- Indexes
CREATE INDEX idx_user_tenants_user_id ON user_tenants(user_id);
CREATE INDEX idx_user_tenants_tenant_id ON user_tenants(tenant_id);

-- Ensure only one default tenant per user
CREATE UNIQUE INDEX idx_user_tenants_default ON user_tenants(user_id) WHERE is_default = true;

-- RLS Policies
ALTER TABLE user_tenants ENABLE ROW LEVEL SECURITY;

-- Users can read their own tenant associations
CREATE POLICY "users_select_own_tenants"
  ON user_tenants
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can manage user-tenant associations for their tenants
CREATE POLICY "admins_manage_tenant_users"
  ON user_tenants
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Migrate existing users to user_tenants table (if users table has data)
INSERT INTO user_tenants (user_id, tenant_id, role, is_default)
SELECT id, tenant_id, role, true
FROM users
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Function to get user's accessible tenants with their instances
CREATE OR REPLACE FUNCTION get_user_tenants(p_user_id UUID)
RETURNS TABLE (
  tenant_id UUID,
  tenant_name TEXT,
  tenant_slug TEXT,
  role user_role,
  is_default BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    t.slug as tenant_slug,
    ut.role,
    ut.is_default
  FROM user_tenants ut
  JOIN tenants t ON t.id = ut.tenant_id
  WHERE ut.user_id = p_user_id
    AND t.status = 'active'
  ORDER BY ut.is_default DESC, t.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get instances for a tenant that user has access to
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
    AND i.status = 'active'
  ORDER BY i.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to a tenant
CREATE OR REPLACE FUNCTION user_has_tenant_access(p_user_id UUID, p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_tenants 
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to an instance (via tenant)
CREATE OR REPLACE FUNCTION user_has_instance_access(p_user_id UUID, p_instance_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_tenants ut
    JOIN whmcs_instances i ON i.tenant_id = ut.tenant_id
    WHERE ut.user_id = p_user_id AND i.id = p_instance_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE user_tenants IS 'Multi-tenant access control - links users to organizations';
COMMENT ON COLUMN user_tenants.is_default IS 'The default tenant shown when user logs in';
COMMENT ON FUNCTION get_tenant_instances IS 'Returns all WHMCS instances for a tenant that the user can access';
