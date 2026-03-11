# MRRlytics Backend Development Guide

## Prerequisites

- **Node.js**: v22.0.0 or higher
- **npm**: v11.0.0 or higher
- **Docker Desktop**: Required for Supabase Local
- **Git**: Version control

## Quick Start

```bash
# Clone and navigate
cd backend

# Install dependencies
npm install

# Start Supabase (requires Docker)
npm run db:start

# Copy environment template
cp .env.example .env.local

# Edit .env.local with values from supabase status
npm run db:status

# Apply migrations and seed data
npm run db:reset

# Start development server
npm run dev
```

## Environment Setup

### Required Environment Variables

Create `.env.local` with:

```env
# Supabase - get from `npm run db:status`
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Authentication
ADMIN_API_KEY=mrr_admin_your_32_hex_characters_here
CRON_SECRET=your_cron_secret_here
```

### Generating API Keys

```bash
# Generate a random 32-character hex string
node -e "console.log('mrr_' + require('crypto').randomBytes(16).toString('hex'))"
```

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:start` | Start Supabase Docker containers |
| `npm run db:stop` | Stop Supabase containers |
| `npm run db:status` | Show Supabase status and keys |
| `npm run db:reset` | Reset database (migrations + seed) |
| `npm run db:types` | Generate TypeScript types from DB |

## Database Management

### Supabase Local

Supabase Local runs PostgreSQL, PostgREST, and other services in Docker.

```bash
# Start all services
npm run db:start

# Check status (shows URLs and keys)
npm run db:status

# Access Supabase Studio (GUI)
# http://localhost:54323

# Stop services
npm run db:stop
```

### Migrations

Migrations are in `supabase/migrations/`. They run in order by filename.

```bash
# Create new migration
npx supabase migration new my_migration_name

# Apply all pending migrations
npx supabase db push

# Reset database (drops all data!)
npm run db:reset
```

### Migration Files

| File | Purpose |
|------|---------|
| `00001_create_tenants.sql` | Tenants table |
| `00002_create_api_keys.sql` | API keys table |
| `00003_create_whmcs_tables.sql` | WHMCS data tables |
| `00004_create_sync_tables.sql` | Sync logs |
| `00005_create_metrics_views.sql` | Materialized views |
| `00006_create_rls_policies.sql` | Row Level Security |

### Seed Data

`supabase/seed.sql` contains test data that's applied during `db:reset`.

## Code Style

### TypeScript Conventions

```typescript
// Use explicit types for function parameters and returns
async function calculateMrr(tenantId: string): Promise<MrrResult> {
  // ...
}

// Prefer interfaces for objects
interface MrrResult {
  current: number
  previous: number
  change_percent: number
}

// Use type assertions sparingly
const data = result.data as TenantRow | null
```

### File Organization

```typescript
// Route files follow this structure
import { ... } from 'next/server'        // Next.js imports
import { ... } from '@/lib/...'          // Internal imports
import { ... } from '@/utils/...'        // Utilities
import { ... } from '@/types/...'        // Types

export const dynamic = 'force-dynamic'    // Route config

// Schema definitions
const requestSchema = z.object({ ... })

// Type definitions (if needed)
type LocalType = { ... }

// Route handlers
export async function GET() { ... }
export async function POST(request: NextRequest) { ... }
```

### Error Handling Pattern

```typescript
export async function GET() {
  try {
    // Validate auth
    const auth = getAuthContext(await headers())
    if (!auth) {
      throw new UnauthorizedError('Authentication required')
    }

    // Business logic
    const result = await doSomething()

    // Success response
    return success(result)
  } catch (err) {
    // Error response
    return error(err instanceof Error ? err : new Error('Unknown error'))
  }
}
```

## Testing Endpoints

### Using cURL

```bash
# Health check
curl http://localhost:3000/api/health

