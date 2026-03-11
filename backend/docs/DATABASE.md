# MRRlytics Database Schema

## Overview

MRRlytics uses PostgreSQL via Supabase with Row Level Security (RLS) for multi-tenant data isolation.

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE SCHEMA                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────┐                                                             │
│  │   tenants   │◀────────────────────────────────────────────────────────┐  │
│  ├─────────────┤                                                          │  │
│  │ id (PK)     │                                                          │  │
│  │ name        │                                                          │  │
│  │ slug        │    ┌─────────────┐    ┌─────────────┐                   │  │
│  │ whmcs_url   │    │  api_keys   │    │  sync_logs  │                   │  │
│  │ whmcs_api_  │◀───┤─────────────│◀───┤─────────────│                   │  │
│  │   key       │    │ tenant_id   │    │ tenant_id   │                   │  │
│  │ status      │    │ key_hash    │    │ status      │                   │  │
│  │ settings    │    │ scopes      │    │ sync_type   │                   │  │
│  │ created_at  │    │ expires_at  │    │ records_    │                   │  │
│  │ updated_at  │    └─────────────┘    │   synced    │                   │  │
│  └─────────────┘                       └─────────────┘                   │  │
│         │                                                                 │  │
│         │                                                                 │  │
│         ▼                                                                 │  │
│  ┌──────────────────────────────────────────────────────────────────────┐│  │
│  │                        WHMCS Data Tables                              ││  │
│  ├──────────────────────────────────────────────────────────────────────┤│  │
│  │                                                                       ││  │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐            ││  │
│  │  │ whmcs_clients │  │ whmcs_products│  │whmcs_hosting  │            ││  │
│  │  ├───────────────┤  ├───────────────┤  ├───────────────┤            ││  │
│  │  │ tenant_id (FK)│  │ tenant_id (FK)│  │ tenant_id (FK)│            ││  │
│  │  │ whmcs_id      │  │ whmcs_id      │  │ whmcs_id      │            ││  │
│  │  │ status        │  │ name          │  │ client_id     │            ││  │
│  │  │ datecreated   │  │ type          │  │ amount        │            ││  │
│  │  │ currency      │  │ paytype       │  │ billingcycle  │            ││  │
│  │  └───────────────┘  └───────────────┘  │ domainstatus  │            ││  │
│  │                                         └───────────────┘            ││  │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐            ││  │
│  │  │ whmcs_domains │  │whmcs_invoices │  │whmcs_invoice_ │            ││  │
│  │  │               │  │               │  │    items      │            ││  │
│  │  ├───────────────┤  ├───────────────┤  ├───────────────┤            ││  │
│  │  │ tenant_id (FK)│  │ tenant_id (FK)│  │ tenant_id (FK)│            ││  │
│  │  │ whmcs_id      │  │ whmcs_id      │  │ whmcs_id      │            ││  │
│  │  │ client_id     │  │ client_id     │  │ invoice_id    │            ││  │
│  │  │ recurringamt  │  │ total         │  │ amount        │            ││  │
│  │  │ status        │  │ status        │  │ type          │            ││  │
│  │  └───────────────┘  │ datepaid      │  └───────────────┘            ││  │
│  │                     └───────────────┘                                ││  │
│  │  ┌───────────────┐                                                   ││  │
│  │  │whmcs_billable │                                                   ││  │
│  │  │    _items     │                                                   ││  │
│  │  ├───────────────┤                                                   ││  │
│  │  │ tenant_id (FK)│                                                   ││  │
│  │  │ whmcs_id      │                                                   ││  │
│  │  │ client_id     │                                                   ││  │
│  │  │ amount        │                                                   ││  │
│  │  │ recur         │                                                   ││  │
│  │  │ recurcycle    │                                                   ││  │
│  │  └───────────────┘                                                   ││  │
│  └──────────────────────────────────────────────────────────────────────┘│  │
│                                                                          │  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Tables

