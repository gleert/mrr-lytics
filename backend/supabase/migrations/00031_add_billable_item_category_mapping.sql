-- Allow billable items to be assigned to categories (same system as products).
ALTER TABLE category_mappings
  DROP CONSTRAINT IF EXISTS category_mappings_mapping_type_check;

ALTER TABLE category_mappings
  ADD CONSTRAINT category_mappings_mapping_type_check
  CHECK (mapping_type IN ('product', 'product_group', 'billable_item'));
