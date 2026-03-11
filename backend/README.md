# MRRlytics Backend API

Headless API backend for the MRRlytics platform. Connects to WHMCS installations via the MRRlytics addon and provides analytics metrics.

## Documentation

| Document | Description |
|----------|-------------|
| [API Reference](docs/API.md) | Complete API endpoint documentation |
| [Architecture](docs/ARCHITECTURE.md) | System design and data flow |
| [Development Guide](docs/DEVELOPMENT.md) | Local setup and coding guidelines |
| [Database Schema](docs/DATABASE.md) | Tables, views, and migrations |

## Features

- **Multi-tenant Architecture**: Support for multiple WHMCS installations
- **Bearer Token Authentication**: Secure API access with scoped permissions
- **Automated Sync**: Scheduled data synchronization from WHMCS
- **Real-time Metrics**: MRR, ARR, Churn, Revenue by Product

## Tech Stack

- **Framework**: Next.js 15+ (App Router, Route Handlers)
- **Database**: PostgreSQL via Supabase
- **Language**: TypeScript
- **Validation**: Zod

## Prerequisites

- Node.js 22+
- Docker Desktop (for Supabase Local)
- npm 11+

## Getting Started

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Start Supabase Local

```bash
npm run db:start
```

This will output the local URLs and keys. Copy them to `.env.local`.

### 3. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with the values from Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<from supabase status>
ADMIN_API_KEY=mrr_admin_<your-32-char-hex>
CRON_SECRET=<your-cron-secret>
```

### 4. Apply Migrations

```bash
npm run db:reset
```

This applies all migrations and seeds test data.

### 5. Start Development Server

```bash
npm run dev
```

API available at: http://localhost:3000

## API Endpoints

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |

### Admin (requires ADMIN_API_KEY)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tenants` | List tenants |
| POST | `/api/tenants` | Create tenant |
| GET | `/api/tenants/:id` | Get tenant |
| PUT | `/api/tenants/:id` | Update tenant |
| DELETE | `/api/tenants/:id` | Delete tenant |
| POST | `/api/tenants/:id/api-keys` | Create API key |
| GET | `/api/tenants/:id/api-keys` | List API keys |

### Tenant (requires tenant API key)

| Method | Endpoint | Scope | Description |
|--------|----------|-------|-------------|
| POST | `/api/sync` | sync | Trigger sync |
| GET | `/api/sync/status` | read | Sync status |
| GET | `/api/metrics` | read | All metrics |
| GET | `/api/metrics/mrr` | read | MRR details |
| GET | `/api/metrics/churn` | read | Churn metrics |
| GET | `/api/metrics/revenue` | read | Revenue by product |

### Cron (requires CRON_SECRET)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cron/sync` | Scheduled sync all tenants |

## Authentication

All protected endpoints require Bearer token:

```bash
curl -H "Authorization: Bearer mrr_your_api_key_here" \
  http://localhost:3000/api/metrics
```

### API Key Format

```
mrr_<32 hex characters>
```

Example: `mrr_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

### Scopes

| Scope | Permissions |
|-------|-------------|
| `read` | View metrics and sync status |
| `write` | Modify tenant settings |
| `sync` | Trigger synchronization |
| `admin` | Full access including key management |

## Database Commands

```bash
# Start Supabase (Docker)
npm run db:start

# Stop Supabase
npm run db:stop

# Check status
npm run db:status

# Reset database (apply migrations + seed)
npm run db:reset

# Generate TypeScript types
npm run db:types
```

## Supabase Studio

When Supabase is running, access the dashboard at:
http://localhost:54323

## Project Structure

```
backend/
├── src/
│   ├── app/api/          # Route handlers
│   ├── lib/
│   │   ├── supabase/     # Database clients
│   │   ├── whmcs/        # WHMCS client & sync
│   │   ├── metrics/      # Metric calculations
│   │   └── auth/         # API key validation
│   ├── types/            # TypeScript definitions
│   └── utils/            # Helpers
├── supabase/
│   ├── migrations/       # SQL migrations
│   └── seed.sql          # Test data
└── .env.local            # Environment variables
```

## Creating a Tenant

```bash
curl -X POST http://localhost:3000/api/tenants \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Company",
    "slug": "my-company",
    "whmcs_url": "https://whmcs.example.com/modules/addons/mrrlytics/api.php",
    "whmcs_api_key": "your_whmcs_mrrlytics_key"
  }'
```

Response includes a one-time API key. Save it securely!

## Triggering a Sync

```bash
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer mrr_your_tenant_api_key" \
  -H "Content-Type: application/json" \
  -d '{"type": "full"}'
```

## Getting Metrics

```bash
# All metrics
curl http://localhost:3000/api/metrics \
  -H "Authorization: Bearer mrr_your_tenant_api_key"

# MRR only
curl http://localhost:3000/api/metrics/mrr \
  -H "Authorization: Bearer mrr_your_tenant_api_key"

# Churn (custom period)
curl "http://localhost:3000/api/metrics/churn?period_days=90" \
  -H "Authorization: Bearer mrr_your_tenant_api_key"
```

## Vercel Deployment

### Environment Variables

Set these in Vercel dashboard:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_API_KEY`
- `CRON_SECRET`

### Cron Configuration

Create `vercel.json`:

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

## Troubleshooting

### Common Issues

**"Missing Supabase environment variables"**
- Ensure `.env.local` exists
- Run `npm run db:status` and copy the keys

**Build fails with "node:crypto" error**
- This is fixed - ensure you have the latest code
- Middleware uses Edge-compatible crypto

**"Tenant not found"**
- Verify tenant exists: Check Supabase Studio
- Confirm API key belongs to correct tenant

**Sync fails**
- Check WHMCS addon is accessible
- Verify `whmcs_url` and `whmcs_api_key` are correct
- Check WHMCS addon logs

### Getting Help

1. Check the [documentation](docs/)
2. Review error messages in server logs
3. Access Supabase Studio at http://localhost:54323

## License

MIT
