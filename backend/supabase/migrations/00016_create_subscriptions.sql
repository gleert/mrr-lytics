-- Migration: Create subscription system tables
-- Description: Stripe-integrated subscription and billing system

-- ============================================================================
-- SUBSCRIPTION PLANS TABLE
-- ============================================================================
-- Static configuration table for available plans

CREATE TABLE subscription_plans (
  id TEXT PRIMARY KEY,                          -- 'free', 'starter', 'pro', 'business'
  name TEXT NOT NULL,                           -- Display name
  description TEXT,                             -- Short description
  stripe_product_id TEXT,                       -- Stripe product ID (null for free)
  stripe_price_id_monthly TEXT,                 -- Stripe price ID for monthly billing
  stripe_price_id_yearly TEXT,                  -- Stripe price ID for yearly billing
  price_monthly INTEGER NOT NULL DEFAULT 0,     -- Price in cents (for display)
  price_yearly INTEGER NOT NULL DEFAULT 0,      -- Price in cents (for display)
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,    -- Plan limits
  features JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Feature list for display
  is_active BOOLEAN NOT NULL DEFAULT true,      -- Whether plan is available
  is_default BOOLEAN NOT NULL DEFAULT false,    -- Default plan for new signups
  sort_order INTEGER NOT NULL DEFAULT 0,        -- Display order
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one default plan allowed
CREATE UNIQUE INDEX idx_subscription_plans_default ON subscription_plans(is_default) WHERE is_default = true;

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================
-- Active subscriptions per tenant (one per tenant)

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
  
  -- Stripe fields
  stripe_customer_id TEXT,                      -- cus_xxx
  stripe_subscription_id TEXT UNIQUE,           -- sub_xxx (null for free plan)
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active',        -- 'trialing', 'active', 'past_due', 'canceled', 'unpaid'
  
  -- Billing period
  billing_interval TEXT,                        -- 'month' or 'year' (null for free)
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  
  -- Trial
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  
  -- Cancellation
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One subscription per tenant
  CONSTRAINT unique_tenant_subscription UNIQUE (tenant_id)
);

-- Indexes
CREATE INDEX idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_trial_end ON subscriptions(trial_end) WHERE trial_end IS NOT NULL;

-- Updated at trigger
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SUBSCRIPTION EVENTS TABLE
-- ============================================================================
-- Audit log for subscription changes

CREATE TABLE subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  
  event_type TEXT NOT NULL,                     -- 'created', 'upgraded', 'downgraded', 'renewed', 'canceled', 'trial_started', 'trial_ended', 'payment_failed'
  
  -- Plan changes
  from_plan_id TEXT REFERENCES subscription_plans(id),
  to_plan_id TEXT REFERENCES subscription_plans(id),
  
  -- Stripe event reference
  stripe_event_id TEXT,
  
  -- Additional data
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subscription_events_tenant ON subscription_events(tenant_id);
CREATE INDEX idx_subscription_events_subscription ON subscription_events(subscription_id);
CREATE INDEX idx_subscription_events_type ON subscription_events(event_type);
CREATE INDEX idx_subscription_events_created ON subscription_events(created_at DESC);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Plans are publicly readable (for pricing page)
CREATE POLICY "subscription_plans_select_public"
  ON subscription_plans
  FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

-- Service role can manage plans
CREATE POLICY "subscription_plans_service_role"
  ON subscription_plans
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can read their tenant's subscription
CREATE POLICY "subscriptions_select_own_tenant"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
  );

-- Service role can manage subscriptions
CREATE POLICY "subscriptions_service_role"
  ON subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can read their tenant's subscription events
CREATE POLICY "subscription_events_select_own_tenant"
  ON subscription_events
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
  );

-- Service role can manage events
CREATE POLICY "subscription_events_service_role"
  ON subscription_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get subscription with plan details for a tenant
