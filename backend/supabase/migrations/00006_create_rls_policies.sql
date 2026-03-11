-- Migration: Create RLS policies for all WHMCS tables
-- Description: Row Level Security policies for instance data isolation

-- Helper function to get current instance ID from settings
CREATE OR REPLACE FUNCTION current_instance_id()
RETURNS UUID AS $$
BEGIN
    RETURN (current_setting('app.instance_id', true))::uuid;
END;
$$ LANGUAGE plpgsql STABLE;

-- WHMCS Clients policies
CREATE POLICY "Instance isolation for whmcs_clients"
ON whmcs_clients FOR ALL
USING (instance_id = current_instance_id());

CREATE POLICY "Service role full access whmcs_clients"
ON whmcs_clients FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- WHMCS Hosting policies
CREATE POLICY "Instance isolation for whmcs_hosting"
ON whmcs_hosting FOR ALL
USING (instance_id = current_instance_id());

CREATE POLICY "Service role full access whmcs_hosting"
ON whmcs_hosting FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- WHMCS Domains policies
CREATE POLICY "Instance isolation for whmcs_domains"
ON whmcs_domains FOR ALL
USING (instance_id = current_instance_id());

CREATE POLICY "Service role full access whmcs_domains"
ON whmcs_domains FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- WHMCS Products policies
CREATE POLICY "Instance isolation for whmcs_products"
ON whmcs_products FOR ALL
USING (instance_id = current_instance_id());

CREATE POLICY "Service role full access whmcs_products"
ON whmcs_products FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- WHMCS Product Groups policies
CREATE POLICY "Instance isolation for whmcs_product_groups"
ON whmcs_product_groups FOR ALL
USING (instance_id = current_instance_id());

CREATE POLICY "Service role full access whmcs_product_groups"
ON whmcs_product_groups FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- WHMCS Invoices policies
CREATE POLICY "Instance isolation for whmcs_invoices"
ON whmcs_invoices FOR ALL
USING (instance_id = current_instance_id());

CREATE POLICY "Service role full access whmcs_invoices"
ON whmcs_invoices FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- WHMCS Invoice Items policies
CREATE POLICY "Instance isolation for whmcs_invoice_items"
ON whmcs_invoice_items FOR ALL
USING (instance_id = current_instance_id());

CREATE POLICY "Service role full access whmcs_invoice_items"
ON whmcs_invoice_items FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- WHMCS Billable Items policies
CREATE POLICY "Instance isolation for whmcs_billable_items"
ON whmcs_billable_items FOR ALL
USING (instance_id = current_instance_id());

CREATE POLICY "Service role full access whmcs_billable_items"
ON whmcs_billable_items FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Comments
COMMENT ON FUNCTION current_instance_id IS 'Returns the current instance ID from app.instance_id session setting';