### tenants

Core table for multi-tenant support.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | gen_random_uuid() | Primary key |
| `name` | TEXT | No | - | Display name |
| `slug` | TEXT | No | - | URL-safe identifier (unique) |
| `whmcs_url` | TEXT | No | - | WHMCS addon API URL |
| `whmcs_api_key` | TEXT | No | - | WHMCS addon API key |
| `status` | TEXT | No | 'active' | active, inactive, suspended |
| `settings` | JSONB | No | '{}' | Custom settings |
| `created_at` | TIMESTAMPTZ | No | NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | NOW() | Last update timestamp |

**Indexes:**
- `tenants_slug_key` UNIQUE (slug)

---

### api_keys

API keys for tenant authentication.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | gen_random_uuid() | Primary key |
| `tenant_id` | UUID | No | - | Foreign key to tenants |
| `name` | TEXT | No | - | Key name/description |
| `key_hash` | TEXT | No | - | SHA-256 hash of key |
| `key_prefix` | TEXT | No | - | First 8 chars for ID |
| `scopes` | TEXT[] | No | '{read}' | Permission scopes |
| `last_used_at` | TIMESTAMPTZ | Yes | NULL | Last usage timestamp |
| `expires_at` | TIMESTAMPTZ | Yes | NULL | Expiration (null=never) |
| `created_at` | TIMESTAMPTZ | No | NOW() | Creation timestamp |

**Indexes:**
- `api_keys_key_hash_key` UNIQUE (key_hash)
- `idx_api_keys_tenant` (tenant_id)

**Foreign Keys:**
- `tenant_id` → `tenants(id)` ON DELETE CASCADE

---

### whmcs_clients

Synced client data from WHMCS.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | gen_random_uuid() | Primary key |
| `tenant_id` | UUID | No | - | Foreign key to tenants |
| `whmcs_id` | INTEGER | No | - | WHMCS client ID |
| `currency` | INTEGER | Yes | NULL | Currency ID |
| `status` | TEXT | Yes | NULL | Active, Inactive, Closed |
| `datecreated` | DATE | Yes | NULL | Client creation date |
| `synced_at` | TIMESTAMPTZ | No | NOW() | Last sync timestamp |

**Indexes:**
- `whmcs_clients_tenant_whmcs_key` UNIQUE (tenant_id, whmcs_id)
- `idx_whmcs_clients_status` (tenant_id, status)

---

### whmcs_hosting

Synced hosting/service data from WHMCS.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | gen_random_uuid() | Primary key |
| `tenant_id` | UUID | No | - | Foreign key to tenants |
| `whmcs_id` | INTEGER | No | - | WHMCS hosting ID |
| `client_id` | INTEGER | Yes | NULL | WHMCS client ID |
| `packageid` | INTEGER | Yes | NULL | Product package ID |
| `domain` | TEXT | Yes | NULL | Domain name |
| `paymentmethod` | TEXT | Yes | NULL | Payment method |
| `firstpaymentamount` | DECIMAL(10,2) | Yes | NULL | Initial payment |
| `amount` | DECIMAL(10,2) | Yes | NULL | Recurring amount |
| `billingcycle` | TEXT | Yes | NULL | Monthly, Quarterly, etc. |
| `nextduedate` | DATE | Yes | NULL | Next billing date |
| `nextinvoicedate` | DATE | Yes | NULL | Next invoice date |
| `domainstatus` | TEXT | Yes | NULL | Active, Suspended, etc. |
| `regdate` | DATE | Yes | NULL | Registration date |
| `synced_at` | TIMESTAMPTZ | No | NOW() | Last sync timestamp |

**Indexes:**
- `whmcs_hosting_tenant_whmcs_key` UNIQUE (tenant_id, whmcs_id)
- `idx_whmcs_hosting_status` (tenant_id, domainstatus)
- `idx_whmcs_hosting_client` (tenant_id, client_id)

