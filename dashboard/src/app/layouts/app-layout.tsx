import * as React from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { Backdrop } from '@/shared/components/ui/backdrop'
import { TrialBanner } from '@/features/billing'
import { useMobile } from '@/shared/hooks'
import { CommandPaletteProvider } from '@/shared/components/command-palette'

export function AppLayout() {
  const { isMobile } = useMobile()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

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

  return (
    <CommandPaletteProvider>
      <div className="flex h-screen overflow-hidden">
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
