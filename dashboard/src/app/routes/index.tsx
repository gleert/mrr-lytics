import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout, AuthLayout } from '../layouts'
import {
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  AuthCallbackPage,
  ProtectedRoute,
} from '@/features/auth'
import { DashboardPage } from '@/features/dashboard'
import { Spinner } from '@/shared/components/ui/spinner'

// Lazy-loaded pages (not needed on initial load)
const RevenuePage = lazy(() => import('@/features/revenue/pages/revenue-page').then(m => ({ default: m.RevenuePage })))
const ClientsPage = lazy(() => import('@/features/clients/pages/clients-page').then(m => ({ default: m.ClientsPage })))
const ProductsPage = lazy(() => import('@/features/products/pages/products-page').then(m => ({ default: m.ProductsPage })))
const DomainsPage = lazy(() => import('@/features/domains/pages/domains-page').then(m => ({ default: m.DomainsPage })))
const ForecastingPage = lazy(() => import('@/features/forecasting/pages/forecasting-page').then(m => ({ default: m.ForecastingPage })))
const SettingsPage = lazy(() => import('@/features/settings/pages/settings-page').then(m => ({ default: m.SettingsPage })))
const BillingPage = lazy(() => import('@/features/billing/pages/billing-page').then(m => ({ default: m.BillingPage })))
const ProfilePage = lazy(() => import('@/features/profile/pages/profile-page').then(m => ({ default: m.ProfilePage })))
const ConnectorsPage = lazy(() => import('@/features/connectors/pages/connectors-page').then(m => ({ default: m.ConnectorsPage })))
const ReportsPage = lazy(() => import('@/features/reports/pages/reports-page').then(m => ({ default: m.ReportsPage })))
const SuperAdminPage = lazy(() => import('@/features/superadmin/pages/superadmin-page').then(m => ({ default: m.SuperAdminPage })))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  )
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      {/* Protected app routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="/revenue" element={<LazyPage><RevenuePage /></LazyPage>} />
        <Route path="/clients" element={<LazyPage><ClientsPage /></LazyPage>} />
        <Route path="/products" element={<LazyPage><ProductsPage /></LazyPage>} />
        <Route path="/domains" element={<LazyPage><DomainsPage /></LazyPage>} />
        <Route path="/forecasting" element={<LazyPage><ForecastingPage /></LazyPage>} />
        <Route path="/connectors" element={<LazyPage><ConnectorsPage /></LazyPage>} />
        <Route path="/reports" element={<LazyPage><ReportsPage /></LazyPage>} />
        <Route path="/settings" element={<LazyPage><SettingsPage /></LazyPage>} />
        <Route path="/settings/billing" element={<LazyPage><BillingPage /></LazyPage>} />
        <Route path="/profile" element={<LazyPage><ProfilePage /></LazyPage>} />
        <Route path="/superadmin" element={<LazyPage><SuperAdminPage /></LazyPage>} />
      </Route>

      {/* Catch all - redirect to dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
