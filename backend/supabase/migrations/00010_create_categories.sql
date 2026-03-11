-- Migration: Create categories table
-- Description: Categories belong to tenants and are shared across all WHMCS instances
-- Categories are used to group services/products for analytics purposes

-- Categories table (tenant level - shared across all instances)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#7C3AED',
    icon TEXT DEFAULT 'category',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, slug)
);

-- Category mappings - maps WHMCS products/groups to categories
-- This allows mapping products from different instances to the same category
CREATE TABLE category_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    instance_id UUID NOT NULL REFERENCES whmcs_instances(id) ON DELETE CASCADE,
    mapping_type TEXT NOT NULL CHECK (mapping_type IN ('product', 'product_group')),
    whmcs_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Each WHMCS item can only be mapped to one category per instance
    UNIQUE(instance_id, mapping_type, whmcs_id)
);

-- Indexes
CREATE INDEX idx_categories_tenant ON categories(tenant_id);
CREATE INDEX idx_categories_active ON categories(tenant_id, is_active);
CREATE INDEX idx_categories_sort ON categories(tenant_id, sort_order);
CREATE INDEX idx_category_mappings_category ON category_mappings(category_id);
CREATE INDEX idx_category_mappings_instance ON category_mappings(instance_id);
CREATE INDEX idx_category_mappings_lookup ON category_mappings(instance_id, mapping_type, whmcs_id);

-- Updated at trigger
CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for categories
-- Users can view categories from their tenants
CREATE POLICY "Tenant isolation for categories"
ON categories FOR ALL
USING (
    tenant_id IN (
        SELECT tenant_id FROM user_tenants 
        WHERE user_id = (current_setting('app.user_id', true))::uuid
    )
);

CREATE POLICY "Service role full access categories"
ON categories FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- RLS Policies for category_mappings
CREATE POLICY "Tenant isolation for category_mappings"
ON category_mappings FOR ALL
USING (
    category_id IN (
        SELECT c.id FROM categories c
        JOIN user_tenants ut ON c.tenant_id = ut.tenant_id
        WHERE ut.user_id = (current_setting('app.user_id', true))::uuid
    )
);

CREATE POLICY "Service role full access category_mappings"
ON category_mappings FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Comments
COMMENT ON TABLE categories IS 'Analytics categories for grouping products/services. Belong to tenant and shared across instances.';
COMMENT ON TABLE category_mappings IS 'Maps WHMCS products/product groups to analytics categories.';
COMMENT ON COLUMN categories.color IS 'Hex color for charts and UI display';
COMMENT ON COLUMN categories.icon IS 'Material Symbols icon name';
COMMENT ON COLUMN category_mappings.mapping_type IS 'Either product or product_group';
COMMENT ON COLUMN category_mappings.whmcs_id IS 'The WHMCS ID of the product or product group';
