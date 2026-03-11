-- Migration: Add color field to whmcs_instances
-- Description: Allow users to assign a color to each WHMCS instance for visual identification

ALTER TABLE whmcs_instances ADD COLUMN color TEXT DEFAULT '#7C3AED';

COMMENT ON COLUMN whmcs_instances.color IS 'Hex color code for visual identification in the dashboard';
