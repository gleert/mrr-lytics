import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { useAuth, useTheme } from '@/app/providers'

interface SidebarProps {
  isMobile?: boolean
  open?: boolean
  onClose?: () => void
}

interface NavItem {
  to: string
  icon: string // Material Symbol name
  labelKey: string
  adminOnly?: boolean
}

// Main menu items
const menuItems: NavItem[] = [
  { to: '/', icon: 'dashboard', labelKey: 'nav.dashboard' },
  { to: '/revenue', icon: 'paid', labelKey: 'nav.revenue' },
  { to: '/forecasting', icon: 'trending_up', labelKey: 'nav.forecasting' },
  { to: '/clients', icon: 'group', labelKey: 'nav.clients' },
]

// Products section items
const productItems: NavItem[] = [
  { to: '/products', icon: 'inventory_2', labelKey: 'nav.products' },
  { to: '/domains', icon: 'language', labelKey: 'nav.domains' },
]

// Others section items
const otherItems: NavItem[] = [
  { to: '/connectors', icon: 'cable', labelKey: 'nav.connectors' },
  { to: '/reports', icon: 'description', labelKey: 'nav.reports' },
]

const bottomItems: NavItem[] = [
  { to: '/settings', icon: 'settings', labelKey: 'nav.settings' },
  { to: '/profile', icon: 'person', labelKey: 'nav.profile' },
]

export function Sidebar({ isMobile = false, open = false, onClose }: SidebarProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const { user, signOut } = useAuth()

  const isAdmin = user?.role === 'admin'

  // Close sidebar on nav click (mobile only)
  const handleNavClick = () => {
    if (isMobile && onClose) {
      onClose()
    }
  }

  const renderNavItem = (item: NavItem) => {
    if (item.adminOnly && !isAdmin) return null

    const label = t(item.labelKey)
    const isActive =
      item.to === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(item.to)

    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={handleNavClick}
        className={cn(
          'group relative flex items-center gap-4 rounded-xl px-4 py-3 text-base font-normal transition-all duration-200',
          isActive
            ? 'bg-primary-500/15 text-primary-400'
            : 'text-muted hover:text-foreground hover:bg-surface-hover'
        )}
      >
        <Icon 
          name={item.icon} 
          size="lg"
          filled={isActive}
          className={cn(
            'shrink-0 transition-colors',
            isActive ? 'text-primary-400' : 'text-muted group-hover:text-foreground'
          )} 
        />
        <span className="truncate">{label}</span>
      </NavLink>
    )
  }

  // Mobile drawer classes
  const mobileClasses = isMobile
    ? cn(
        'fixed inset-y-0 left-0 z-50 w-[320px]',
        open ? 'translate-x-0' : '-translate-x-full',
        'transition-transform duration-300 ease-in-out'
      )
    : ''

  // Desktop classes - fixed width
  const desktopClasses = !isMobile ? 'relative w-[320px]' : ''

  // Don't render on mobile when closed (after animation)
  if (isMobile && !open) {
    return null
  }

  return (
    <aside
      className={cn(
        'glass-sidebar flex flex-col h-full',
        mobileClasses,
        desktopClasses
      )}
    >
      {/* Logo */}
      <div className="flex h-20 items-center justify-between px-5">
        <div className="flex items-center">
          <img
            src="/logo-white.svg"
            alt="MRRlytics"
            className="h-[38px] w-auto hidden dark:block"
            draggable={false}
          />
          <img
            src="/logo-purple.svg"
            alt="MRRlytics"
            className="h-[38px] w-auto block dark:hidden"
            draggable={false}
          />
        </div>

        {/* Close button (mobile only) */}
        {isMobile && onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-xl text-muted hover:text-foreground"
          >
            <Icon name="close" size="lg" />
          </Button>
        )}
      </div>

      {/* Menu section */}
      <div className="px-5 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Menu
        </span>
      </div>

      {/* Main navigation */}
      <nav className="space-y-1 px-4 py-2">
        {menuItems.map(renderNavItem)}
      </nav>

      {/* Products section */}
      <div className="px-5 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t('nav.productsSection')}
        </span>
      </div>

      {/* Products navigation */}
      <nav className="space-y-1 px-4 py-2">
        {productItems.map(renderNavItem)}
      </nav>

      {/* Others section */}
      <div className="px-5 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t('nav.othersSection')}
        </span>
      </div>

      {/* Others navigation */}
      <nav className="flex-1 space-y-1 px-4 py-2">
        {otherItems.map(renderNavItem)}
      </nav>

      {/* Bottom navigation */}
      <nav className="space-y-1 px-4 py-4">
        {bottomItems.map(renderNavItem)}
        
        {/* Logout button */}
        <button
          onClick={() => {
            handleNavClick()
            signOut()
          }}
          className={cn(
            'group relative flex w-full items-center gap-4 rounded-xl px-4 py-3 text-base font-normal transition-all duration-200',
            'text-muted hover:text-foreground hover:bg-surface-hover'
          )}
        >
          <Icon 
            name="logout" 
            size="lg"
            className="shrink-0 transition-colors text-muted group-hover:text-foreground"
          />
          <span className="truncate">{t('nav.logout')}</span>
        </button>
      </nav>
    </aside>
  )
}
