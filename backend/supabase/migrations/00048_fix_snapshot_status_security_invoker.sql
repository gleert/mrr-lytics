-- Switch views to security_invoker so they respect the querying user's RLS
-- instead of the view creator's. Resolves Supabase Security Advisor warnings:
--   "View public.v_snapshot_status is defined with the SECURITY DEFINER property"
--   "View public.user_tenants is defined with the SECURITY DEFINER property"
--
-- Without security_invoker the views run with the owner's privileges and
-- bypass RLS on the underlying tables, which would let any authenticated
-- reader see rows across all tenants.
--
-- Note: public.user_tenants exists as a view in production but as a table
-- in the migration history (see 00008). The ALTER below is a no-op against
-- a fresh table-based schema and only applies once the prod view exists.

ALTER VIEW public.v_snapshot_status SET (security_invoker = on);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'user_tenants' AND c.relkind = 'v'
  ) THEN
    EXECUTE 'ALTER VIEW public.user_tenants SET (security_invoker = on)';
  END IF;
END $$;
