-- Migration: Enable RLS on demo_instances table
-- Description: demo_instances was created without RLS, making the api_key column
-- readable via the PostgREST API with just the public anon key. The route that
-- uses this table (/api/demo/whmcs) runs server-side with service_role and
-- enforces its own key validation — no direct client access is needed.

ALTER TABLE demo_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo_instances_service_role"
  ON demo_instances FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
