-- Add missing fields to whmcs_domains table
-- These fields are synced from WHMCS for complete domain management

ALTER TABLE whmcs_domains 
ADD COLUMN IF NOT EXISTS orderid BIGINT,
ADD COLUMN IF NOT EXISTS type TEXT,
ADD COLUMN IF NOT EXISTS registrationdate DATE,
ADD COLUMN IF NOT EXISTS nextinvoicedate DATE,
ADD COLUMN IF NOT EXISTS paymentmethod TEXT,
ADD COLUMN IF NOT EXISTS dnsmanagement BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS emailforwarding BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS idprotection BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS donotrenew BOOLEAN DEFAULT FALSE;

-- Add index for registration date queries
CREATE INDEX IF NOT EXISTS idx_whmcs_domains_registrationdate 
ON whmcs_domains(instance_id, registrationdate);

-- Add index for expiring domains queries  
CREATE INDEX IF NOT EXISTS idx_whmcs_domains_expiry_active
ON whmcs_domains(instance_id, expirydate) 
WHERE status = 'Active';
