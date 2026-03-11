import * as React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Spinner } from '@/shared/components/ui/spinner'
import { useAuth, type UserRole } from '@/app/providers/auth-provider'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: UserRole
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) {
    // Redirect to login, but save the current location
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  // Check role if required
  if (requiredRole && user?.role !== requiredRole) {
    // User doesn't have required role, redirect to dashboard
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
