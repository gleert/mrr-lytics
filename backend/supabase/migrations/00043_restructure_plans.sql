-- Migration: Restructure subscription plans
-- Description: Replace Free/Starter/Pro/Business catalog with Starter/Advanced/Pro/Business
--   - New monthly-only pricing: $15 / $29 / $79 / $149
--   - New limits: clients (1k/2.5k/10k/unlimited), instances (1/2/5/unlimited),
--     history_days (365/730/1825/1825), api_access, account_manager, onboarding
--   - Free plan is retired (kept in DB for FK integrity, marked inactive)
--   - New tenants default to Starter in `active` status (no trial for now)
--   - Existing Free tenants are migrated to Starter (Free→Starter)
--   - get_tenant_usage RPC extended with clients_count

-- ============================================================================
-- ALLOW NULL price_yearly (no annual pricing for now)
-- ============================================================================

ALTER TABLE subscription_plans ALTER COLUMN price_yearly DROP NOT NULL;

-- ============================================================================
-- RETIRE FREE PLAN FIRST (free is currently is_default=true; clear it before
-- promoting Starter to default, so the unique partial index on is_default
-- never sees two TRUEs at once)
-- ============================================================================

UPDATE subscription_plans
SET
  is_active = false,
  is_default = false,
  updated_at = NOW()
WHERE id = 'free';

-- ============================================================================
-- UPDATE EXISTING PLANS: Starter (new default), Pro, Business
-- ============================================================================

UPDATE subscription_plans
SET
  name = 'Starter',
  description = 'For small hosting businesses',
  price_monthly = 1500,  -- $15.00
  price_yearly = NULL,
  limits = '{"instances": 1, "team_members": 1, "history_days": 365, "exports": true, "clients": 1000, "api_access": false, "account_manager": false, "onboarding": false}'::jsonb,
  features = '["Up to 1.000 clients", "1 WHMCS instance", "1 year data history", "Email support"]'::jsonb,
  is_active = true,
  is_default = true,
  sort_order = 1,
  updated_at = NOW()
WHERE id = 'starter';

UPDATE subscription_plans
SET
  name = 'Pro',
  description = 'For established companies',
  price_monthly = 7900,  -- $79.00
  price_yearly = NULL,
  limits = '{"instances": 5, "team_members": 10, "history_days": 1825, "exports": true, "clients": 10000, "api_access": true, "account_manager": false, "onboarding": false}'::jsonb,
  features = '["Up to 10.000 clients", "5 WHMCS instances", "5 years data history", "API access", "Email support"]'::jsonb,
  is_active = true,
  is_default = false,
  sort_order = 3,
  updated_at = NOW()
WHERE id = 'pro';

UPDATE subscription_plans
SET
  name = 'Business',
  description = 'For enterprises and agencies',
  price_monthly = 14900,  -- $149.00
  price_yearly = NULL,
  limits = '{"instances": -1, "team_members": -1, "history_days": 1825, "exports": true, "clients": -1, "api_access": true, "account_manager": true, "onboarding": true}'::jsonb,
  features = '["Unlimited clients", "Unlimited WHMCS instances", "5 years data history", "API access", "Dedicated account manager", "Onboarding assistance"]'::jsonb,
  is_active = true,
  is_default = false,
  sort_order = 4,
  updated_at = NOW()
WHERE id = 'business';

-- ============================================================================
-- INSERT NEW PLAN: Advanced
-- ============================================================================

INSERT INTO subscription_plans (
  id, name, description, price_monthly, price_yearly,
  limits, features, is_active, is_default, sort_order
) VALUES (
  'advanced',
  'Advanced',
  'For growing hosting providers',
  2900,  -- $29.00
  NULL,
  '{"instances": 2, "team_members": 3, "history_days": 730, "exports": true, "clients": 2500, "api_access": false, "account_manager": false, "onboarding": false}'::jsonb,
  '["Up to 2.500 clients", "2 WHMCS instances", "2 years data history", "Email support"]'::jsonb,
  true,
  false,
  2
);

-- ============================================================================
-- MIGRATE EXISTING FREE TENANTS TO STARTER
-- ============================================================================

WITH migrated AS (
  UPDATE subscriptions
  SET
    plan_id = 'starter',
    status = 'active',
    trial_start = NULL,
    trial_end = NULL,
    updated_at = NOW()
  WHERE plan_id = 'free'
  RETURNING tenant_id, id AS subscription_id
)
INSERT INTO subscription_events (tenant_id, subscription_id, event_type, from_plan_id, to_plan_id, metadata)
SELECT
  tenant_id,
  subscription_id,
  'upgraded',
  'free',
  'starter',
  '{"source": "plan_restructure_2026_04"}'::jsonb
FROM migrated;

-- ============================================================================
-- REPLACE AUTO-CREATE TRIGGER: NEW TENANTS GET STARTER (ACTIVE, NO TRIAL)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_tenant_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (
    tenant_id,
    plan_id,
    status
  )
  VALUES (
    NEW.id,
    'starter',
    'active'
  );

  INSERT INTO subscription_events (tenant_id, event_type, to_plan_id, metadata)
  VALUES (NEW.id, 'created', 'starter', '{"source": "auto_create"}'::jsonb);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- EXTEND get_tenant_usage RPC: ADD clients_count
-- (DROP first because the OUT column set changes — Postgres won't replace it)
-- ============================================================================

DROP FUNCTION IF EXISTS get_tenant_usage(UUID);

CREATE FUNCTION get_tenant_usage(p_tenant_id UUID)
RETURNS TABLE (
  instances_count INTEGER,
  team_members_count INTEGER,
  clients_count INTEGER,
  oldest_snapshot_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER
       FROM whmcs_instances
       WHERE tenant_id = p_tenant_id
         AND status = 'active') AS instances_count,
    (SELECT COUNT(*)::INTEGER
       FROM user_tenants
       WHERE tenant_id = p_tenant_id) AS team_members_count,
    (SELECT COUNT(*)::INTEGER
       FROM whmcs_clients wc
       JOIN whmcs_instances wi ON wi.id = wc.instance_id
       WHERE wi.tenant_id = p_tenant_id) AS clients_count,
    (SELECT MIN(snapshot_date)
       FROM metrics_snapshots ms
       JOIN whmcs_instances i ON i.id = ms.instance_id
       WHERE i.tenant_id = p_tenant_id) AS oldest_snapshot_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
