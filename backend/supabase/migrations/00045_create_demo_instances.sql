-- Migration: Create demo_instances catalog
-- Description: Catalog of demo WHMCS endpoints. The /api/demo/whmcs route
-- looks up the API key in this table and uses (seed, start_date) to generate
-- deterministic but evolving sample data that the existing whmcs sync can
-- consume as if it were a real WHMCS instance.

CREATE TABLE demo_instances (
  api_key TEXT PRIMARY KEY,
  seed BIGINT NOT NULL,
  start_date DATE NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Public sample instance. The API key is intentionally non-secret because the
-- endpoint only exposes synthetic data; the seed keeps the dataset stable.
INSERT INTO demo_instances (api_key, seed, start_date, label) VALUES (
  'mrr_demo_b822911c03604af664dd7333b694bf7b',
  20260101,
  CURRENT_DATE - INTERVAL '180 days',
  'Demo · Acme Hosting'
);
