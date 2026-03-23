import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NoInstancesGuard } from '@/shared/components/no-instances-guard'
import {
  BarChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ComposedChart,
  Legend,
} from 'recharts'
import { Icon } from '@/shared/components/ui/icon'
import { DomainFavicon } from '@/shared/components/ui/domain-favicon'
import { KPICard } from '@/features/dashboard/components/kpi-card'
import { DashboardFilters } from '@/features/dashboard/components/dashboard-filters'
import { useDomainStats, useDomainsList, type WhmcsDomain } from '../hooks/use-domain-stats'
import { cn } from '@/shared/lib/utils'
import { useCurrency } from '@/shared/hooks/use-currency'

const STATUS_COLORS: Record<string, string> = {
  Active: '#10B981',      // Green
  Pending: '#F59E0B',     // Amber
  'Pending Transfer': '#F59E0B',
  Expired: '#EF4444',     // Red
  Cancelled: '#6B7280',   // Gray
  Transferred: '#8B5CF6', // Purple
  Fraud: '#DC2626',       // Dark red
  Unknown: '#9CA3AF',     // Light gray
}

const TLD_COLORS = [
  '#7C3AED', // Purple
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#8B5CF6', // Violet
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#6366F1', // Indigo
  '#84CC16', // Lime
  '#A855F7', // Purple light
  '#22D3EE', // Cyan light
  '#FB923C', // Orange light
]

