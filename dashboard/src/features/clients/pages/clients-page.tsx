import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
import { KPICard } from '@/features/dashboard/components/kpi-card'
import { DashboardFilters } from '@/features/dashboard/components/dashboard-filters'
import { useClientStats, useClientsList, type WhmcsClient } from '../hooks/use-client-stats'
import { ClientTrendCharts } from '../components/client-trend-charts'
import { TopClientsBlock } from '../components/top-clients-block'
import { cn } from '@/shared/lib/utils'
import { useCurrency } from '@/shared/hooks/use-currency'

export function ClientsPage() {
  const { t } = useTranslation()
  const { data: stats, isLoading: statsLoading } = useClientStats()
  const { formatCurrency } = useCurrency()
  
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState('whmcs_id')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  
  const { data: clientsData, isLoading: listLoading } = useClientsList({
    status: statusFilter,
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

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      Active: 'bg-success/10 text-success',
      Inactive: 'bg-warning/10 text-warning',
      Closed: 'bg-error/10 text-error',
    }
    return (
      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', styles[status] || 'bg-muted/10 text-muted')}>
        {status}
      </span>
    )
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <Icon name="unfold_more" size="sm" className="text-muted" />
    return sortOrder === 'asc' 
      ? <Icon name="keyboard_arrow_up" size="sm" /> 
      : <Icon name="keyboard_arrow_down" size="sm" />
  }

  return (
    <div className="space-y-6">
      {/* Page header with filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('clients.title')}</h1>
          <p className="text-muted">{t('clients.subtitle')}</p>
        </div>
        <DashboardFilters />
      </div>

      {/* KPI Cards - Row 1: Client counts */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard
          title={t('clients.totalClients')}
          value={stats?.total_clients ?? 0}
          loading={statsLoading}
          icon={<Icon name="groups" size="2xl" />}
          accentColor="primary"
        />
        <KPICard
          title={t('clients.activeClients')}
          value={stats?.active_clients ?? 0}
          loading={statsLoading}
          icon={<Icon name="person_check" size="2xl" />}
          accentColor="success"
        />
        <KPICard
          title={t('clients.newClients')}
          value={stats?.new_clients ?? 0}
          loading={statsLoading}
          icon={<Icon name="person_add" size="2xl" />}
          accentColor="info"
        />
        <KPICard
          title={t('clients.churnedClients')}
          value={stats?.churned_clients ?? 0}
          loading={statsLoading}
          icon={<Icon name="person_remove" size="2xl" />}
          accentColor="warning"
        />
        <KPICard
          title={t('clients.inactiveClients')}
          value={stats?.inactive_clients ?? 0}
          loading={statsLoading}
          icon={<Icon name="person_off" size="2xl" />}
          accentColor="error"
        />
      </div>

      {/* Top Clients Block */}
      <TopClientsBlock />

      {/* KPI Cards - Row 2: Financial metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title={t('clients.arpu')}
          value={stats?.arpu ?? 0}
          format="currency"
          loading={statsLoading}
          icon={<Icon name="account_balance_wallet" size="2xl" />}
          accentColor="primary"
        />
        <KPICard
          title={t('clients.ltv')}
          value={stats?.ltv ?? 0}
          format="currency"
          loading={statsLoading}
          icon={<Icon name="savings" size="2xl" />}
          accentColor="success"
        />
        <KPICard
          title={t('clients.revenueInPeriod')}
          value={stats?.revenue_in_period ?? 0}
          format="currency"
          loading={statsLoading}
          icon={<Icon name="paid" size="2xl" />}
          accentColor="info"
        />
        <KPICard
          title={t('clients.clientsWithRevenue')}
          value={stats?.clients_with_revenue ?? 0}
          loading={statsLoading}
          icon={<Icon name="receipt_long" size="2xl" />}
          accentColor="warning"
        />
      </div>

      {/* Client Trend Charts */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{t('clients.trendTitle')}</h2>
          <p className="text-muted">{t('clients.trendDesc')}</p>
        </div>
        {stats && (
          <ClientTrendCharts stats={stats} isLoading={statsLoading} />
        )}
        {!stats && statsLoading && (
          <ClientTrendCharts
            stats={{
              total_clients: 0, active_clients: 0, inactive_clients: 0, closed_clients: 0,
              new_clients: 0, churned_clients: 0, mrr: 0, arr: 0, arpu: 0, ltv: 0,
              revenue_in_period: 0, clients_with_revenue: 0,
              new_clients_trend: [], churned_clients_trend: [], bucket_type: 'monthly',
              period: { type: '30d', start_date: '', end_date: '', days: 30 },
            }}
            isLoading={true}
          />
        )}
      </div>

      {/* Client List */}
      <div className="rounded-xl border border-border bg-surface">
        {/* Table header with filters */}
        <div className="flex flex-col gap-4 p-4 border-b border-border sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Icon name="table_chart" size="lg" className="text-primary-400" />
            <div>
              <h2 className="text-lg font-medium">{t('clients.clientList')}</h2>
              <p className="text-sm text-muted">
                {clientsData?.pagination.total ?? 0} {t('clients.clientsFound')}
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
              <option value="all">{t('clients.allStatuses')}</option>
              <option value="Active">{t('clients.statusActive')}</option>
              <option value="Inactive">{t('clients.statusInactive')}</option>
              <option value="Closed">{t('clients.statusClosed')}</option>
            </select>
            
            {/* Search */}
            <div className="relative">
              <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder={t('clients.searchByIdOrName')}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
                className="pl-9 pr-3 py-1.5 text-sm rounded-lg border border-border bg-surface-elevated w-40"
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
                  onClick={() => handleSort('whmcs_id')}
                >
                  <div className="flex items-center gap-1">
                    ID <SortIcon field="whmcs_id" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider cursor-pointer hover:bg-surface-elevated"
                  onClick={() => handleSort('firstname')}
                >
                  <div className="flex items-center gap-1">
                    {t('clients.name')} <SortIcon field="firstname" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider"
                >
                  {t('clients.domain')}
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider cursor-pointer hover:bg-surface-elevated"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    {t('clients.status')} <SortIcon field="status" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider cursor-pointer hover:bg-surface-elevated"
                  onClick={() => handleSort('services_count')}
                >
                  <div className="flex items-center justify-end gap-1">
                    {t('clients.services')} <SortIcon field="services_count" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider cursor-pointer hover:bg-surface-elevated"
                  onClick={() => handleSort('current_mrr')}
                >
                  <div className="flex items-center justify-end gap-1">
                    MRR <SortIcon field="current_mrr" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider cursor-pointer hover:bg-surface-elevated"
                  onClick={() => handleSort('total_paid')}
                >
                  <div className="flex items-center justify-end gap-1">
                    {t('clients.totalPaid')} <SortIcon field="total_paid" />
                  </div>
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
              ) : clientsData?.clients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    {t('clients.noClientsFound')}
                  </td>
                </tr>
              ) : (
                clientsData?.clients.map((client: WhmcsClient) => (
                  <tr key={client.id} className="hover:bg-surface-elevated/50">
                    <td className="px-4 py-3 text-sm font-mono">
                      #{client.whmcs_id}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>
                        <span className="font-medium">
                          {client.companyname || [client.firstname, client.lastname].filter(Boolean).join(' ') || '-'}
                        </span>
                        {client.companyname && (client.firstname || client.lastname) && (
                          <span className="block text-xs text-muted">
                            {[client.firstname, client.lastname].filter(Boolean).join(' ')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {client.primary_domain || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {getStatusBadge(client.status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {client.services_count}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {formatCurrency(client.current_mrr)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-muted">
                      {formatCurrency(client.total_paid)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {clientsData && clientsData.pagination.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted">
              {t('clients.showingPage', { 
                page: clientsData.pagination.page, 
                total: clientsData.pagination.total_pages 
              })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={!clientsData.pagination.has_prev}
                className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.previous')}
              </button>
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={!clientsData.pagination.has_next}
                className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
