import * as React from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { Backdrop } from '@/shared/components/ui/backdrop'
import { TrialBanner } from '@/features/billing'
import { useMobile } from '@/shared/hooks'
import { CommandPaletteProvider } from '@/shared/components/command-palette'
import { ImpersonationBanner } from '@/features/superadmin/components/impersonation-banner'
import { SuspendedScreen } from '@/features/superadmin/components/suspended-screen'
import { useFilters } from '@/app/providers'

export function AppLayout() {
  const { isMobile } = useMobile()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const { getCurrentTenant } = useFilters()

  // Check if tenant is suspended
  const currentTenant = getCurrentTenant()
  const isSuspended = (currentTenant as { status?: string })?.status === 'suspended'

  // Check impersonation from query param
  const impersonatingTenantId = React.useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('impersonating')
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

  // Show suspended screen if tenant is suspended
  if (isSuspended) {
    return <SuspendedScreen />
  }

  const handleExitImpersonation = () => {
    navigate('/')
    window.location.href = '/'
  }

  return (
    <CommandPaletteProvider>
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
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <Outlet />
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
    </CommandPaletteProvider>
  )
}
