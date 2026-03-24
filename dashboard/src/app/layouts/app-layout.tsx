import * as React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { Backdrop } from '@/shared/components/ui/backdrop'
import { TrialBanner } from '@/features/billing'
import { useMobile } from '@/shared/hooks'
import { CommandPaletteProvider } from '@/shared/components/command-palette'
import { TourProvider } from '@/features/onboarding'
import { ImpersonationBanner } from '@/features/superadmin/components/impersonation-banner'
import { ErrorBoundary } from '@/shared/components/error-boundary'
import { SuspendedScreen } from '@/features/superadmin/components/suspended-screen'
import { AccountDeletedScreen } from '@/features/superadmin/components/account-deleted-screen'
import { useFilters } from '@/app/providers'

export function AppLayout() {
  const { isMobile } = useMobile()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const { getCurrentTenant, isTenantDeleted } = useFilters()
  const location = useLocation()
  const mainRef = React.useRef<HTMLElement>(null)

  // Scroll to top on route change
  React.useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [location.pathname])

  // Check if tenant is suspended
  const currentTenant = getCurrentTenant()
  const isSuspended = (currentTenant as { status?: string })?.status === 'suspended'

  // Handle impersonation token from URL → store in sessionStorage, clean URL
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('impersonate_token')
    const tenantId = params.get('impersonating')

    if (token && tenantId) {
      sessionStorage.setItem('impersonate_token', token)
      sessionStorage.setItem('impersonating_tenant_id', tenantId)
      // Remove from URL without reload
      params.delete('impersonate_token')
      params.delete('impersonating')
      const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '')
      window.history.replaceState({}, '', newUrl)
    }
  }, [])

  // Check impersonation from sessionStorage
  const impersonatingTenantId = React.useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('impersonating') || sessionStorage.getItem('impersonating_tenant_id')
  }, [])

  // Close mobile sidebar when switching to desktop
  React.useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(false)
    }
  }, [isMobile])

  const handleMenuClick = () => {
    setSidebarOpen(true)
  }

  const handleSidebarClose = () => {
    setSidebarOpen(false)
  }

  // Show account deleted screen
  if (isTenantDeleted) {
    return <AccountDeletedScreen />
  }

  // Show suspended screen if tenant is suspended
  if (isSuspended) {
    return <SuspendedScreen />
  }

  const handleExitImpersonation = () => {
    sessionStorage.removeItem('impersonate_token')
    sessionStorage.removeItem('impersonating_tenant_id')
    window.location.href = '/'
  }

  return (
    <CommandPaletteProvider>
    <TourProvider onOpenSidebar={handleMenuClick}>
      {impersonatingTenantId && (
        <ImpersonationBanner
          tenantId={impersonatingTenantId}
          onExit={handleExitImpersonation}
        />
      )}
      <div className={`flex h-screen overflow-hidden ${impersonatingTenantId ? 'pt-10' : ''}`}>
        {/* Mobile backdrop */}
        {isMobile && (
          <Backdrop open={sidebarOpen} onClose={handleSidebarClose} />
        )}

        {/* Sidebar - Desktop: always visible, Mobile: drawer */}
        <Sidebar
          isMobile={isMobile}
          open={sidebarOpen}
          onClose={handleSidebarClose}
        />

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header 
            isMobile={isMobile} 
            onMenuClick={handleMenuClick}
          />
          <TrialBanner />
          <main ref={mainRef} className="flex-1 overflow-auto p-4 lg:p-6">
            <ErrorBoundary>
            <Outlet />
            </ErrorBoundary>
            {/* Logo watermark */}
            <div className="flex justify-center pt-12 pb-4 pointer-events-none select-none">
              <img
                src="/logo-purple.svg"
                alt=""
                className="w-48"
                draggable={false}
              />
            </div>
          </main>
        </div>
      </div>
    </TourProvider>
    </CommandPaletteProvider>
  )
}
