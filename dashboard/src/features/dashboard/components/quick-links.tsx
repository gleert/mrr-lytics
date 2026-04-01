import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Icon } from '@/shared/components/ui/icon'
import { useFilters } from '@/app/providers/filters-provider'

const LINKS = [
  { to: '/clients', icon: 'groups', labelKey: 'nav.clients', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { to: '/revenue', icon: 'paid', labelKey: 'nav.revenue', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { to: '/forecasting', icon: 'trending_up', labelKey: 'nav.forecasting', color: 'text-violet-400', bg: 'bg-violet-500/10' },
  { to: '/domains', icon: 'language', labelKey: 'nav.domains', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { to: '/products', icon: 'inventory_2', labelKey: 'nav.products', color: 'text-pink-400', bg: 'bg-pink-500/10' },
  { to: '/billable-items', icon: 'receipt_long', labelKey: 'nav.billableItems', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { to: '/sync', icon: 'sync', labelKey: 'sync.title', color: 'text-cyan-400', bg: 'bg-cyan-500/10', adminOnly: true },
]

export function QuickLinks() {
  const { t } = useTranslation()
  const { userRole } = useFilters()
  const isAdmin = userRole === 'admin'

  return (
    <div data-tour="quick-links" className="flex gap-2 overflow-x-auto pb-1">
      {LINKS.filter(link => !link.adminOnly || isAdmin).map(link => (
        <Link
          key={link.to}
          to={link.to}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover transition-colors shrink-0"
        >
          <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${link.bg}`}>
            <Icon name={link.icon} size="sm" className={link.color} />
          </div>
          <span className="text-sm font-medium">{t(link.labelKey)}</span>
        </Link>
      ))}
    </div>
  )
}
