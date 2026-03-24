# MRRlytics Dashboard - Pending Items

This document tracks features and improvements that are not part of the MVP but should be implemented in future iterations.

## Authentication

### Google OAuth Setup (Required for Production)
- [ ] Create Google Cloud Project
- [ ] Enable Google+ API
- [ ] Create OAuth 2.0 credentials
- [ ] Configure redirect URIs in Google Console
- [ ] Add Google provider in Supabase Dashboard

### Additional Auth Features
- [ ] Magic link authentication
- [ ] Session timeout warning
- [ ] "Remember me" functionality
- [ ] Multi-factor authentication (MFA)

## Email & Communications

### Supabase SMTP (Required for Production)
- [ ] Configure SMTP provider in Supabase Dashboard (Authentication > SMTP Settings)
- [ ] Copy email templates from `backend/supabase/templates/` to Supabase Dashboard (Authentication > Email Templates)
  - Confirmation, Invite, Recovery — dark-themed design matching the app
- [ ] Verify team invitation emails are delivered

### Notification Emails
- [ ] Alert notification emails (via Nodemailer/connectors)
- [ ] Scheduled report delivery by email

## User Management

- [ ] Avatar upload functionality
- [ ] Last login tracking display

## Metrics & Analytics

### Date Range Filtering
- [ ] Custom date range picker (calendar)
- [ ] Date range persistence across sessions

### Export Features
- [ ] PDF export with charts (use html2canvas + jspdf)
- [ ] CSV export for tables
- [ ] Scheduled export reports

### Additional Metrics
- [ ] Customer Lifetime Value (CLV)
- [ ] Net Revenue Retention (NRR)
- [ ] Cohort analysis
- [ ] Revenue by geography

## Alerts & Notifications

- [ ] Alert configuration UI (6 alert types designed, need backend implementation)
- [ ] Alert thresholds (e.g., MRR drops > 10%)
- [ ] Email notifications
- [ ] In-app notification center
- [ ] Webhook delivery management

## Sync Management

- [ ] Detailed sync error logs with drill-down
- [ ] Retry failed syncs from UI
- [ ] Sync scheduling UI (custom intervals)
- [ ] Partial sync (only specific data types)

## Performance Optimizations

- [ ] Image optimization
- [ ] Service worker for offline support
- [ ] Further bundle size optimization (currently ~1176KB after code splitting)

## UI/UX Improvements

- [x] Onboarding tour for new users
- [ ] Confirmation dialogs for destructive actions
- [ ] Drag and drop for dashboard layout customization

## Internationalization

- [ ] Portuguese translations
- [ ] Language selector in settings
- [ ] Currency localization per tenant

## Testing

- [ ] Unit tests with Vitest
- [ ] Component tests with Testing Library
- [ ] E2E tests with Playwright
- [ ] Accessibility tests

## Documentation

- [ ] Component documentation (Storybook)
- [ ] User guide
- [ ] Admin guide

## DevOps & Deployment

- [ ] CI/CD pipeline (currently manual `vercel --prod --yes`)
- [ ] Error tracking (Sentry)
- [ ] Analytics (Plausible/PostHog)
- [ ] Performance monitoring

## Security

- [ ] Content Security Policy headers
- [ ] Dependency vulnerability scanning
- [ ] Rate limiting awareness in UI (show user-friendly message on 429)

---

## Already Completed (v1.0 - v2.0)

### v1.2 - Security & Performance
- [x] Timing-safe secret comparison in middleware
- [x] API rate limiting per auth type
- [x] Zod validation on instance endpoints
- [x] LIKE injection fix in search queries
- [x] In-memory caching for metric queries (2-5 min TTL)

### v1.3-v1.4 - UX & Frontend
- [x] Responsive design across all pages
- [x] Code splitting with React.lazy (reduced bundle 1738KB → 1176KB)
- [x] Search debounce (300ms) on clients and domains
- [x] Scroll restoration on route change
- [x] Error boundary for crash recovery
- [x] Skeleton loading states for all charts and tables
- [x] Changelog tab in Settings
- [x] Command palette (Cmd+K)
- [x] Toast notifications system

### v1.5 - Forecasting
- [x] MRR delta KPI, milestone tracker, ARPU current/projected
- [x] Growth acceleration indicator
- [x] "How it works" explanation block
- [x] Billing cycle progress, skeleton loading

### v1.6 - Revenue
- [x] Average invoice amount KPI, top product by revenue
- [x] Recurring vs one-time temporal stacked area chart
- [x] KPIs reorganized into 2 responsive rows

### v1.7 - Clients
- [x] Retention rate, net growth, revenue concentration KPIs
- [x] Net client growth combined chart (bars + line)
- [x] Top clients MRR/Revenue toggle

### v1.8 - Products
- [x] Statistics section: KPIs, top by MRR, MRR by category
- [x] Distribution by payment type and product type

### v2.0 - Dashboard Home & RBAC
- [x] 8 KPI cards, business health score, quick insights, quick links
- [x] Role-based access control (admin/viewer)
- [x] AdminGuard route protection, sidebar filtering, command palette filtering
- [x] Sync page with route `/sync` (admin only)
- [x] Action button redesign (translucent bg + border)
- [x] Dark-friendly chart tooltip cursors
- [x] Email templates redesigned (dark theme matching app)
- [x] Complete i18n (English + Spanish)
- [x] Locale-aware date formatting

### v2.2 - CRM Connectors
- [x] HubSpot CRM outbound connector (contacts, lifecycle, notes)
- [x] Salesforce CRM outbound connector (contacts, tasks, status updates)
- [x] Connectors page outbound-only clarity messaging

---

## Priority Matrix

### High Priority (Next)
1. Supabase SMTP configuration (team invites don't arrive)
2. Copy email templates to Supabase Dashboard
3. Google OAuth setup
4. Alert system backend implementation

### Medium Priority
1. Date range filtering
2. PDF/CSV export
3. CI/CD pipeline
4. Error tracking (Sentry)

### Low Priority (Future)
1. Additional languages (Portuguese)
2. Cohort analysis
3. ~~Onboarding tour~~ (done)
4. Storybook documentation

---

## Technical Debt

1. **Test Coverage**: Currently 0%, aim for 80%
2. **Type Safety**: Some `any` types in API responses need proper typing
3. **Accessibility**: Need full ARIA support and keyboard navigation
4. **CI/CD**: Manual deploys via `vercel --prod --yes` — should automate

---

Last updated: 2026-03-24
