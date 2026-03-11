-- Migration: Add client name fields for identification
-- These fields help identify clients without exposing sensitive PII like email/phone

-- Add name columns to whmcs_clients
ALTER TABLE whmcs_clients
ADD COLUMN IF NOT EXISTS firstname TEXT,
ADD COLUMN IF NOT EXISTS lastname TEXT,
ADD COLUMN IF NOT EXISTS companyname TEXT;

-- Add index for searching by name
CREATE INDEX IF NOT EXISTS idx_clients_name 
ON whmcs_clients (instance_id, firstname, lastname);

CREATE INDEX IF NOT EXISTS idx_clients_company 
ON whmcs_clients (instance_id, companyname) 
WHERE companyname IS NOT NULL AND companyname != '';

-- Comment
COMMENT ON COLUMN whmcs_clients.firstname IS 'Client first name for identification';
COMMENT ON COLUMN whmcs_clients.lastname IS 'Client last name for identification';
COMMENT ON COLUMN whmcs_clients.companyname IS 'Company name if applicable';
