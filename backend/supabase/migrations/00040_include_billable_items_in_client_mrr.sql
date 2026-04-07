-- Include recurring billable items in client current_mrr.
--
-- update_client_metrics previously summed whmcs_hosting.monthly_amount + domain MRR.
-- Recurring billable items (invoice_action=4, invoicecount>0, not expired) are
-- real committed revenue per client and should be included.

CREATE OR REPLACE FUNCTION update_client_metrics(p_instance_id UUID, p_client_id BIGINT DEFAULT NULL)
RETURNS void AS $$
BEGIN
    UPDATE whmcs_clients c
    SET
        current_mrr = COALESCE((
            SELECT SUM(monthly_amount)
            FROM whmcs_hosting h
            WHERE h.instance_id = c.instance_id
              AND h.client_id = c.whmcs_id
              AND h.domainstatus = 'Active'
        ), 0) + COALESCE((
            SELECT SUM(
                COALESCE(recurringamount, 0) /
                (COALESCE(NULLIF(registrationperiod, 0), 1) * 12)
            )
            FROM whmcs_domains d
            WHERE d.instance_id = c.instance_id
              AND d.client_id = c.whmcs_id
              AND d.status = 'Active'
              AND COALESCE(recurringamount, 0) > 0
        ), 0) + COALESCE((
            SELECT SUM(normalize_to_monthly(amount, recurcycle))
            FROM whmcs_billable_items b
            WHERE b.instance_id = c.instance_id
              AND b.client_id = c.whmcs_id
              AND b.invoice_action = 4
              AND b.invoicecount > 0
              AND (b.recurfor = 0 OR b.invoicecount < b.recurfor)
        ), 0),
        services_count = COALESCE((
            SELECT COUNT(*)
            FROM whmcs_hosting h
            WHERE h.instance_id = c.instance_id
              AND h.client_id = c.whmcs_id
              AND h.domainstatus = 'Active'
        ), 0),
        domains_count = COALESCE((
            SELECT COUNT(*)
            FROM whmcs_domains d
            WHERE d.instance_id = c.instance_id
              AND d.client_id = c.whmcs_id
              AND d.status = 'Active'
        ), 0),
        total_paid = COALESCE((
            SELECT SUM(total)
            FROM whmcs_invoices i
            WHERE i.instance_id = c.instance_id
              AND i.client_id = c.whmcs_id
              AND i.status = 'Paid'
        ), 0),
        first_payment_date = (
            SELECT MIN(DATE(datepaid))
            FROM whmcs_invoices i
            WHERE i.instance_id = c.instance_id
              AND i.client_id = c.whmcs_id
              AND i.status = 'Paid'
              AND i.datepaid IS NOT NULL
        ),
        last_payment_date = (
            SELECT MAX(DATE(datepaid))
            FROM whmcs_invoices i
            WHERE i.instance_id = c.instance_id
              AND i.client_id = c.whmcs_id
              AND i.status = 'Paid'
              AND i.datepaid IS NOT NULL
        )
    WHERE c.instance_id = p_instance_id
      AND (p_client_id IS NULL OR c.whmcs_id = p_client_id);
END;
$$ LANGUAGE plpgsql;

-- Backfill all existing clients across all instances
DO $$
DECLARE
    v_instance RECORD;
BEGIN
    FOR v_instance IN SELECT id FROM whmcs_instances LOOP
        PERFORM update_client_metrics(v_instance.id);
    END LOOP;
END;
$$;