---

### whmcs_domains

Synced domain registration data from WHMCS.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | gen_random_uuid() | Primary key |
| `tenant_id` | UUID | No | - | Foreign key to tenants |
| `whmcs_id` | INTEGER | No | - | WHMCS domain ID |
| `client_id` | INTEGER | Yes | NULL | WHMCS client ID |
| `domain` | TEXT | Yes | NULL | Domain name |
| `firstpaymentamount` | DECIMAL(10,2) | Yes | NULL | Initial payment |
| `recurringamount` | DECIMAL(10,2) | Yes | NULL | Recurring amount |
| `registrationperiod` | INTEGER | Yes | NULL | Period in years |
| `expirydate` | DATE | Yes | NULL | Domain expiry date |
| `nextduedate` | DATE | Yes | NULL | Next billing date |
| `status` | TEXT | Yes | NULL | Active, Expired, etc. |
| `synced_at` | TIMESTAMPTZ | No | NOW() | Last sync timestamp |

**Indexes:**
- `whmcs_domains_tenant_whmcs_key` UNIQUE (tenant_id, whmcs_id)
- `idx_whmcs_domains_status` (tenant_id, status)

---

### whmcs_products

Synced product definitions from WHMCS.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | gen_random_uuid() | Primary key |
| `tenant_id` | UUID | No | - | Foreign key to tenants |
| `whmcs_id` | INTEGER | No | - | WHMCS product ID |
| `gid` | INTEGER | Yes | NULL | Product group ID |
| `name` | TEXT | Yes | NULL | Product name |
| `type` | TEXT | Yes | NULL | hostingaccount, reselleraccount, etc. |
| `paytype` | TEXT | Yes | NULL | free, onetime, recurring |
| `hidden` | INTEGER | Yes | NULL | Hidden from order (0/1) |
| `retired` | INTEGER | Yes | NULL | Retired product (0/1) |
| `synced_at` | TIMESTAMPTZ | No | NOW() | Last sync timestamp |

**Indexes:**
- `whmcs_products_tenant_whmcs_key` UNIQUE (tenant_id, whmcs_id)

---

### whmcs_invoices

Synced invoice headers from WHMCS.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | gen_random_uuid() | Primary key |
| `tenant_id` | UUID | No | - | Foreign key to tenants |
| `whmcs_id` | INTEGER | No | - | WHMCS invoice ID |
| `client_id` | INTEGER | Yes | NULL | WHMCS client ID |
| `invoicenum` | TEXT | Yes | NULL | Invoice number |
| `date` | DATE | Yes | NULL | Invoice date |
| `duedate` | DATE | Yes | NULL | Due date |
| `datepaid` | DATE | Yes | NULL | Payment date |
| `subtotal` | DECIMAL(10,2) | Yes | NULL | Subtotal amount |
| `credit` | DECIMAL(10,2) | Yes | NULL | Credit applied |
| `tax` | DECIMAL(10,2) | Yes | NULL | Tax amount |
| `tax2` | DECIMAL(10,2) | Yes | NULL | Secondary tax |
| `total` | DECIMAL(10,2) | Yes | NULL | Total amount |
| `status` | TEXT | Yes | NULL | Paid, Unpaid, Cancelled |
| `paymentmethod` | TEXT | Yes | NULL | Payment method |
| `synced_at` | TIMESTAMPTZ | No | NOW() | Last sync timestamp |

**Indexes:**
- `whmcs_invoices_tenant_whmcs_key` UNIQUE (tenant_id, whmcs_id)
- `idx_whmcs_invoices_status` (tenant_id, status)
- `idx_whmcs_invoices_date` (tenant_id, date)

---

### whmcs_invoice_items