export function DomainsPage() {
  const { t } = useTranslation()
  const { data: stats, isLoading: statsLoading } = useDomainStats()
  const { formatCurrency } = useCurrency()
  
  const [statusFilter, setStatusFilter] = useState('Active')
  const [tldFilter, setTldFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState('domain')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  
  // Get all TLDs from stats for filter dropdown
  const availableTlds = stats?.all_tlds || []
  
  const { data: domainsData, isLoading: listLoading } = useDomainsList({
    status: statusFilter,
    tld: tldFilter,
    search: searchQuery,
    sort: sortField,
    order: sortOrder,
    page: currentPage,
    limit: 25,
  })

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
    setCurrentPage(1)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '-'
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      Active: 'bg-success/10 text-success',
      Pending: 'bg-warning/10 text-warning',
      'Pending Transfer': 'bg-warning/10 text-warning',
      Expired: 'bg-error/10 text-error',
      Cancelled: 'bg-error/10 text-error',
      Transferred: 'bg-muted/10 text-muted',
    }
    return (
      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', styles[status] || 'bg-muted/10 text-muted')}>
        {status}
      </span>
    )
  }

  const isExpiringSoon = (expiryDate: string | null) => {
    if (!expiryDate) return false
    const expiry = new Date(expiryDate)
    const today = new Date()
    const thirtyDays = new Date(today)
    thirtyDays.setDate(thirtyDays.getDate() + 30)
    return expiry >= today && expiry <= thirtyDays
  }

  const ActiveVsLostTooltip = ({ active, payload, label }: {
    active?: boolean
    payload?: Array<{ name: string; value: number; color: string }>
    label?: string
  }) => {
    if (!active || !payload?.length) return null
    const activeEntry = payload.find(p => p.name === 'active')
    const lostEntry   = payload.find(p => p.name === 'lost')
    const activeVal   = activeEntry?.value ?? 0
    const lostVal     = lostEntry?.value   ?? 0
    const retentionPct = activeVal > 0 ? ((activeVal / (activeVal + lostVal)) * 100).toFixed(1) : '—'

    return (
      <div className="rounded-xl border border-border bg-background shadow-xl px-4 py-3 min-w-[180px]">
        <p className="text-sm font-semibold text-foreground mb-2">{label}</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-sm text-muted">{t('domains.activeDomains')}</span>
            </div>
            <span className="text-sm font-semibold text-foreground">{activeVal.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
              <span className="text-sm text-muted">{t('domains.lostDomains')}</span>
            </div>
            <span className="text-sm font-semibold text-foreground">{lostVal.toLocaleString()}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted">{t('domains.retentionRate')}</span>
            <span className="text-xs font-bold text-emerald-400">{retentionPct}%</span>
          </div>
        </div>
      </div>
    )
  }

  const StatusTooltip = ({ active, payload }: {
    active?: boolean
    payload?: Array<{ name: string; value: number; payload: { name: string; value: number } }>
  }) => {
    if (!active || !payload?.length) return null
    const entry = payload[0]
    const name  = entry.payload.name
    const value = entry.payload.value
    const total = stats?.total_domains ?? 0
    const pct   = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
    const color = STATUS_COLORS[name] || '#9CA3AF'

    return (
      <div className="rounded-xl border border-border bg-background shadow-xl px-4 py-3 min-w-[160px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <p className="text-sm font-semibold text-foreground">{name}</p>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-sm text-muted">{t('domains.totalDomains')}</span>
          <span className="text-sm font-bold text-foreground">{value.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between gap-6 mt-1">
          <span className="text-sm text-muted">{t('domains.shareOf')}</span>
          <span className="text-sm font-bold" style={{ color }}>{pct}%</span>
        </div>
      </div>
    )
  }

  const TldTooltip = ({ active, payload }: {
    active?: boolean
    payload?: Array<{ name: string; value: number; payload: { name: string; value: number } }>
  }) => {
    if (!active || !payload?.length) return null
    const entry = payload[0]
    const name  = entry.payload.name
    const value = entry.payload.value
    const total = stats?.total_domains ?? 0
    const pct   = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
    const tldIndex = stats?.tld_breakdown?.findIndex(t => t.name === name) ?? 0
    const color = TLD_COLORS[tldIndex % TLD_COLORS.length] || '#8B5CF6'

    return (
      <div className="rounded-xl border border-border bg-background shadow-xl px-4 py-3 min-w-[160px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <p className="text-sm font-semibold text-foreground">{name}</p>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-sm text-muted">{t('domains.totalDomains')}</span>
          <span className="text-sm font-bold text-foreground">{value.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between gap-6 mt-1">
          <span className="text-sm text-muted">{t('domains.shareOf')}</span>
          <span className="text-sm font-bold" style={{ color }}>{pct}%</span>
        </div>
      </div>
    )
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <Icon name="unfold_more" size="sm" className="text-muted" />
    return sortOrder === 'asc' 
      ? <Icon name="keyboard_arrow_up" size="sm" /> 
      : <Icon name="keyboard_arrow_down" size="sm" />
  }

  return (
    <NoInstancesGuard>
    <div className="space-y-6">
      {/* Page header with filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('domains.title')}</h1>
          <p className="text-muted">{t('domains.subtitle')}</p>
        </div>
        <DashboardFilters />
      </div>

      {/* Domain Status Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{t('domains.statusSectionTitle')}</h2>
          <p className="text-muted">{t('domains.statusSectionDesc')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KPICard
            title={t('domains.totalDomains')}
            value={stats?.total_domains ?? 0}
            loading={statsLoading}
            icon={<Icon name="language" size="2xl" />}
            accentColor="primary"
          />
          <KPICard
            title={t('domains.activeDomains')}
            value={stats?.active_domains ?? 0}
            loading={statsLoading}
            icon={<Icon name="check_circle" size="2xl" />}
            accentColor="success"
          />
          <KPICard
            title={t('domains.pendingDomains')}
            value={stats?.pending_domains ?? 0}
            loading={statsLoading}
            icon={<Icon name="pending" size="2xl" />}
            accentColor="warning"
          />
          <KPICard
            title={t('domains.expiredDomains')}
            value={stats?.expired_domains ?? 0}
            loading={statsLoading}
            icon={<Icon name="cancel" size="2xl" />}
            accentColor="error"
          />
          <KPICard
            title={t('domains.expiringSoon')}
            value={stats?.expiring_soon ?? 0}
            loading={statsLoading}
            icon={<Icon name="schedule" size="2xl" />}
            accentColor="warning"
          />
        </div>
      </div>

      {/* Domain Revenue Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{t('domains.revenueSectionTitle')}</h2>
          <p className="text-muted">{t('domains.revenueSectionDesc')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title={t('domains.totalRecurring')}
            value={stats?.total_recurring ?? 0}
            format="currency"
            loading={statsLoading}
            icon={<Icon name="paid" size="2xl" />}
            accentColor="primary"
          />
          <KPICard
            title={t('domains.avgPerDomain')}
            value={stats?.total_domains && stats.total_domains > 0 
              ? (stats.total_recurring / stats.active_domains) 
              : 0}
            format="currency"
            loading={statsLoading}
            icon={<Icon name="euro" size="2xl" />}
            accentColor="success"
          />
          <KPICard
            title={t('domains.newDomains')}
            value={stats?.new_domains ?? 0}
            loading={statsLoading}
            icon={<Icon name="add_circle" size="2xl" />}
            accentColor="info"
            changePercent={stats?.new_domains_change}
          />
          <KPICard
            title={t('domains.doNotRenew')}
            value={stats?.do_not_renew ?? 0}
            loading={statsLoading}
            icon={<Icon name="block" size="2xl" />}
            accentColor="error"
          />
        </div>
      </div>

      {/* Domain Analytics Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{t('domains.analyticsTitle')}</h2>
          <p className="text-muted">{t('domains.analyticsDesc')}</p>
        </div>

        {/* Charts Grid - Side by side on large screens */}
        <div className="grid gap-4 lg:grid-cols-2">
        {/* Domains by Status Chart */}
        <div className="rounded-xl border border-border bg-surface">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <Icon name="donut_large" size="lg" className="text-primary-400" />
            <div>
              <h2 className="text-lg font-medium">{t('domains.byStatus')}</h2>
              <p className="text-sm text-muted">{t('domains.byStatusDesc')}</p>
            </div>
          </div>

          <div className="p-4">
            {statsLoading ? (
              <div className="flex items-center justify-center h-48">
                <Icon name="sync" size="xl" className="animate-spin text-muted" />
              </div>
            ) : !stats?.status_breakdown?.length ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted">
                <Icon name="bar_chart" size="xl" className="mb-2 opacity-50" />
                <p>{t('domains.noData')}</p>
              </div>
            ) : (
              <div className="h-[220px] sm:h-[260px] lg:h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.status_breakdown}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--color-border)' }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--color-border)' }}
                      width={90}
                    />
                    <Tooltip content={<StatusTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {stats.status_breakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#9CA3AF'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Domains by TLD Chart */}
        <div className="rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Icon name="language" size="lg" className="text-primary-400" />
          <div>
            <h2 className="text-lg font-medium">{t('domains.byTld')}</h2>
            <p className="text-sm text-muted">{t('domains.byTldDesc')}</p>
          </div>
        </div>

        <div className="p-4">
          {statsLoading ? (
            <div className="flex items-center justify-center h-48">
              <Icon name="sync" size="xl" className="animate-spin text-muted" />
            </div>
          ) : !stats?.tld_breakdown?.length ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted">
              <Icon name="bar_chart" size="xl" className="mb-2 opacity-50" />
              <p>{t('domains.noData')}</p>
            </div>
          ) : (
            <div className="h-[220px] sm:h-[260px] lg:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.tld_breakdown}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-border)' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    width={70}
                  />
                  <Tooltip content={<TldTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {stats.tld_breakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={TLD_COLORS[index % TLD_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        </div>
      </div>
      </div>

      {/* Registered vs Expired Chart */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Icon name="history" size="lg" className="text-primary-400" />
          <div>
            <h2 className="text-lg font-medium">{t('domains.registeredVsExpiredTitle')}</h2>
            <p className="text-sm text-muted">{t('domains.registeredVsExpiredDesc')}</p>
          </div>
        </div>

        <div className="p-4">
          {statsLoading ? (
            <div className="flex items-center justify-center h-72">
              <Icon name="sync" size="xl" className="animate-spin text-muted" />
            </div>
          ) : !stats?.registered_vs_expired?.length ? (
            <div className="flex flex-col items-center justify-center h-72 text-muted">
              <Icon name="bar_chart" size="xl" className="mb-2 opacity-50" />
              <p>{t('domains.noData')}</p>
            </div>
          ) : (
            <div className="h-[240px] sm:h-[280px] lg:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={stats.registered_vs_expired}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <defs>
                    <linearGradient id="gradient-active" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="gradient-lost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-border)' }}
                  />
                  <YAxis
                    tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ActiveVsLostTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={32}
                    formatter={(value) => (
                      <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>
                        {value === 'active' ? t('domains.activeDomains') : t('domains.lostDomains')}
                      </span>
                    )}
                  />

                  <Area
                    type="monotone"
                    dataKey="active"
                    stroke="#10B981"
                    strokeWidth={2}
                    fill="url(#gradient-active)"
                    dot={{ fill: '#10B981', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="lost"
                    stroke="#EF4444"
                    strokeWidth={2}
                    fill="url(#gradient-lost)"
                    dot={{ fill: '#EF4444', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Expiring Soon Alert Section */}
      {stats?.expiring_domains && stats.expiring_domains.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{t('domains.expiringAlertTitle')}</h2>
            <p className="text-muted">{t('domains.expiringAlertSubtitle')}</p>
          </div>

          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            {/* Header banner */}
            <div className="flex items-center gap-4 px-6 py-4 bg-gradient-to-r from-amber-500/15 to-red-500/10 border-b border-border">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/20 flex-shrink-0">
                <Icon name="schedule" size="xl" className="text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-foreground">{stats.expiring_soon}</span>
                  <span className="text-lg font-medium text-muted">{t('domains.domainsExpiring')}</span>
                </div>
                <p className="text-sm text-muted">{t('domains.expiringAlertDesc')}</p>
              </div>
              <div className="hidden sm:flex items-center gap-4 text-sm text-muted flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                  {t('domains.urgentLabel')}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
                  {t('domains.soonLabel')}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 flex-shrink-0" />
                  {t('domains.upcomingLabel')}
                </div>
              </div>
            </div>

            {/* Mini table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-surface-elevated/40">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted uppercase tracking-wider">{t('domains.domain')}</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted uppercase tracking-wider">{t('domains.client')}</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-muted uppercase tracking-wider">{t('domains.daysLeft')}</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted uppercase tracking-wider">{t('domains.expiryDate')}</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted uppercase tracking-wider">{t('domains.recurringAmount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stats.expiring_domains.map((domain) => {
                    const urgency = domain.days_left <= 7 ? 'critical' : domain.days_left <= 14 ? 'soon' : 'upcoming'
                    return (
                      <tr
                        key={domain.domain}
                        className={cn(
                          'transition-colors',
                          urgency === 'critical' ? 'bg-red-500/5 hover:bg-red-500/10' :
                          urgency === 'soon'     ? 'bg-amber-500/5 hover:bg-amber-500/10' :
                                                   'hover:bg-surface-elevated/50'
                        )}
                      >
                        <td className="px-4 py-3 text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <DomainFavicon domain={domain.domain} size={16} />
                            <span>{domain.domain}</span>
                            <span className={cn(
                              'w-2 h-2 rounded-full flex-shrink-0',
                              urgency === 'critical' ? 'bg-red-500' :
                              urgency === 'soon'     ? 'bg-amber-400' : 'bg-blue-400'
                            )} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted">
                          {domain.client_name || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className={cn(
                            'inline-flex items-center justify-center min-w-[48px] px-2.5 py-0.5 rounded-full text-xs font-bold',
                            urgency === 'critical' ? 'bg-red-500/20 text-red-400' :
                            urgency === 'soon'     ? 'bg-amber-500/20 text-amber-400' :
                                                     'bg-blue-500/20 text-blue-400'
                          )}>
                            {domain.days_left}d
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted">
                          {formatDate(domain.expirydate)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          {formatCurrency(Number(domain.recurringamount) || 0)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Domain List */}
      <div className="rounded-xl border border-border bg-surface">
        {/* Table header with filters */}
        <div className="flex flex-col gap-4 p-4 border-b border-border sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Icon name="dns" size="lg" className="text-primary-400" />
            <div>
              <h2 className="text-lg font-medium">{t('domains.domainList')}</h2>
              <p className="text-sm text-muted">
                {domainsData?.pagination.total ?? 0} {t('domains.domainsFound')}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}
              className="px-3 py-1.5 text-sm rounded-lg border border-border bg-surface-elevated"
            >
              <option value="all">{t('domains.allStatuses')}</option>
              <option value="Active">{t('domains.statusActive')}</option>
              <option value="Pending">{t('domains.statusPending')}</option>
              <option value="Expired">{t('domains.statusExpired')}</option>
              <option value="Cancelled">{t('domains.statusCancelled')}</option>
            </select>

            {/* TLD filter */}
            <select
              value={tldFilter}
              onChange={(e) => { setTldFilter(e.target.value); setCurrentPage(1) }}
              className="px-3 py-1.5 text-sm rounded-lg border border-border bg-surface-elevated"
            >
              <option value="all">{t('domains.allTlds')}</option>
              {availableTlds.map((tld) => (
                <option key={tld} value={tld}>{tld}</option>
              ))}
            </select>
            
            {/* Search */}
            <div className="relative">
              <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder={t('domains.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
                className="pl-9 pr-3 py-1.5 text-sm rounded-lg border border-border bg-surface-elevated w-48"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-elevated/50">
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider cursor-pointer hover:bg-surface-elevated"
                  onClick={() => handleSort('domain')}
                >
                  <div className="flex items-center gap-1">
                    {t('domains.domain')} <SortIcon field="domain" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  {t('domains.client')}
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider cursor-pointer hover:bg-surface-elevated"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    {t('domains.status')} <SortIcon field="status" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider cursor-pointer hover:bg-surface-elevated"
                  onClick={() => handleSort('registrationdate')}
                >
                  <div className="flex items-center gap-1">
                    {t('domains.registrationDate')} <SortIcon field="registrationdate" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider cursor-pointer hover:bg-surface-elevated"
                  onClick={() => handleSort('expirydate')}
                >
                  <div className="flex items-center gap-1">
                    {t('domains.expiryDate')} <SortIcon field="expirydate" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider cursor-pointer hover:bg-surface-elevated"
                  onClick={() => handleSort('recurringamount')}
                >
                  <div className="flex items-center justify-end gap-1">
                    {t('domains.recurringAmount')} <SortIcon field="recurringamount" />
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted uppercase tracking-wider">
                  {t('domains.extras')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {listLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <Icon name="sync" size="xl" className="animate-spin text-muted" />
                  </td>
                </tr>
              ) : domainsData?.domains.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    {t('domains.noDomainsFound')}
                  </td>
                </tr>
              ) : (
                domainsData?.domains.map((domain: WhmcsDomain) => (
                  <tr key={domain.id} className="hover:bg-surface-elevated/50">
                     <td className="px-4 py-3 text-sm">
                       <div className="flex items-center gap-2">
                         <DomainFavicon domain={domain.domain} size={16} />
                         <span className="font-medium">{domain.domain}</span>
                         {domain.donotrenew && (
                           <Icon name="block" size="sm" className="text-error" title={t('domains.doNotRenewLabel')} />
                         )}
                         {isExpiringSoon(domain.expirydate) && (
                           <Icon name="warning" size="sm" className="text-warning" title={t('domains.expiringSoonLabel')} />
                         )}
                       </div>
                     </td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {domain.client_name || `#${domain.client_id}`}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {getStatusBadge(domain.status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {formatDate(domain.registrationdate)}
                    </td>
                    <td className={cn(
                      "px-4 py-3 text-sm",
                      isExpiringSoon(domain.expirydate) ? "text-warning font-medium" : "text-muted"
                    )}>
                      {formatDate(domain.expirydate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {formatCurrency(Number(domain.recurringamount) || 0)}
                      {domain.registrationperiod && (
                        <span className="text-xs text-muted ml-1">
                          /{domain.registrationperiod}y
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <div className="flex items-center justify-center gap-1">
                        {domain.dnsmanagement && (
                          <Icon name="dns" size="sm" className="text-info" title="DNS Management" />
                        )}
                        {domain.emailforwarding && (
                          <Icon name="forward_to_inbox" size="sm" className="text-info" title="Email Forwarding" />
                        )}
                        {domain.idprotection && (
                          <Icon name="shield" size="sm" className="text-success" title="ID Protection" />
                        )}
                        {!domain.dnsmanagement && !domain.emailforwarding && !domain.idprotection && (
                          <span className="text-muted">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {domainsData && domainsData.pagination.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted">
              {t('domains.showingPage', { 
                page: domainsData.pagination.page, 
                total: domainsData.pagination.total_pages 
              })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={!domainsData.pagination.has_prev}
                className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.previous')}
              </button>
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={!domainsData.pagination.has_next}
                className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </NoInstancesGuard>
  )
}
