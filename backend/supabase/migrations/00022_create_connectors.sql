-- Migration: Create connectors system for webhooks and integrations
-- Description: Tables for managing outbound webhooks with retry support

-- ============================================================================
-- CONNECTORS TABLE
-- ============================================================================
-- Configuration for outbound integrations (webhooks, Slack, etc.)

CREATE TABLE connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Connector type and identification
  type TEXT NOT NULL DEFAULT 'webhook',  -- 'webhook', 'slack', 'discord', etc.
  name TEXT NOT NULL,                     -- User-friendly name
  
  -- Configuration (type-specific)
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- For webhooks: { "url": "https://...", "secret": "whsec_...", "headers": {} }
  -- For Slack: { "webhook_url": "https://hooks.slack.com/..." }
  
  -- Subscribed events
  events TEXT[] NOT NULL DEFAULT '{}',    -- Array of event types to receive
  
  -- Status
  enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_connectors_tenant_id ON connectors(tenant_id);
CREATE INDEX idx_connectors_type ON connectors(type);
CREATE INDEX idx_connectors_enabled ON connectors(enabled) WHERE enabled = true;
CREATE INDEX idx_connectors_events ON connectors USING GIN(events);

-- Updated at trigger
CREATE TRIGGER update_connectors_updated_at
  BEFORE UPDATE ON connectors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CONNECTOR EVENTS TABLE
-- ============================================================================
-- Log of events sent to connectors (for debugging and retries)

CREATE TABLE connector_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  
  -- Event details
  event_type TEXT NOT NULL,               -- 'client.new', 'sync.completed', etc.
  event_id TEXT NOT NULL,                 -- Unique event ID (evt_xxx)
  payload JSONB NOT NULL,                 -- Full payload sent
  
  -- Delivery status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  
  -- Response tracking
  response_code INTEGER,                  -- HTTP status code
  response_body TEXT,                     -- Response body (truncated if large)
  error_message TEXT,                     -- Error message if failed
  
  -- Retry tracking
  attempts INTEGER NOT NULL DEFAULT 0,    -- Number of delivery attempts
  max_attempts INTEGER NOT NULL DEFAULT 5,-- Maximum retry attempts
  next_retry_at TIMESTAMPTZ,              -- When to retry next (null if not retrying)
  
  -- Timestamps
  sent_at TIMESTAMPTZ,                    -- When successfully delivered
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_connector_events_connector ON connector_events(connector_id);
CREATE INDEX idx_connector_events_status ON connector_events(status);
CREATE INDEX idx_connector_events_event_type ON connector_events(event_type);
CREATE INDEX idx_connector_events_created ON connector_events(created_at DESC);
CREATE INDEX idx_connector_events_retry ON connector_events(next_retry_at) 
  WHERE status = 'pending' AND next_retry_at IS NOT NULL;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_events ENABLE ROW LEVEL SECURITY;

-- Connectors: Users can manage their tenant's connectors
CREATE POLICY "connectors_select_own_tenant"
  ON connectors
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "connectors_insert_own_tenant"
  ON connectors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "connectors_update_own_tenant"
  ON connectors
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "connectors_delete_own_tenant"
  ON connectors
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Service role can do everything
CREATE POLICY "connectors_service_role"
  ON connectors
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Connector events: Users can view their tenant's events
CREATE POLICY "connector_events_select_own_tenant"
  ON connector_events
  FOR SELECT
  TO authenticated
  USING (
    connector_id IN (
      SELECT c.id FROM connectors c
      JOIN user_tenants ut ON ut.tenant_id = c.tenant_id
      WHERE ut.user_id = auth.uid()
    )
  );

-- Service role can manage events
CREATE POLICY "connector_events_service_role"
  ON connector_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- UPDATE SUBSCRIPTION PLANS WITH WEBHOOK LIMITS
-- ============================================================================

-- Add webhooks limit to each plan
UPDATE subscription_plans 
SET limits = limits || '{"webhooks": 1}'::jsonb
WHERE id = 'free';

UPDATE subscription_plans 
SET limits = limits || '{"webhooks": 3}'::jsonb
WHERE id = 'starter';

UPDATE subscription_plans 
SET limits = limits || '{"webhooks": 10}'::jsonb
WHERE id = 'pro';

