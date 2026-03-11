-- Migration: Fix get_user_tenants function
-- Description: Recreate the function with currency field

-- Drop if exists and recreate
DROP FUNCTION IF EXISTS get_user_tenants(UUID);

-- Create get_user_tenants function with currency field
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
