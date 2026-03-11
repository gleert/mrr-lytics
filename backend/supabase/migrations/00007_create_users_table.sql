-- Migration: Create users table for dashboard authentication
-- This table links Supabase Auth users to tenants with role-based access

-- User roles enum
CREATE TYPE user_role AS ENUM ('admin', 'viewer');

-- Users table (links to tenants, not instances)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'viewer',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique email per tenant
  CONSTRAINT unique_email_per_tenant UNIQUE (tenant_id, email)
);

-- Index for faster lookups
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);

-- Updated at trigger
CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "users_select_own"
  ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Users can update their own profile (but not role or tenant)
CREATE POLICY "users_update_own"
  ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() 
    AND role = (SELECT role FROM users WHERE id = auth.uid())
    AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- Admins can read all users in their tenant
CREATE POLICY "admins_select_tenant_users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Admins can insert users in their tenant
CREATE POLICY "admins_insert_tenant_users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Admins can update users in their tenant
CREATE POLICY "admins_update_tenant_users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- Admins can delete users in their tenant (except themselves)
CREATE POLICY "admins_delete_tenant_users"
  ON users
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
    AND id != auth.uid()
  );

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_tenant_id UUID;
BEGIN
  -- Get the default/demo tenant (try multiple common names)
  -- Must use public schema explicitly since this runs in auth context
  SELECT id INTO default_tenant_id 
  FROM public.tenants 
  WHERE slug = 'demo-hosting' 
     OR name = 'Demo Hosting Company'
     OR name = 'Demo Tenant'
  LIMIT 1;
  
  -- If no default tenant exists, don't create the user record
  IF default_tenant_id IS NOT NULL THEN
    -- Create user profile
    INSERT INTO public.users (id, tenant_id, email, full_name, avatar_url, role)
    VALUES (
      NEW.id,
      default_tenant_id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
      NEW.raw_user_meta_data->>'avatar_url',
      'admin' -- First user gets admin role
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Also create user_tenants link
    INSERT INTO public.user_tenants (user_id, tenant_id, role, is_default)
    VALUES (
      NEW.id,
      default_tenant_id,
      'admin',
      true
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users to create profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function to update last_login_at
CREATE OR REPLACE FUNCTION update_last_login()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET last_login_at = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE users IS 'Dashboard users linked to Supabase Auth';
COMMENT ON COLUMN users.role IS 'User role: admin has full access, viewer has read-only access';
COMMENT ON COLUMN users.tenant_id IS 'The tenant (organization) this user belongs to';
