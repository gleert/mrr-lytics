-- ==============================================
-- Seed file for MRRlytics Development
-- ==============================================
-- This seed creates a development user and tenant
-- for quick local development and testing.
--
-- Dev Login Credentials:
--   Email: admin@example.com
--   Password: password123
--
-- UUIDs used (RFC 4122 v4 compliant):
--   Tenant:   a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d
--   Instance: b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e
--   User:     c3d4e5f6-a7b8-4c9d-ae0f-1a2b3c4d5e6f
-- ==============================================

-- 1. Create demo tenant
INSERT INTO tenants (id, name, slug, status, settings)
VALUES (
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  'Demo Hosting Company',
  'demo-hosting',
  'active',
  '{"timezone": "UTC"}'
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Create demo WHMCS instance (optional, for testing)
INSERT INTO whmcs_instances (id, tenant_id, name, slug, whmcs_url, status)
VALUES (
  'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  'Demo WHMCS',
  'demo-whmcs',
  'https://demo.whmcs.com',
  'active'
)
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- 3. Create dev user in auth.users
-- All string fields must be empty strings, not NULL (GoTrue requirement)
-- Note: instance_id here refers to the Supabase/GoTrue instance, not WHMCS
-- The default Supabase instance_id is the nil UUID
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change_token_current,
  email_change,
  reauthentication_token,
  phone,
  phone_change,
  phone_change_token,
  created_at,
  updated_at,
  role,
  aud
)
VALUES (
  'c3d4e5f6-a7b8-4c9d-ae0f-1a2b3c4d5e6f',
  '00000000-0000-0000-0000-000000000000',
  'admin@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"full_name": "Dev Admin", "name": "Dev Admin"}'::jsonb,
  false,
  false,
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  NOW(),
  NOW(),
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- 4. Create identity for the user (required for auth to work)
-- Note: 'email' column is auto-generated from identity_data->>'email'
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  created_at,
  updated_at
)
VALUES (
  'c3d4e5f6-a7b8-4c9d-ae0f-1a2b3c4d5e6f',
  'c3d4e5f6-a7b8-4c9d-ae0f-1a2b3c4d5e6f',
  '{"sub": "c3d4e5f6-a7b8-4c9d-ae0f-1a2b3c4d5e6f", "email": "admin@example.com", "email_verified": true}'::jsonb,
  'email',
  'admin@example.com',
  NOW(),
  NOW()
)
ON CONFLICT (provider, provider_id) DO NOTHING;

-- Note: The trigger `handle_new_user` should automatically create
-- the user profile in `users` and `user_tenants` tables.
-- If it doesn't fire (because we're inserting directly), we add them manually:

-- 5. Create user profile (in case trigger didn't fire)
INSERT INTO users (id, tenant_id, email, full_name, role)
VALUES (
  'c3d4e5f6-a7b8-4c9d-ae0f-1a2b3c4d5e6f',
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  'admin@example.com',
  'Dev Admin',
  'admin'
)
ON CONFLICT (id) DO NOTHING;

-- 6. Link user to tenant (in case trigger didn't fire)
INSERT INTO user_tenants (user_id, tenant_id, role, is_default)
VALUES (
  'c3d4e5f6-a7b8-4c9d-ae0f-1a2b3c4d5e6f',
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  'admin',
  true
)
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- 7. Auto-generate default categories based on product types
-- This will only create categories if products exist and categories don't
-- In a fresh seed, this won't create anything since there are no products yet
-- Categories will be auto-generated when the first sync happens
SELECT setup_default_categories_for_tenant('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');
