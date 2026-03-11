# MRRlytics Dashboard - Pending Items

This document tracks features and improvements that are not part of the MVP but should be implemented in future iterations.

## Authentication

### Google OAuth Setup (Required for Production)
- [ ] Create Google Cloud Project
- [ ] Enable Google+ API
- [ ] Create OAuth 2.0 credentials
- [ ] Configure redirect URIs in Google Console
- [ ] Add Google provider in Supabase Dashboard
- [ ] Update `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for production

### Additional Auth Features
- [ ] Email/password authentication as alternative
- [ ] Magic link authentication
- [ ] Session timeout warning
- [ ] "Remember me" functionality
- [ ] Multi-factor authentication (MFA)

## User Management

- [ ] Profile page (`/settings/profile`)
- [ ] Avatar upload functionality
- [ ] User invitation system (admin only)
- [ ] User role management UI
- [ ] Last login tracking display

## Tenant Management (Admin Feature)

- [ ] Full CRUD for tenants
- [ ] WHMCS connection testing
- [ ] API key generation and management
- [ ] Tenant settings (sync interval, etc.)
- [ ] Tenant usage statistics

## Metrics & Analytics

### Date Range Filtering
- [ ] Custom date range picker (calendar)
- [ ] Date range persistence across sessions
- [ ] API integration with date parameters

### Export Features
- [ ] PDF export with charts (use html2canvas + jspdf)
- [ ] Scheduled export reports
- [ ] Email report delivery

### Forecasting
- [ ] Simple linear regression for MRR forecast
- [ ] Forecast visualization on charts
- [ ] Confidence intervals

### Additional Metrics
- [ ] Customer Lifetime Value (CLV)
- [ ] Net Revenue Retention (NRR)
- [ ] Average Revenue Per User (ARPU)
- [ ] Cohort analysis
- [ ] Revenue by geography

## Alerts & Notifications

- [ ] Alert configuration UI
- [ ] Alert thresholds (e.g., MRR drops > 10%)
- [ ] Email notifications
- [ ] In-app notification center
- [ ] Webhook integrations

## Sync Management

- [ ] Detailed sync error logs
- [ ] Sync configuration per tenant
- [ ] Retry failed syncs
- [ ] Sync scheduling UI
- [ ] Partial sync (only specific data types)

## Performance Optimizations

- [ ] Code splitting with React.lazy()
- [ ] Route-based code splitting
- [ ] Image optimization
- [ ] Service worker for offline support
- [ ] Bundle size optimization

## UI/UX Improvements

- [ ] Keyboard shortcuts
- [ ] Command palette (Cmd+K)
- [ ] Onboarding tour for new users
- [ ] Empty states with illustrations
- [ ] Loading skeletons everywhere
- [ ] Error boundaries with retry
- [ ] Toast notifications system
- [ ] Confirmation dialogs for destructive actions

## Internationalization

- [ ] Spanish translations
- [ ] Portuguese translations
- [ ] Language selector in settings
- [ ] RTL support (Arabic, Hebrew)
- [ ] Currency localization

## Testing

- [ ] Unit tests with Vitest
- [ ] Component tests with Testing Library
- [ ] E2E tests with Playwright
- [ ] Visual regression tests
- [ ] Accessibility tests

## Documentation

- [ ] Component documentation (Storybook)
- [ ] API client documentation
- [ ] User guide
- [ ] Admin guide

## DevOps & Deployment

- [ ] Docker configuration
- [ ] CI/CD pipeline
- [ ] Environment-specific builds
- [ ] Error tracking (Sentry)
- [ ] Analytics (Plausible/PostHog)
- [ ] Performance monitoring

## Security

- [ ] Content Security Policy headers
- [ ] Rate limiting awareness in UI
- [ ] CSRF protection
- [ ] XSS prevention audit
- [ ] Dependency vulnerability scanning

---

## Priority Matrix

### High Priority (Next Sprint)
1. Google OAuth setup
2. PDF export
3. Toast notifications
4. Error boundaries

### Medium Priority (Following Sprints)
1. Date range filtering
2. Tenant management
3. Alert configuration
4. Code splitting

### Low Priority (Future)
1. Additional languages
2. Forecasting
3. Cohort analysis
4. Storybook documentation

---

## Technical Debt

1. **Bundle Size**: Currently ~940KB, should be under 500KB with code splitting
2. **Type Safety**: Some `any` types in API responses need proper typing
3. **Test Coverage**: Currently 0%, aim for 80%
4. **Accessibility**: Need full ARIA support and keyboard navigation

---

Last updated: 2026-02-17
