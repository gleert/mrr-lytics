# MRRlytics Backend Architecture

## Overview

MRRlytics Backend is a headless API service built with Next.js 15+ that provides analytics metrics for WHMCS billing platforms. It's designed as a multi-tenant SaaS backend with secure API authentication and automated data synchronization.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MRRlytics System                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐     ┌─────────────────┐     ┌──────────────────────────┐  │
│  │   WHMCS 1   │────▶│                 │     │                          │  │
│  │   Addon     │     │                 │     │   MRRlytics Backend      │  │
│  └─────────────┘     │   Internet      │────▶│   (Next.js API)          │  │
│                      │                 │     │                          │  │
│  ┌─────────────┐     │                 │     │   ┌──────────────────┐   │  │
│  │   WHMCS 2   │────▶│                 │     │   │  API Routes      │   │  │
│  │   Addon     │     │                 │     │   │  /api/*          │   │  │
│  └─────────────┘     └─────────────────┘     │   └────────┬─────────┘   │  │
│                                              │            │             │   │
│  ┌─────────────┐                             │   ┌────────▼─────────┐   │  │
│  │   WHMCS N   │────────────────────────────▶│   │  Middleware      │   │  │
│  │   Addon     │                             │   │  (Auth/Scope)    │   │  │
│  └─────────────┘                             │   └────────┬─────────┘   │  │
│                                              │            │             │   │
│                                              │   ┌────────▼─────────┐   │  │
│                                              │   │  Supabase        │   │  │
│                                              │   │  (PostgreSQL)    │   │  │
│                                              │   └──────────────────┘   │  │
│                                              └──────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Runtime | Node.js 22+ | JavaScript runtime |
| Framework | Next.js 16 | API routes, middleware |
| Language | TypeScript | Type safety |
| Database | PostgreSQL (Supabase) | Data persistence |
| Validation | Zod | Request validation |
| Deployment | Vercel | Serverless hosting |

## Directory Structure

```
backend/
├── src/
│   ├── app/
│   │   ├── api/                    # API Route Handlers
│   │   │   ├── health/             # Health check endpoint
│   │   │   ├── tenants/            # Tenant management
│   │   │   │   ├── route.ts        # GET (list), POST (create)
│   │   │   │   └── [tenantId]/
│   │   │   │       ├── route.ts    # GET, PUT, DELETE
│   │   │   │       └── api-keys/   # API key management
│   │   │   ├── sync/               # Data synchronization
│   │   │   │   ├── route.ts        # POST (trigger)
│   │   │   │   └── status/         # GET (status)
│   │   │   ├── metrics/            # Analytics metrics
│   │   │   │   ├── route.ts        # GET (all metrics)
│   │   │   │   ├── mrr/            # MRR details
│   │   │   │   ├── churn/          # Churn metrics
│   │   │   │   └── revenue/        # Revenue breakdown
│   │   │   └── cron/
│   │   │       └── sync/           # Scheduled sync
│   │   └── layout.tsx
│   │
│   ├── lib/
│   │   ├── supabase/               # Database clients
│   │   │   ├── admin.ts            # Service role client
│   │   │   ├── server.ts           # Server component client
│   │   │   └── with-tenant.ts      # Tenant-scoped client
│   │   │
│   │   ├── auth/                   # Authentication
│   │   │   ├── api-key.ts          # Server-side validation
│   │   │   ├── api-key-edge.ts     # Edge runtime validation
│   │   │   └── scopes.ts           # Scope utilities
│   │   │
│   │   ├── whmcs/                  # WHMCS Integration
│   │   │   ├── client.ts           # HTTP client
│   │   │   ├── sync.ts             # Sync logic
│   │   │   └── types.ts            # WHMCS data types
│   │   │
│   │   └── metrics/                # Metric calculations
│   │       ├── mrr.ts              # MRR calculation
│   │       ├── churn.ts            # Churn calculation
│   │       └── revenue.ts          # Revenue breakdown
│   │
│   ├── types/
│   │   ├── database.ts             # Supabase types
│   │   └── api.ts                  # API types
│   │
│   ├── utils/
│   │   ├── crypto.ts               # Node.js crypto (server)
│   │   ├── crypto-edge.ts          # Web Crypto API (edge)
│   │   ├── api-response.ts         # Response helpers
│   │   └── errors.ts               # Error classes
│   │
│   └── middleware.ts               # Auth middleware
│
├── supabase/
│   ├── migrations/                 # SQL migrations
│   │   ├── 00001_create_tenants.sql
│   │   ├── 00002_create_api_keys.sql
│   │   ├── 00003_create_whmcs_tables.sql
│   │   ├── 00004_create_sync_tables.sql
│   │   ├── 00005_create_metrics_views.sql
│   │   └── 00006_create_rls_policies.sql
│   └── seed.sql                    # Test data
│
├── docs/                           # Documentation
├── .env.local                      # Local environment
├── .env.example                    # Example env file
├── next.config.ts                  # Next.js config
├── tsconfig.json                   # TypeScript config
├── package.json                    # Dependencies
└── vercel.json                     # Vercel config
```

## Multi-Tenant Architecture

### Tenant Isolation

Each tenant (WHMCS installation) has complete data isolation through:

1. **Tenant ID Column**: All data tables include `tenant_id` foreign key
2. **Row Level Security (RLS)**: PostgreSQL policies enforce tenant isolation
3. **API Key Binding**: Each API key is bound to a specific tenant

```sql
-- Example RLS policy
CREATE POLICY tenant_isolation ON whmcs_clients
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

### Tenant Context Flow

```
Request → Middleware → Validate API Key → Set Tenant Context → Route Handler
                            ↓
                    Extract tenant_id
                            ↓
                    Set x-tenant-id header
                            ↓
                    Route uses createTenantClient(tenantId)
                            ↓
                    RLS policies filter data
```

## Authentication System

### API Key Structure

```
mrr_<32 hex characters>
└─┬┘ └───────┬────────┘
  │          │
  │          └── Random bytes (16 bytes = 32 hex chars)
  │
  └── Prefix for identification
```

### Key Storage

- **Hash**: SHA-256 hash stored in database
- **Prefix**: First 8 characters stored for identification
- **Never stored**: Full key is never persisted

### Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Request   │────▶│  Middleware │────▶│   Route     │
│ + API Key   │     │  (Edge)     │     │  Handler    │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────▼──────┐
                    │ Edge-safe   │
                    │ Validation  │
                    │ (Web Crypto)│
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Supabase   │
                    │  Lookup     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ Set Headers │
                    │ x-tenant-id │
                    │ x-scopes    │
                    └─────────────┘
```

### Edge Runtime Considerations

The middleware runs in Edge Runtime, which doesn't support Node.js `crypto` module. We use:

- `crypto-edge.ts`: Web Crypto API for Edge runtime
- `crypto.ts`: Node.js crypto for API routes

## Data Flow

### Sync Process

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   WHMCS     │     │  MRRlytics  │     │  Supabase   │
│   Addon     │     │   Backend   │     │  Database   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │◀───── Request ────│                   │
       │       GET /api    │                   │
       │                   │                   │
       │────── Response ──▶│                   │
       │   { data: [...] } │                   │
       │                   │                   │
       │                   │──── Upsert ──────▶│
       │                   │    whmcs_*        │
       │                   │                   │
       │                   │◀── Confirmation ──│
       │                   │                   │
       │                   │──── Refresh ─────▶│
       │                   │    Views          │
       │                   │                   │
```

### Sync Types

| Type | Trigger | Behavior |
|------|---------|----------|
| Full | Manual/Cron 6h | Fetches all data |
| Incremental | Cron 15m | Fetches changes since last sync |

## Database Schema

### Core Tables

```
┌─────────────┐       ┌─────────────┐
│   tenants   │───────│  api_keys   │
├─────────────┤       ├─────────────┤
│ id (PK)     │       │ id (PK)     │
│ name        │       │ tenant_id   │──┐
│ slug        │       │ key_hash    │  │
│ whmcs_url   │       │ scopes      │  │
│ whmcs_api_  │       │ expires_at  │  │
│   key       │       └─────────────┘  │
│ status      │                        │
│ settings    │◀───────────────────────┘
└─────────────┘
```

### WHMCS Data Tables

```
┌─────────────────┐     ┌─────────────────┐
│  whmcs_clients  │     │  whmcs_hosting  │
├─────────────────┤     ├─────────────────┤
│ tenant_id (FK)  │     │ tenant_id (FK)  │
│ whmcs_id        │     │ whmcs_id        │
│ status          │     │ client_id       │
│ datecreated     │     │ amount          │
└─────────────────┘     │ billingcycle    │
                        │ domainstatus    │
┌─────────────────┐     └─────────────────┘
│  whmcs_domains  │
├─────────────────┤     ┌─────────────────┐
│ tenant_id (FK)  │     │ whmcs_invoices  │
│ whmcs_id        │     ├─────────────────┤
│ recurringamount │     │ tenant_id (FK)  │
│ status          │     │ whmcs_id        │
└─────────────────┘     │ total           │
                        │ status          │
                        │ datepaid        │
                        └─────────────────┘
```

### Materialized Views

```sql
-- Pre-calculated metrics for performance
mv_client_summary     -- Client counts by status
mv_invoice_summary    -- Invoice totals and counts
mv_mrr_summary        -- MRR breakdown by source
```

## Security

### API Key Security

- Keys hashed with SHA-256 before storage
- Constant-time comparison prevents timing attacks
- Key prefix allows identification without exposing full key
- Scopes limit API key permissions

### Data Security

- Row Level Security (RLS) on all tenant data
- Service role key never exposed to clients
- Environment variables for sensitive config
- HTTPS required in production

### Request Validation

- Zod schemas validate all request bodies
- Type-safe parameter parsing
- SQL injection prevention via Supabase client

## Deployment

### Vercel Configuration

```json
{
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `ADMIN_API_KEY` | Admin authentication key | Yes |
| `CRON_SECRET` | Cron job authentication | Yes |

### Scaling Considerations

- **Stateless**: All API routes are stateless
- **Serverless**: Scales automatically on Vercel
- **Connection Pooling**: Supabase handles DB connections
- **Caching**: Materialized views reduce query load

## Error Handling

### Error Classes

```typescript
// Custom error classes in utils/errors.ts
class AppError extends Error {
  code: string
  statusCode: number
  details?: Record<string, unknown>
}

class BadRequestError extends AppError {}
class UnauthorizedError extends AppError {}
class ForbiddenError extends AppError {}
class NotFoundError extends AppError {}
class ConflictError extends AppError {}
```

### Response Format

```typescript
// Consistent error responses
{
  success: false,
  error: {
    code: "UNAUTHORIZED",
    message: "Invalid API key",
    details: {}
  }
}
```

## Performance Optimizations

1. **Parallel Data Fetching**: Metrics calculated in parallel
2. **Materialized Views**: Pre-aggregated data for common queries
3. **Incremental Sync**: Only fetch changed data
4. **Connection Reuse**: Supabase client pooling
5. **Edge Middleware**: Auth at edge for faster rejection
