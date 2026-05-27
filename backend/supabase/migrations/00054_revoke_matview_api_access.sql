-- Revoke Data API access to the metrics materialized views.
--
-- Resolves Supabase Security Advisor warnings (lint 0016_materialized_view_in_api):
--   "Materialized view public.<name> is selectable by anon or authenticated roles"
--
-- Materialized views do NOT support RLS, so the only access control is the GRANT.
-- Supabase's default privileges grant anon/authenticated full access on creation,
-- which exposed cross-tenant MRR/client/revenue/invoice aggregates (every instance_id)
-- through the REST API to anyone holding the public anon key.
--
-- The backend reads these views exclusively via the service_role admin client
-- (see backend/src/lib/metrics/mrr.ts, revenue.ts), so revoking anon/authenticated
-- access does not affect the application. service_role and postgres keep full access.
--
-- IMPORTANT: any future migration that recreates one of these views with
-- DROP + CREATE MATERIALIZED VIEW will re-apply the default anon/authenticated
-- grants. Append the matching REVOKE at the end of such migrations.

DO $$
DECLARE
  mv text;
BEGIN
  FOREACH mv IN ARRAY ARRAY[
    'mv_client_summary',
    'mv_invoice_summary',
    'mv_mrr_by_cycle',
    'mv_mrr_current',
    'mv_revenue_by_product'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = mv AND c.relkind = 'm'
    ) THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated, PUBLIC', mv);
    END IF;
  END LOOP;
END $$;