Synced invoice line items from WHMCS.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | gen_random_uuid() | Primary key |
| `tenant_id` | UUID | No | - | Foreign key to tenants |
| `whmcs_id` | INTEGER | No | - | WHMCS invoice item ID |
| `invoice_id` | INTEGER | Yes | NULL | WHMCS invoice ID |
| `client_id` | INTEGER | Yes | NULL | WHMCS client ID |
| `type` | TEXT | Yes | NULL | Hosting, Domain, etc. |
| `relid` | INTEGER | Yes | NULL | Related ID |
| `description` | TEXT | Yes | NULL | Line description |
| `amount` | DECIMAL(10,2) | Yes | NULL | Line amount |
| `taxed` | INTEGER | Yes | NULL | Is taxed (0/1) |
| `synced_at` | TIMESTAMPTZ | No | NOW() | Last sync timestamp |

**Indexes:**
- `whmcs_invoice_items_tenant_whmcs_key` UNIQUE (tenant_id, whmcs_id)
- `idx_whmcs_invoice_items_invoice` (tenant_id, invoice_id)

---

### whmcs_billable_items

Synced billable items from WHMCS.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | gen_random_uuid() | Primary key |
| `tenant_id` | UUID | No | - | Foreign key to tenants |
| `whmcs_id` | INTEGER | No | - | WHMCS billable item ID |
| `client_id` | INTEGER | Yes | NULL | WHMCS client ID |
| `description` | TEXT | Yes | NULL | Item description |
| `amount` | DECIMAL(10,2) | Yes | NULL | Recurring amount |
| `recur` | INTEGER | Yes | NULL | Is recurring (0/1) |
| `recurcycle` | TEXT | Yes | NULL | Days, Weeks, Months, Years |
| `recurfor` | INTEGER | Yes | NULL | Recur for N cycles |
| `duedate` | DATE | Yes | NULL | Next due date |
| `invoicecount` | INTEGER | Yes | NULL | Times invoiced |
| `synced_at` | TIMESTAMPTZ | No | NOW() | Last sync timestamp |

**Indexes:**
- `whmcs_billable_items_tenant_whmcs_key` UNIQUE (tenant_id, whmcs_id)

---

### sync_logs

Log of sync operations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | gen_random_uuid() | Primary key |
| `tenant_id` | UUID | No | - | Foreign key to tenants |
| `started_at` | TIMESTAMPTZ | No | NOW() | Sync start time |
| `completed_at` | TIMESTAMPTZ | Yes | NULL | Sync completion time |
| `status` | TEXT | No | 'running' | running, completed, failed |
| `sync_type` | TEXT | No | 'full' | full, incremental |
| `records_synced` | JSONB | No | '{}' | Count per table |
| `error_message` | TEXT | Yes | NULL | Error details |
| `duration_ms` | INTEGER | Yes | NULL | Duration in ms |
| `triggered_by` | TEXT | No | 'manual' | manual, cron, webhook |

**Indexes:**
- `idx_sync_logs_tenant` (tenant_id)
- `idx_sync_logs_started` (tenant_id, started_at DESC)

---

## Materialized Views

### mv_client_summary

Pre-aggregated client counts by status.

```sql
CREATE MATERIALIZED VIEW mv_client_summary AS
SELECT
  tenant_id,
  COUNT(*) FILTER (WHERE status = 'Active') AS active_clients,
  COUNT(*) FILTER (WHERE status = 'Inactive') AS inactive_clients,
  COUNT(*) FILTER (WHERE status = 'Closed') AS closed_clients,
  COUNT(*) AS total_clients
FROM whmcs_clients
GROUP BY tenant_id;
```

### mv_invoice_summary

Pre-aggregated invoice statistics.

