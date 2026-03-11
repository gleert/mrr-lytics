-- Migration: Create WHMCS mirror tables
-- Description: Tables that mirror data synced from WHMCS installations
-- Note: All tables reference instance_id (not tenant_id) since data comes from specific WHMCS instances

-- WHMCS Clients
CREATE TABLE whmcs_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES whmcs_instances(id) ON DELETE CASCADE,
    whmcs_id BIGINT NOT NULL,
    currency INTEGER,
    status TEXT,
    datecreated DATE,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(instance_id, whmcs_id)
);

-- WHMCS Hosting/Services
CREATE TABLE whmcs_hosting (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES whmcs_instances(id) ON DELETE CASCADE,
    whmcs_id BIGINT NOT NULL,
    client_id BIGINT,
    packageid BIGINT,
    domain TEXT,
    paymentmethod TEXT,
    firstpaymentamount DECIMAL(10,2),
    amount DECIMAL(10,2),
    billingcycle TEXT,
    nextduedate DATE,
    nextinvoicedate DATE,
    domainstatus TEXT,
    regdate DATE,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(instance_id, whmcs_id)
);

-- WHMCS Domains
CREATE TABLE whmcs_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES whmcs_instances(id) ON DELETE CASCADE,
    whmcs_id BIGINT NOT NULL,
    client_id BIGINT,
    domain TEXT,
    firstpaymentamount DECIMAL(10,2),
    recurringamount DECIMAL(10,2),
    registrationperiod INTEGER,
    expirydate DATE,
    nextduedate DATE,
    status TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(instance_id, whmcs_id)
);

-- WHMCS Products
CREATE TABLE whmcs_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES whmcs_instances(id) ON DELETE CASCADE,
    whmcs_id BIGINT NOT NULL,
    gid BIGINT,
    name TEXT,
    type TEXT,
    paytype TEXT,
    hidden INTEGER,
    retired INTEGER,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(instance_id, whmcs_id)
);

-- WHMCS Product Groups
CREATE TABLE whmcs_product_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES whmcs_instances(id) ON DELETE CASCADE,
    whmcs_id BIGINT NOT NULL,
    name TEXT,
    slug TEXT,
    hidden INTEGER,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(instance_id, whmcs_id)
);

-- WHMCS Invoices
CREATE TABLE whmcs_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES whmcs_instances(id) ON DELETE CASCADE,
    whmcs_id BIGINT NOT NULL,
    client_id BIGINT,
    invoicenum TEXT,
    date DATE,
    duedate DATE,
    datepaid TIMESTAMPTZ,
    subtotal DECIMAL(10,2),
    credit DECIMAL(10,2),
    tax DECIMAL(10,2),
    tax2 DECIMAL(10,2),
    total DECIMAL(10,2),
    status TEXT,
    paymentmethod TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(instance_id, whmcs_id)
);

-- WHMCS Invoice Items
CREATE TABLE whmcs_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES whmcs_instances(id) ON DELETE CASCADE,
    whmcs_id BIGINT NOT NULL,
    invoice_id BIGINT,
    client_id BIGINT,
    type TEXT,
    relid BIGINT,
    description TEXT,
    amount DECIMAL(10,2),
    taxed INTEGER,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(instance_id, whmcs_id)
);

-- WHMCS Billable Items
CREATE TABLE whmcs_billable_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES whmcs_instances(id) ON DELETE CASCADE,
    whmcs_id BIGINT NOT NULL,
    client_id BIGINT,
    description TEXT,
    amount DECIMAL(10,2),
    recur INTEGER,
    recurcycle TEXT,
    recurfor INTEGER,
    duedate DATE,
    invoicecount INTEGER,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(instance_id, whmcs_id)
);

-- Indexes for common queries
CREATE INDEX idx_whmcs_clients_instance ON whmcs_clients(instance_id);
CREATE INDEX idx_whmcs_hosting_instance ON whmcs_hosting(instance_id);
CREATE INDEX idx_whmcs_hosting_status ON whmcs_hosting(instance_id, domainstatus);
CREATE INDEX idx_whmcs_hosting_cycle ON whmcs_hosting(instance_id, billingcycle);
CREATE INDEX idx_whmcs_domains_instance ON whmcs_domains(instance_id);
CREATE INDEX idx_whmcs_domains_status ON whmcs_domains(instance_id, status);
CREATE INDEX idx_whmcs_products_instance ON whmcs_products(instance_id);
CREATE INDEX idx_whmcs_invoices_instance ON whmcs_invoices(instance_id);
CREATE INDEX idx_whmcs_invoices_status ON whmcs_invoices(instance_id, status);
CREATE INDEX idx_whmcs_invoices_date ON whmcs_invoices(instance_id, datepaid);
CREATE INDEX idx_whmcs_invoice_items_instance ON whmcs_invoice_items(instance_id);
CREATE INDEX idx_whmcs_invoice_items_invoice ON whmcs_invoice_items(instance_id, invoice_id);

-- Enable RLS on all tables
ALTER TABLE whmcs_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE whmcs_hosting ENABLE ROW LEVEL SECURITY;
ALTER TABLE whmcs_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE whmcs_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE whmcs_product_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE whmcs_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE whmcs_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE whmcs_billable_items ENABLE ROW LEVEL SECURITY;