UPDATE subscription_plans 
SET limits = limits || '{"webhooks": 100}'::jsonb
WHERE id = 'business';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if tenant can create more webhooks
CREATE OR REPLACE FUNCTION check_webhook_limit(p_tenant_id UUID)
RETURNS TABLE (
  allowed BOOLEAN,
  current_count INTEGER,
  max_count INTEGER,
  plan_id TEXT
) AS $$
DECLARE
  v_limits JSONB;
  v_max_count INTEGER;
  v_current_count INTEGER;
  v_plan_id TEXT;
BEGIN
  -- Get current plan limits
  SELECT p.limits, s.plan_id INTO v_limits, v_plan_id
  FROM subscriptions s
  JOIN subscription_plans p ON p.id = s.plan_id
  WHERE s.tenant_id = p_tenant_id
    AND s.status IN ('active', 'trialing');
  
  -- If no active subscription, use free plan limits
  IF v_limits IS NULL THEN
    SELECT limits, id INTO v_limits, v_plan_id
    FROM subscription_plans
    WHERE is_default = true;
  END IF;
  
  -- Get webhook limit (-1 means unlimited, but we cap at 100 for business)
  v_max_count := COALESCE((v_limits->>'webhooks')::INTEGER, 1);
  
  -- Count current webhooks
  SELECT COUNT(*)::INTEGER INTO v_current_count
  FROM connectors
  WHERE tenant_id = p_tenant_id AND type = 'webhook';
  
  RETURN QUERY
  SELECT 
    v_max_count = -1 OR v_current_count < v_max_count as allowed,
    v_current_count as current_count,
    v_max_count as max_count,
    v_plan_id as plan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get connectors for a tenant with event counts
CREATE OR REPLACE FUNCTION get_tenant_connectors(p_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  type TEXT,
  name TEXT,
  config JSONB,
  events TEXT[],
  enabled BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  total_events BIGINT,
  failed_events BIGINT,
  last_event_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.type,
    c.name,
    -- Mask sensitive config data
    CASE 
      WHEN c.type = 'webhook' THEN 
        jsonb_build_object(
          'url', c.config->>'url',
          'has_secret', (c.config->>'secret') IS NOT NULL
        )
      ELSE c.config
    END as config,
    c.events,
    c.enabled,
    c.created_at,
    c.updated_at,
    COALESCE(stats.total_events, 0) as total_events,
    COALESCE(stats.failed_events, 0) as failed_events,
    stats.last_event_at
  FROM connectors c
  LEFT JOIN LATERAL (
    SELECT 
      COUNT(*) as total_events,
      COUNT(*) FILTER (WHERE ce.status = 'failed') as failed_events,
      MAX(ce.created_at) as last_event_at
    FROM connector_events ce
    WHERE ce.connector_id = c.id
  ) stats ON true
  WHERE c.tenant_id = p_tenant_id
  ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get recent events for a connector
CREATE OR REPLACE FUNCTION get_connector_events(
  p_connector_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  event_type TEXT,
  event_id TEXT,
  status TEXT,
  response_code INTEGER,
  error_message TEXT,
  attempts INTEGER,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ce.id,
    ce.event_type,
    ce.event_id,
    ce.status,
    ce.response_code,
    ce.error_message,
    ce.attempts,
    ce.sent_at,
    ce.created_at
  FROM connector_events ce
  WHERE ce.connector_id = p_connector_id
  ORDER BY ce.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get pending retries for processing
CREATE OR REPLACE FUNCTION get_pending_webhook_retries(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  event_id UUID,
  connector_id UUID,
  connector_config JSONB,
  event_type TEXT,
  payload JSONB,
  attempts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ce.id as event_id,
    ce.connector_id,
    c.config as connector_config,
    ce.event_type,
    ce.payload,
    ce.attempts
  FROM connector_events ce
  JOIN connectors c ON c.id = ce.connector_id
  WHERE ce.status = 'pending'
    AND ce.next_retry_at IS NOT NULL
    AND ce.next_retry_at <= NOW()
    AND ce.attempts < ce.max_attempts
    AND c.enabled = true
  ORDER BY ce.next_retry_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE connectors IS 'Outbound integration configurations (webhooks, Slack, etc.)';
COMMENT ON TABLE connector_events IS 'Log of events sent to connectors with retry tracking';
COMMENT ON COLUMN connectors.config IS 'Type-specific configuration. For webhooks: url, secret, headers';
COMMENT ON COLUMN connectors.events IS 'Array of event types this connector subscribes to';
COMMENT ON COLUMN connector_events.status IS 'Delivery status: pending (awaiting/retrying), sent (delivered), failed (max retries exceeded)';
COMMENT ON COLUMN connector_events.next_retry_at IS 'Timestamp for next retry attempt. NULL if not retrying.';
