-- Store the MRRlytics PHP module version reported by each WHMCS instance during sync
ALTER TABLE whmcs_instances
  ADD COLUMN IF NOT EXISTS module_version TEXT;

COMMENT ON COLUMN whmcs_instances.module_version IS
  'Version of the MRRlytics WHMCS addon installed on this instance, updated on every sync';
