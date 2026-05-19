/**
 * Single source of truth for the latest released WHMCS addon module version.
 *
 * Consumed by:
 *   - /api/module/version (endpoint the WHMCS module + dashboard banner poll)
 *   - lib/demo/generator (so the demo instance reports the current version)
 *
 * When releasing a new module version, update this file only.
 */
export const LATEST_MODULE_VERSION = '1.3.5'

export const LATEST_MODULE_RELEASE = {
  version: LATEST_MODULE_VERSION,
  release_notes:
    'Fix module version reporting (broken in 1.3.3/1.3.4) so the dashboard can detect outdated installs',
  download_url: `https://imcxbwcdfmtjeothypcg.supabase.co/storage/v1/object/public/module-downloads/mrrlytics-module-v${LATEST_MODULE_VERSION}.zip`,
  released_at: '2026-05-19',
} as const
