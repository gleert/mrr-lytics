-- Backfill invoice_action for billable items synced before the column was added.
--
-- Items where recur > 0 are recurring (invoiceaction = 4 in WHMCS).
-- Items where recur = 0 or recur IS NULL are non-recurring (invoiceaction != 4).
-- This covers the gap until all items are re-synced from WHMCS.

UPDATE whmcs_billable_items
SET invoice_action = 4
WHERE invoice_action IS NULL
  AND recur IS NOT NULL
  AND recur > 0;

-- Refresh materialized views to pick up the backfilled data.
REFRESH MATERIALIZED VIEW mv_mrr_current;
REFRESH MATERIALIZED VIEW mv_mrr_by_cycle;
