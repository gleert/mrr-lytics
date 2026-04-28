-- Migration: Remove team_members from plan limits
-- Description: Drop the team_members key from subscription_plans.limits across
-- all plans. The number of team members is no longer enforced per plan.

UPDATE subscription_plans
SET
  limits = limits - 'team_members',
  updated_at = NOW()
WHERE limits ? 'team_members';
