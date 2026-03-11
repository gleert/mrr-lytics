# MRRlytics Backend API Reference

Complete API documentation for the MRRlytics backend service.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://your-domain.vercel.app`

## Authentication

All protected endpoints require a Bearer token in the `Authorization` header:

```http
Authorization: Bearer mrr_a1b2c3d4e5f6789...
```

### API Key Types

| Type | Format | Purpose |
|------|--------|---------|
| Admin Key | `ADMIN_API_KEY` env var | Manage tenants and API keys |
| Tenant Key | `mrr_<32 hex chars>` | Access tenant resources |
| Cron Secret | `CRON_SECRET` env var | Scheduled sync operations |

### Scopes

Tenant API keys have scopes that limit their permissions:

| Scope | Description |
|-------|-------------|
| `read` | View metrics, sync status, and tenant info |
| `write` | Modify tenant settings |
| `sync` | Trigger data synchronization |
| `admin` | Full access, including API key management |

---

## Response Format

All responses follow a consistent JSON structure:

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "tenant_id": "uuid",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... }
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `FORBIDDEN` | 403 | Insufficient scope/permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `BAD_REQUEST` | 400 | Invalid request data |
| `CONFLICT` | 409 | Resource already exists |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Endpoints

### Health Check

#### `GET /api/health`

Check API availability. No authentication required.

**Response**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### Tenants

#### `GET /api/tenants`

List all tenants.

**Authentication**: Admin API key required

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "whmcs_url": "https://whmcs.acme.com/modules/addons/mrrlytics/api.php",
      "status": "active",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

#### `POST /api/tenants`

Create a new tenant.

**Authentication**: Admin API key required

**Request Body**
```json
{
  "name": "Acme Corp",
  "slug": "acme-corp",
  "whmcs_url": "https://whmcs.acme.com/modules/addons/mrrlytics/api.php",
  "whmcs_api_key": "mrr_whmcs_api_key_here"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Display name (1-255 chars) |
| `slug` | string | Yes | URL-safe identifier (lowercase, alphanumeric, dashes) |
| `whmcs_url` | string | Yes | Full URL to WHMCS MRRlytics API endpoint |
| `whmcs_api_key` | string | Yes | API key configured in WHMCS addon |

**Response** (201 Created)
```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "uuid",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "whmcs_url": "https://whmcs.acme.com/modules/addons/mrrlytics/api.php",
      "status": "active",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    },
    "api_key": {
      "key": "mrr_a1b2c3d4e5f6789012345678901234ab",
      "id": "uuid",
      "name": "Initial Admin Key",
      "scopes": ["read", "write", "sync", "admin"],
      "warning": "Save this API key securely. It will not be shown again."
    }
  }
}
```

> **Important**: The API key is only returned once. Store it securely!

---

#### `GET /api/tenants/:tenantId`

Get tenant details.

**Authentication**: Admin API key required

**Response**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "whmcs_url": "https://whmcs.acme.com/modules/addons/mrrlytics/api.php",
    "status": "active",
    "settings": {},
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

---

#### `PUT /api/tenants/:tenantId`

Update tenant settings.

**Authentication**: Admin API key required

**Request Body** (all fields optional)
```json
{
  "name": "Acme Corporation",
  "whmcs_url": "https://new-whmcs.acme.com/modules/addons/mrrlytics/api.php",
  "whmcs_api_key": "new_api_key",
  "status": "inactive",
  "settings": {
    "sync_interval": 900
  }
}
```

---

#### `DELETE /api/tenants/:tenantId`

Delete a tenant and all associated data.

**Authentication**: Admin API key required

**Response**: 204 No Content

> **Warning**: This action is irreversible. All tenant data will be deleted.

---

### API Keys

#### `GET /api/tenants/:tenantId/api-keys`

List all API keys for a tenant.

**Authentication**: Admin API key required

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Production Key",
      "key_prefix": "mrr_a1b2",
      "scopes": ["read", "sync"],
      "created_at": "2024-01-01T00:00:00.000Z",
      "expires_at": null,
      "last_used_at": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

---

#### `POST /api/tenants/:tenantId/api-keys`

Create a new API key.

**Authentication**: Admin API key required

**Request Body**
```json
{
  "name": "Dashboard Read-Only",
  "scopes": ["read"],
  "expires_in_days": 365
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | - | Key name (1-255 chars) |
| `scopes` | array | No | `["read"]` | Permissions array |
| `expires_in_days` | number | No | null (never) | Expiration in days |

**Response** (201 Created)
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Dashboard Read-Only",
    "key_prefix": "mrr_c3d4",
    "scopes": ["read"],
    "created_at": "2024-01-15T10:30:00.000Z",
    "expires_at": "2025-01-15T10:30:00.000Z",
    "key": "mrr_c3d4e5f6789012345678901234567890",
    "warning": "Save this API key securely. It will not be shown again."
  }
}
```

---

### Sync

#### `POST /api/sync`

Trigger a data synchronization from WHMCS.

**Authentication**: Tenant API key with `sync` scope

**Request Body** (optional)
```json
{
  "type": "full"
}
```

| Field | Type | Values | Default | Description |
|-------|------|--------|---------|-------------|
| `type` | string | `full`, `incremental` | `full` | Sync type |

**Response**
```json
{
  "success": true,
  "data": {
    "message": "Sync completed successfully",
    "sync_log_id": "uuid",
    "records_synced": {
      "clients": 150,
      "products": 25,
      "hosting": 320,
      "domains": 180,
      "invoices": 1250,
      "invoice_items": 3500,
      "billable_items": 45
    },
    "duration_ms": 4523
  }
}
```

---

#### `GET /api/sync/status`

Get recent sync history and status.

**Authentication**: Tenant API key with `read` scope

**Response**
```json
{
  "success": true,
  "data": {
    "recent_syncs": [
      {
        "id": "uuid",
        "status": "completed",
        "sync_type": "full",
        "started_at": "2024-01-15T10:00:00.000Z",
        "completed_at": "2024-01-15T10:00:05.000Z",
        "records_synced": { "clients": 150, ... },
        "error_message": null,
        "duration_ms": 4523,
        "triggered_by": "manual"
      }
    ],
    "last_successful_sync": { ... },
    "is_syncing": false
  }
}
```

---

### Metrics

#### `GET /api/metrics`

Get all metrics summary.

**Authentication**: Tenant API key with `read` scope

**Response**
```json
{
  "success": true,
  "data": {
    "mrr": {
      "current": 15250.00,
      "hosting": 12500.00,
      "domains": 1750.00,
      "billable": 1000.00,
      "previous": 14800.00,
      "change_percent": 3.04
    },
    "churn": {
      "period_days": 30,
      "churned_services": 5,
      "churned_mrr": 450.00,
      "total_services_start": 320,
      "churn_rate_percent": 1.56
    },
    "revenue_by_product": [
      {
        "product_id": 1,
        "product_name": "Shared Hosting",
        "active_services": 150,
        "monthly_revenue": 7500.00
      }
    ],
    "clients": {
      "active": 145,
      "inactive": 12,
      "closed": 5,
      "total": 162
    },
    "invoices": {
      "paid_count": 1150,
      "unpaid_count": 85,
      "total_paid": 125000.00,
      "total_unpaid": 8500.00,
      "revenue_last_30_days": 18500.00
    }
  }
}
```

---

#### `GET /api/metrics/mrr`

Get detailed MRR (Monthly Recurring Revenue) metrics.

**Authentication**: Tenant API key with `read` scope

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `compare_months` | number | 1 | Months back to compare |

**Response**
```json
{
  "success": true,
  "data": {
    "current_mrr": 15250.00,
    "breakdown": {
      "hosting": 12500.00,
      "domains": 1750.00,
      "billable": 1000.00
    },
    "previous_mrr": 14800.00,
    "change": 450.00,
    "change_percent": 3.04,
    "arr": 183000.00
  }
}
```

---

#### `GET /api/metrics/churn`

Get churn metrics.

**Authentication**: Tenant API key with `read` scope

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period_days` | number | 30 | Analysis period in days |

