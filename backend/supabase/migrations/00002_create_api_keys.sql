-- Migration: Create API keys table
-- Description: Authentication tokens for WHMCS instance API access with scopes

-- API Keys table (per instance, not per tenant)
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES whmcs_instances(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    scopes TEXT[] DEFAULT ARRAY['read'],
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(key_hash)
);

-- Indexes
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_instance ON api_keys(instance_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Service role can manage API keys"
ON api_keys FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Comments
COMMENT ON TABLE api_keys IS 'API keys for authenticating WHMCS instance requests. Keys are hashed with SHA-256.';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash of the full API key';
COMMENT ON COLUMN api_keys.key_prefix IS 'First 8 characters of key for identification (e.g., mrr_a1b2)';
COMMENT ON COLUMN api_keys.scopes IS 'Array of permissions: read, write, sync, admin';