```sql
CREATE MATERIALIZED VIEW mv_invoice_summary AS
SELECT
  tenant_id,
  COUNT(*) FILTER (WHERE status = 'Paid') AS paid_count,
  COUNT(*) FILTER (WHERE status IN ('Unpaid', 'Overdue')) AS unpaid_count,
  COALESCE(SUM(total) FILTER (WHERE status = 'Paid'), 0) AS total_paid,
  COALESCE(SUM(total) FILTER (WHERE status IN ('Unpaid', 'Overdue')), 0) AS total_unpaid,
  COALESCE(SUM(total) FILTER (
    WHERE status = 'Paid' 
    AND datepaid >= CURRENT_DATE - INTERVAL '30 days'
  ), 0) AS revenue_last_30_days
FROM whmcs_invoices
GROUP BY tenant_id;
```

### mv_mrr_summary

Pre-calculated MRR by revenue source.

```sql
CREATE MATERIALIZED VIEW mv_mrr_summary AS
SELECT
  tenant_id,
  COALESCE(hosting_mrr, 0) + COALESCE(domains_mrr, 0) + COALESCE(billable_mrr, 0) AS current_mrr,
  COALESCE(hosting_mrr, 0) AS hosting_mrr,
  COALESCE(domains_mrr, 0) AS domains_mrr,
  COALESCE(billable_mrr, 0) AS billable_mrr
FROM (
  -- Hosting MRR calculation
  SELECT tenant_id, SUM(monthly_amount) AS hosting_mrr
  FROM (
    SELECT tenant_id,
      CASE billingcycle
        WHEN 'Monthly' THEN amount
        WHEN 'Quarterly' THEN amount / 3
        WHEN 'Semi-Annually' THEN amount / 6
        WHEN 'Annually' THEN amount / 12
        WHEN 'Biennially' THEN amount / 24
        WHEN 'Triennially' THEN amount / 36
        ELSE 0
      END AS monthly_amount
    FROM whmcs_hosting
    WHERE domainstatus = 'Active'
  ) h
  GROUP BY tenant_id
) hosting
-- ... joins with domains and billable items
```

### Refreshing Views

```sql
-- Refresh all materialized views
REFRESH MATERIALIZED VIEW mv_client_summary;
REFRESH MATERIALIZED VIEW mv_invoice_summary;
REFRESH MATERIALIZED VIEW mv_mrr_summary;

-- Or via function
SELECT refresh_metrics_views();
```

---

## Row Level Security (RLS)

All tenant data tables have RLS enabled with policies that filter by `tenant_id`.

### Policy Pattern

```sql
-- Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Create isolation policy
CREATE POLICY tenant_isolation ON table_name
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

### Setting Tenant Context

```sql
-- Set tenant context for the session
SELECT set_config('app.tenant_id', 'tenant-uuid-here', true);
```

In application code:
```typescript
await supabase.rpc('set_config', {
  setting: 'app.tenant_id',
  value: tenantId,
  is_local: true,
})
```

---

## Functions

### refresh_metrics_views()

Refreshes all materialized views for metrics.

```sql
CREATE OR REPLACE FUNCTION refresh_metrics_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_client_summary;
  REFRESH MATERIALIZED VIEW mv_invoice_summary;
  REFRESH MATERIALIZED VIEW mv_mrr_summary;
END;
$$ LANGUAGE plpgsql;
```

### set_updated_at()

Trigger function to update `updated_at` column.

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tenants
CREATE TRIGGER set_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
```

---

## Migrations

Migrations are applied in order by filename:

| Order | File | Description |
|-------|------|-------------|
| 1 | `00001_create_tenants.sql` | Create tenants table |
| 2 | `00002_create_api_keys.sql` | Create api_keys table |
| 3 | `00003_create_whmcs_tables.sql` | Create all WHMCS data tables |
| 4 | `00004_create_sync_tables.sql` | Create sync_logs table |
| 5 | `00005_create_metrics_views.sql` | Create materialized views |
| 6 | `00006_create_rls_policies.sql` | Enable RLS and create policies |

### Running Migrations

```bash
# Apply all pending migrations
npx supabase db push

# Reset database (drops all data!)
npx supabase db reset
```
