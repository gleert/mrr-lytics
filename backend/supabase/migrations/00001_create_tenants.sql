-- Migration: Create tenants table
-- Description: Core table for multi-tenant architecture. Each tenant represents an organization/company.

-- Tenants table (Organization level)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WHMCS Instances table (each tenant can have multiple WHMCS installations)
CREATE TABLE whmcs_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    whmcs_url TEXT NOT NULL,
    whmcs_api_identifier TEXT,
    whmcs_api_secret TEXT,
    sync_enabled BOOLEAN DEFAULT true,
    sync_interval_hours INTEGER DEFAULT 24,
    last_sync_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, slug)
);

-- Indexes
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_whmcs_instances_tenant ON whmcs_instances(tenant_id);
CREATE INDEX idx_whmcs_instances_status ON whmcs_instances(status);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whmcs_instances_updated_at
    BEFORE UPDATE ON whmcs_instances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE whmcs_instances ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role only for tenant management
CREATE POLICY "Service role can manage tenants"
ON tenants FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can manage whmcs_instances"
ON whmcs_instances FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Comments
COMMENT ON TABLE tenants IS 'Multi-tenant organizations. Each tenant is a company/organization.';
COMMENT ON TABLE whmcs_instances IS 'WHMCS installations belonging to a tenant. Each tenant can have multiple instances.';
COMMENT ON COLUMN whmcs_instances.whmcs_url IS 'Base URL of the WHMCS installation';
COMMENT ON COLUMN whmcs_instances.whmcs_api_identifier IS 'API identifier for WHMCS API authentication';
COMMENT ON COLUMN whmcs_instances.whmcs_api_secret IS 'API secret for WHMCS API authentication (encrypted)';
