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
import { RevenuePage } from '@/features/revenue'
import { ClientsPage } from '@/features/clients'
import { ProductsPage } from '@/features/products'
import { DomainsPage } from '@/features/domains'
import { ForecastingPage } from '@/features/forecasting'

import { SettingsPage } from '@/features/settings'
import { BillingPage } from '@/features/billing'
import { ProfilePage } from '@/features/profile'
import { ConnectorsPage } from '@/features/connectors'
import { ReportsPage } from '@/features/reports'
import { SuperAdminPage } from '@/features/superadmin'

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
        <Route path="/revenue" element={<RevenuePage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/domains" element={<DomainsPage />} />
        <Route path="/forecasting" element={<ForecastingPage />} />
        <Route path="/connectors" element={<ConnectorsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/billing" element={<BillingPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/superadmin" element={<SuperAdminPage />} />
      </Route>

      {/* Catch all - redirect to dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
