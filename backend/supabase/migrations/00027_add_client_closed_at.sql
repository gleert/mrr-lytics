-- Add closed_at to whmcs_clients
-- Populated from tblactivitylog entries where description = 'Client Status changed to Closed'

ALTER TABLE whmcs_clients
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

COMMENT ON COLUMN whmcs_clients.closed_at IS
  'Date the client status was changed to Closed in WHMCS, derived from tblactivitylog';

CREATE INDEX IF NOT EXISTS idx_whmcs_clients_closed_at
  ON whmcs_clients(instance_id, closed_at)
  WHERE closed_at IS NOT NULL;