CREATE OR REPLACE FUNCTION get_tenant_subscription(p_tenant_id UUID)
RETURNS TABLE (
  subscription_id UUID,
  plan_id TEXT,
  plan_name TEXT,
  status TEXT,
  billing_interval TEXT,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN,
  limits JSONB,
  features JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as subscription_id,
    s.plan_id,
    p.name as plan_name,
    s.status,
    s.billing_interval,
    s.current_period_end,
    s.trial_end,
    s.cancel_at_period_end,
    p.limits,
    p.features
  FROM subscriptions s
  JOIN subscription_plans p ON p.id = s.plan_id
  WHERE s.tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if tenant has access to a feature/limit
CREATE OR REPLACE FUNCTION check_subscription_limit(
  p_tenant_id UUID,
  p_limit_key TEXT,
  p_current_usage INTEGER DEFAULT 0
)
RETURNS TABLE (
  allowed BOOLEAN,
  limit_value INTEGER,
  current_usage INTEGER,
  plan_id TEXT
) AS $$
DECLARE
  v_limits JSONB;
  v_limit_value INTEGER;
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
  
  -- Get specific limit (-1 means unlimited)
  v_limit_value := COALESCE((v_limits->>p_limit_key)::INTEGER, 0);
  
  RETURN QUERY
  SELECT 
    v_limit_value = -1 OR p_current_usage < v_limit_value as allowed,
    v_limit_value as limit_value,
    p_current_usage as current_usage,
    v_plan_id as plan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get tenant usage stats
CREATE OR REPLACE FUNCTION get_tenant_usage(p_tenant_id UUID)
RETURNS TABLE (
  instances_count INTEGER,
  team_members_count INTEGER,
  oldest_snapshot_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM whmcs_instances WHERE tenant_id = p_tenant_id AND status = 'active') as instances_count,
    (SELECT COUNT(*)::INTEGER FROM user_tenants WHERE tenant_id = p_tenant_id) as team_members_count,
    (SELECT MIN(snapshot_date) FROM metrics_snapshots ms 
     JOIN whmcs_instances i ON i.id = ms.instance_id 
     WHERE i.tenant_id = p_tenant_id) as oldest_snapshot_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SEED DEFAULT PLANS
-- ============================================================================

INSERT INTO subscription_plans (id, name, description, price_monthly, price_yearly, limits, features, is_active, is_default, sort_order) VALUES
(
  'free',
  'Free',
  'Perfect for getting started',
  0,
  0,
  '{"instances": 1, "team_members": 1, "history_days": 30, "exports": false}'::jsonb,
  '["1 WHMCS instance", "30 days data history", "Basic metrics", "Community support"]'::jsonb,
  true,
  true,
  0
),
(
  'starter',
  'Starter',
  'For small hosting companies',
  1900,  -- $19.00
  18200, -- $182.00 (20% off)
  '{"instances": 3, "team_members": 2, "history_days": 90, "exports": true, "export_formats": ["pdf"]}'::jsonb,
  '["Up to 3 WHMCS instances", "90 days data history", "PDF exports", "Email support", "2 team members"]'::jsonb,
  true,
  false,
  1
),
(
  'pro',
  'Pro',
  'For growing businesses',
  4900,  -- $49.00
  47000, -- $470.00 (20% off)
  '{"instances": 10, "team_members": 5, "history_days": 365, "exports": true, "export_formats": ["pdf", "csv"]}'::jsonb,
  '["Up to 10 WHMCS instances", "1 year data history", "PDF & CSV exports", "Priority support", "5 team members"]'::jsonb,
  true,
  false,
  2
),
(
  'business',
  'Business',
  'For enterprises and agencies',
  9900,  -- $99.00
  95000, -- $950.00 (20% off)
  '{"instances": -1, "team_members": -1, "history_days": -1, "exports": true, "export_formats": ["pdf", "csv", "api"]}'::jsonb,
  '["Unlimited WHMCS instances", "Unlimited data history", "PDF, CSV & API exports", "Dedicated support", "Unlimited team members", "API access"]'::jsonb,
  true,
  false,
  3
);

-- ============================================================================
-- AUTO-CREATE SUBSCRIPTION FOR NEW TENANTS
-- ============================================================================

-- Function to create free subscription for new tenant
CREATE OR REPLACE FUNCTION create_tenant_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (tenant_id, plan_id, status)
  VALUES (NEW.id, 'free', 'active');
  
  -- Log the event
  INSERT INTO subscription_events (tenant_id, event_type, to_plan_id, metadata)
  VALUES (NEW.id, 'created', 'free', '{"source": "auto_create"}'::jsonb);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on tenant creation
CREATE TRIGGER on_tenant_created_subscription
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION create_tenant_subscription();

-- ============================================================================
-- CREATE SUBSCRIPTIONS FOR EXISTING TENANTS
-- ============================================================================

-- Create free subscriptions for any existing tenants that don't have one
INSERT INTO subscriptions (tenant_id, plan_id, status)
SELECT t.id, 'free', 'active'
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions s WHERE s.tenant_id = t.id
);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE subscription_plans IS 'Available subscription plans with limits and pricing';
COMMENT ON TABLE subscriptions IS 'Active subscriptions per tenant';
COMMENT ON TABLE subscription_events IS 'Audit log for subscription changes';
COMMENT ON COLUMN subscription_plans.limits IS 'JSON object with limit keys: instances, team_members, history_days, exports. -1 means unlimited.';
COMMENT ON COLUMN subscriptions.status IS 'Stripe subscription status: trialing, active, past_due, canceled, unpaid';
