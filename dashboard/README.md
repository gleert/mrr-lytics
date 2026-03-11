# MRRlytics Dashboard

Modern analytics dashboard for WHMCS billing data. Built with React, TypeScript, and Tailwind CSS.

## Features

- **Dashboard**: KPI cards with MRR, ARR, Churn Rate, Active Clients
- **Metrics**: Detailed charts for MRR trends, revenue breakdown, churn analysis
- **Sync Management**: View sync status, history, and trigger manual syncs
- **Dark/Light Theme**: System-aware with manual toggle
- **Responsive**: Works on desktop and mobile
- **Offline Support**: Query caching with localStorage persistence

## Tech Stack

- **Framework**: React 19 + Vite 7
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 (Linear-inspired dark theme)
- **State**: TanStack Query v5 with persistence
- **Routing**: React Router v7
- **Auth**: Supabase Auth (Google OAuth ready)
- **Charts**: Recharts
- **Icons**: Lucide React
- **i18n**: react-i18next (English)

## Getting Started

### Prerequisites

- Node.js 20+
- Backend API running on port 3000
- Supabase local instance running

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Start development server
npm run dev
```

### Environment Variables

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:3000
```

## Project Structure

```
src/
├── app/
│   ├── layouts/        # AppLayout, AuthLayout
│   ├── providers/      # QueryProvider, AuthProvider, ThemeProvider
│   └── routes/         # Route definitions
├── features/
│   ├── auth/           # Login, OAuth callback, protected routes
│   ├── dashboard/      # Home page with KPIs
│   ├── metrics/        # Detailed metrics and charts
│   ├── sync/           # Sync management
│   ├── tenants/        # Tenant management (admin)
│   ├── alerts/         # Notifications (placeholder)
│   └── settings/       # User preferences
└── shared/
    ├── components/ui/  # Reusable UI components
    ├── hooks/          # Custom hooks
    ├── lib/            # API client, Supabase, utilities
    └── types/          # TypeScript definitions
```

## Available Scripts

```bash
npm run dev       # Start dev server (port 5173)
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # Run ESLint
npm run typecheck # TypeScript type checking
```

## Design System

### Colors

- **Primary**: Purple/Violet (#7C3AED)
- **Background**: Dark (#0D0D0D)
- **Surface**: Elevated surfaces (#171717)
- **Success**: Green (#22C55E)
- **Warning**: Yellow (#EAB308)
- **Error**: Red (#EF4444)

### Typography

- **Font**: Inter (system fallback)
- **Mono**: JetBrains Mono

## Authentication

Currently configured for Google OAuth via Supabase. To enable:

1. Create Google Cloud OAuth credentials
2. Configure Google provider in Supabase Dashboard
3. Update environment variables

See `docs/PENDING.md` for setup instructions.

## API Integration

The dashboard connects to the MRRlytics Backend API:

- `GET /api/metrics` - All metrics
- `GET /api/metrics/mrr` - MRR details
- `GET /api/metrics/churn` - Churn analysis
- `GET /api/metrics/revenue` - Revenue breakdown
- `GET /api/sync/status` - Sync status and history
- `POST /api/sync` - Trigger manual sync

## MVP Scope

This is the MVP version. See `docs/PENDING.md` for planned features:

- [ ] PDF export
- [ ] Date range filtering
- [ ] Tenant management
- [ ] Alert configuration
- [ ] MRR forecasting

## License

Private - All rights reserved
