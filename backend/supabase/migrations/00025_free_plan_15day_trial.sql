-- Migration: Convert free plan to 15-day trial
-- Description: Free plan becomes a time-limited 15-day trial with restricted features

-- ============================================================================
-- UPDATE FREE PLAN DEFINITION
-- ============================================================================

UPDATE subscription_plans
SET
  name = 'Free Trial',
  description = 'Try MRRlytics free for 15 days',
  limits = '{"instances": 1, "team_members": 1, "history_days": 7, "exports": false, "webhooks": 0, "trial_days": 15}'::jsonb,
  features = '["1 WHMCS instance", "7 days data history", "Basic metrics only", "15-day trial period"]'::jsonb,
  updated_at = NOW()
WHERE id = 'free';

-- ============================================================================
-- UPDATE AUTO-CREATE TRIGGER: NEW TENANTS GET 15-DAY TRIAL
-- ============================================================================

CREATE OR REPLACE FUNCTION create_tenant_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (
    tenant_id,
    plan_id,
    status,
    trial_start,
    trial_end,
    current_period_start,
    current_period_end
  )
  VALUES (
    NEW.id,
    'free',
    'trialing',
    NOW(),
    NOW() + INTERVAL '15 days',
    NOW(),
    NOW() + INTERVAL '15 days'
  );

  -- Log the event
  INSERT INTO subscription_events (tenant_id, event_type, to_plan_id, metadata)
  VALUES (NEW.id, 'trial_started', 'free', '{"source": "auto_create", "trial_days": 15}'::jsonb);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MIGRATE EXISTING FREE PLAN USERS TO TRIALING (15 DAYS FROM NOW)
-- ============================================================================
-- Only migrate users currently on free plan with 'active' status (no trial set)

UPDATE subscriptions
SET
  status = 'trialing',
  trial_start = COALESCE(trial_start, created_at),
  trial_end = COALESCE(trial_end, created_at + INTERVAL '15 days'),
  current_period_start = COALESCE(current_period_start, created_at),
  current_period_end = COALESCE(current_period_end, created_at + INTERVAL '15 days'),
  updated_at = NOW()
WHERE plan_id = 'free'
  AND status = 'active'
  AND trial_end IS NULL;