**Response**
```json
{
  "success": true,
  "data": {
    "period_days": 30,
    "churned_services": 5,
    "churned_mrr": 450.00,
    "total_services_start": 320,
    "churn_rate_percent": 1.56,
    "retention_rate_percent": 98.44,
    "churned_by_product": [
      {
        "product_id": 1,
        "product_name": "Shared Hosting",
        "churned_count": 3,
        "churned_mrr": 300.00
      }
    ]
  }
}
```

---

#### `GET /api/metrics/revenue`

Get revenue breakdown by product.

**Authentication**: Tenant API key with `read` scope

**Response**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "product_id": 1,
        "product_name": "Shared Hosting",
        "product_type": "hosting",
        "active_services": 150,
        "monthly_revenue": 7500.00,
        "percentage_of_total": 49.18
      }
    ],
    "total_monthly_revenue": 15250.00
  }
}
```

---

### Cron

#### `GET /api/cron/sync`

Scheduled sync for all active tenants.

**Authentication**: Cron secret required (Bearer token)

**Headers**
```http
Authorization: Bearer <CRON_SECRET>
```

**Response**
```json
{
  "success": true,
  "data": {
    "message": "Cron sync completed: 5 succeeded, 0 failed",
    "sync_type": "incremental",
    "results": [
      {
        "tenant_id": "uuid",
        "tenant_name": "Acme Corp",
        "success": true,
        "sync_log_id": "uuid",
        "records_synced": { ... },
        "duration_ms": 3200
      }
    ]
  }
}
```

---

## Rate Limiting

Currently, there is no rate limiting implemented. In production, consider adding rate limiting at the infrastructure level (Vercel, Cloudflare, etc.).

## Pagination

For endpoints that may return large datasets, pagination is available:

```http
GET /api/endpoint?limit=50&offset=0
```

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | number | 100 | 1000 | Results per page |
| `offset` | number | 0 | - | Starting position |

---

## Examples

### cURL

```bash
# Health check
curl http://localhost:3000/api/health

# Create tenant
curl -X POST http://localhost:3000/api/tenants \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","slug":"test","whmcs_url":"https://whmcs.test.com/modules/addons/mrrlytics/api.php","whmcs_api_key":"key123"}'

# Get metrics
curl http://localhost:3000/api/metrics \
  -H "Authorization: Bearer mrr_your_tenant_key"

# Trigger sync
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer mrr_your_tenant_key" \
  -H "Content-Type: application/json" \
  -d '{"type":"full"}'
```

### JavaScript/TypeScript

```typescript
const API_URL = 'http://localhost:3000';
const API_KEY = 'mrr_your_tenant_key';

async function getMetrics() {
  const response = await fetch(`${API_URL}/api/metrics`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  const { data } = await response.json();
  return data;
}
```

### Python

```python
import requests

API_URL = "http://localhost:3000"
API_KEY = "mrr_your_tenant_key"

def get_metrics():
    response = requests.get(
        f"{API_URL}/api/metrics",
        headers={"Authorization": f"Bearer {API_KEY}"}
    )
    response.raise_for_status()
    return response.json()["data"]
```
