-- ==============================================
-- Auto-generate categories based on product types
-- ==============================================
-- This migration creates a function that automatically generates
-- categories for a tenant based on the product types found in their
-- WHMCS data. Categories are only created if they don't already exist.

-- Default category configurations for each product type
-- Maps WHMCS product types to category names and colors
CREATE OR REPLACE FUNCTION get_default_category_config(product_type TEXT)
RETURNS TABLE(cat_name TEXT, cat_slug TEXT, cat_color TEXT, cat_description TEXT, cat_sort_order INT) AS $$
BEGIN
  RETURN QUERY
  SELECT configs.name, configs.slug, configs.color, configs.description, configs.sort_order
  FROM (VALUES
    ('hostingaccount'::TEXT, 'Hosting'::TEXT, 'hosting'::TEXT, '#10B981'::TEXT, 'Web hosting accounts and shared hosting plans'::TEXT, 1::INT),
    ('server', 'Servers', 'servers', '#3B82F6', 'VPS, dedicated servers and cloud instances', 2),
    ('reselleraccount', 'Reseller', 'reseller', '#8B5CF6', 'Reseller hosting accounts', 3),
    ('other', 'Other Services', 'other-services', '#F59E0B', 'Additional services and add-ons', 4)
  ) AS configs(type, name, slug, color, description, sort_order)
  WHERE configs.type = product_type;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to auto-generate categories for a tenant based on their product types
CREATE OR REPLACE FUNCTION auto_generate_categories_for_tenant(p_tenant_id UUID)
RETURNS TABLE(category_id UUID, category_name TEXT, product_type TEXT, created BOOLEAN) AS $$
DECLARE
  v_product_type TEXT;
  v_config RECORD;
  v_category_id UUID;
  v_created BOOLEAN;
BEGIN
  -- Get distinct product types from this tenant's WHMCS instances
  FOR v_product_type IN
    SELECT DISTINCT wp.type
    FROM whmcs_products wp
    JOIN whmcs_instances wi ON wp.instance_id = wi.id
    WHERE wi.tenant_id = p_tenant_id
      AND wp.type IS NOT NULL
      AND wp.type != ''
  LOOP
    -- Get the default config for this type
    SELECT * INTO v_config FROM get_default_category_config(v_product_type);
    
    -- If we have a config for this type, create the category if it doesn't exist
    IF v_config.cat_name IS NOT NULL THEN
      -- Check if category with this slug already exists for this tenant
      SELECT id INTO v_category_id
      FROM categories
      WHERE tenant_id = p_tenant_id AND slug = v_config.cat_slug;
      
      IF v_category_id IS NULL THEN
        -- Create the category
        INSERT INTO categories (tenant_id, name, slug, color, description, sort_order)
        VALUES (p_tenant_id, v_config.cat_name, v_config.cat_slug, v_config.cat_color, v_config.cat_description, v_config.cat_sort_order)
        RETURNING id INTO v_category_id;
        
        v_created := TRUE;
      ELSE
        v_created := FALSE;
      END IF;
      
      -- Return result
      category_id := v_category_id;
      category_name := v_config.cat_name;
      product_type := v_product_type;
      created := v_created;
      RETURN NEXT;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-assign products to categories based on their type
-- This creates category_mappings for products that match the category's type
CREATE OR REPLACE FUNCTION auto_assign_products_to_categories(p_tenant_id UUID)
RETURNS TABLE(mappings_created INT, products_assigned INT) AS $$
DECLARE
  v_mappings_created INT := 0;
  v_products_assigned INT := 0;
  v_category RECORD;
  v_type_slug_map JSONB := '{
    "hostingaccount": "hosting",
    "server": "servers",
    "reselleraccount": "reseller",
    "other": "other-services"
  }'::JSONB;
  v_product RECORD;
BEGIN
  -- For each category that matches a product type
  FOR v_category IN
    SELECT c.id, c.slug
    FROM categories c
    WHERE c.tenant_id = p_tenant_id
      AND c.slug IN ('hosting', 'servers', 'reseller', 'other-services')
  LOOP
    -- Find products that should be in this category (by type)
    FOR v_product IN
      SELECT wp.id, wp.instance_id, wp.whmcs_id
      FROM whmcs_products wp
      JOIN whmcs_instances wi ON wp.instance_id = wi.id
      WHERE wi.tenant_id = p_tenant_id
        AND (v_type_slug_map->>wp.type) = v_category.slug
        -- Don't assign if already has a category mapping
        AND NOT EXISTS (
          SELECT 1 FROM category_mappings cm
          WHERE cm.instance_id = wp.instance_id
            AND cm.whmcs_id = wp.whmcs_id
            AND cm.mapping_type = 'product'
        )
    LOOP
      -- Create mapping (unique constraint is on instance_id, mapping_type, whmcs_id)
      INSERT INTO category_mappings (category_id, instance_id, whmcs_id, mapping_type)
      VALUES (v_category.id, v_product.instance_id, v_product.whmcs_id, 'product')
      ON CONFLICT (instance_id, mapping_type, whmcs_id) DO NOTHING;
      
      IF FOUND THEN
        v_mappings_created := v_mappings_created + 1;
      END IF;
      
      v_products_assigned := v_products_assigned + 1;
    END LOOP;
  END LOOP;
  
  mappings_created := v_mappings_created;
  products_assigned := v_products_assigned;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Combined function: generate categories AND assign products
CREATE OR REPLACE FUNCTION setup_default_categories_for_tenant(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_categories_result RECORD;
  v_assignment_result RECORD;
  v_categories JSONB := '[]'::JSONB;
BEGIN
  -- First, generate the categories
  FOR v_categories_result IN
    SELECT * FROM auto_generate_categories_for_tenant(p_tenant_id)
  LOOP
    v_categories := v_categories || jsonb_build_object(
      'id', v_categories_result.category_id,
      'name', v_categories_result.category_name,
      'product_type', v_categories_result.product_type,
      'created', v_categories_result.created
    );
  END LOOP;
  
  -- Then, auto-assign products to categories
  SELECT * INTO v_assignment_result FROM auto_assign_products_to_categories(p_tenant_id);
  
  RETURN jsonb_build_object(
    'categories', v_categories,
    'mappings_created', COALESCE(v_assignment_result.mappings_created, 0),
    'products_assigned', COALESCE(v_assignment_result.products_assigned, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION get_default_category_config(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION auto_generate_categories_for_tenant(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION auto_assign_products_to_categories(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION setup_default_categories_for_tenant(UUID) TO service_role;

COMMENT ON FUNCTION setup_default_categories_for_tenant IS 
'Automatically creates default categories based on product types and assigns products to them. 
Call this after syncing WHMCS data to set up initial categorization.';