# Create tenant (admin)
curl -X POST http://localhost:3000/api/tenants \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Tenant",
    "slug": "test-tenant",
    "whmcs_url": "https://whmcs.example.com/modules/addons/mrrlytics/api.php",
    "whmcs_api_key": "test_key"
  }'

# List tenants
curl http://localhost:3000/api/tenants \
  -H "Authorization: Bearer $ADMIN_API_KEY"

# Get metrics (tenant key)
curl http://localhost:3000/api/metrics \
  -H "Authorization: Bearer mrr_your_tenant_key"
```

### Using HTTPie

```bash
# Install: pip install httpie

# Health check
http GET localhost:3000/api/health

# Create tenant
http POST localhost:3000/api/tenants \
  Authorization:"Bearer $ADMIN_API_KEY" \
  name="Test" slug="test" \
  whmcs_url="https://example.com/api.php" \
  whmcs_api_key="key"
```

## Adding New Features

### Adding a New API Route

1. Create route file:
```typescript
// src/app/api/new-feature/route.ts
import { headers } from 'next/headers'
import { getAuthContext } from '@/lib/auth'
import { success, error } from '@/utils/api-response'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = getAuthContext(await headers())
    if (!auth) {
      throw new UnauthorizedError('Authentication required')
    }

    // Your logic here
    return success({ message: 'Hello' })
  } catch (err) {
    return error(err instanceof Error ? err : new Error('Failed'))
  }
}
```

2. Test the endpoint:
```bash
curl http://localhost:3000/api/new-feature \
  -H "Authorization: Bearer mrr_your_key"
```

### Adding a New Database Table

1. Create migration:
```bash
npx supabase migration new create_my_table
```

2. Edit the migration file:
```sql
-- supabase/migrations/TIMESTAMP_create_my_table.sql
CREATE TABLE my_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON my_table
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Index for performance
CREATE INDEX idx_my_table_tenant ON my_table(tenant_id);
```

3. Apply migration:
```bash
npx supabase db push
```

4. Update TypeScript types:
```bash
npm run db:types
```

### Adding New Metrics

1. Create metrics calculation in `src/lib/metrics/`:
```typescript
// src/lib/metrics/my-metric.ts
import { createTenantClient } from '@/lib/supabase/with-tenant'

export async function calculateMyMetric(tenantId: string) {
  const supabase = await createTenantClient(tenantId)
  
  const { data } = await supabase
    .from('whmcs_hosting')
    .select('amount, billingcycle')
    .eq('domainstatus', 'Active')

  // Calculate and return
  return {
    value: calculateValue(data),
    breakdown: calculateBreakdown(data),
  }
}
```

2. Export from index:
```typescript
// src/lib/metrics/index.ts
export { calculateMyMetric } from './my-metric'
```

3. Add API route if needed.

## Debugging

### View Logs

```bash
# Development server logs
npm run dev

# Supabase logs
npx supabase db logs
```

### Database Inspection

```bash
# Open Supabase Studio
# http://localhost:54323

# Or use psql
npx supabase db shell
```

### Common Issues

#### "Missing Supabase environment variables"

Ensure `.env.local` exists with correct values from `npm run db:status`.

#### "Tenant not found"

1. Check tenant exists: `SELECT * FROM tenants;`
2. Verify API key is for correct tenant

#### "Invalid API key format"

Key must match: `mrr_` + 32 hex characters (lowercase)

#### Edge Runtime Errors

If you see "Node.js module not supported in Edge Runtime":
- Use `crypto-edge.ts` for middleware
- Use `crypto.ts` for API routes

## Production Deployment

### Pre-deployment Checklist

- [ ] All environment variables set in Vercel
- [ ] Database migrations applied to production Supabase
- [ ] ADMIN_API_KEY is secure and unique
- [ ] CRON_SECRET is secure and unique
- [ ] Tested all endpoints locally

### Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add ADMIN_API_KEY
vercel env add CRON_SECRET
```

### Monitoring

- Check Vercel dashboard for function logs
- Monitor Supabase dashboard for database metrics
- Set up alerts for cron job failures
