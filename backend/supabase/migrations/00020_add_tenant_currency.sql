-- Migration: Add currency field to tenants table
-- Description: Allows each tenant to configure their preferred currency (EUR, USD, GBP)

-- Add currency column with EUR as default
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'EUR';

-- Add check constraint separately (in case column already exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenants_currency_check'
    ) THEN
        ALTER TABLE tenants ADD CONSTRAINT tenants_currency_check CHECK (currency IN ('EUR', 'USD', 'GBP'));
    END IF;
END $$;

-- Update existing tenants to have EUR
UPDATE tenants SET currency = 'EUR' WHERE currency IS NULL;

-- Add comment
COMMENT ON COLUMN tenants.currency IS 'Preferred currency for the tenant (EUR, USD, GBP). Default: EUR';

-- Drop existing function first to allow return type change
DROP FUNCTION IF EXISTS get_user_tenants(UUID);

-- Recreate get_user_tenants function with currency field
-- Note: role is user_role enum type, not TEXT
CREATE FUNCTION get_user_tenants(p_user_id UUID)
RETURNS TABLE (
    tenant_id UUID,
    tenant_name TEXT,
    tenant_slug TEXT,
    role user_role,
    is_default BOOLEAN,
    currency VARCHAR(3)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id as tenant_id,
        t.name as tenant_name,
        t.slug as tenant_slug,
        ut.role,
        ut.is_default,
        COALESCE(t.currency, 'EUR'::VARCHAR(3)) as currency
    FROM tenants t
    JOIN user_tenants ut ON t.id = ut.tenant_id
    WHERE ut.user_id = p_user_id
    AND t.status = 'active'
    ORDER BY ut.is_default DESC, t.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
