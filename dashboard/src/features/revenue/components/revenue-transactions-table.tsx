import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useRevenueTransactions, type TransactionFilters } from '../hooks/use-revenue-stats'
import { formatDate, cn } from '@/shared/lib/utils'
import { useCurrency } from '@/shared/hooks/use-currency'

const TYPE_COLORS: Record<string, string> = {
  Hosting: 'bg-primary-500/10 text-primary-400',
  Domain: 'bg-blue-500/10 text-blue-400',
  DomainRegister: 'bg-blue-500/10 text-blue-400',
  DomainTransfer: 'bg-blue-500/10 text-blue-400',
  Addon: 'bg-emerald-500/10 text-emerald-400',
  Item: 'bg-amber-500/10 text-amber-400',
  Setup: 'bg-violet-500/10 text-violet-400',
  'Late Fee': 'bg-red-500/10 text-red-400',
  Invoice: 'bg-gray-500/10 text-gray-400',
}

const STATUS_COLORS: Record<string, string> = {
  Paid: 'bg-emerald-500/10 text-emerald-400',
  Unpaid: 'bg-amber-500/10 text-amber-400',
  Cancelled: 'bg-gray-500/10 text-gray-400',
  Refunded: 'bg-blue-500/10 text-blue-400',
  Collections: 'bg-red-500/10 text-red-400',
  'Payment Pending': 'bg-amber-500/10 text-amber-400',
  Draft: 'bg-gray-500/10 text-muted',
}

const INVOICE_STATUSES = ['Paid', 'Unpaid', 'Cancelled', 'Refunded', 'Collections']

export function RevenueTransactionsTable() {
  const { t } = useTranslation()
  const { formatCurrency } = useCurrency()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<TransactionFilters>({})
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showFilters, setShowFilters] = useState(false)

  // Local filter states
  const [searchInput, setSearchInput] = useState('')
  const [selectedType, setSelectedType] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedSource, setSelectedSource] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [amountMin, setAmountMin] = useState<string>('')
  const [amountMax, setAmountMax] = useState<string>('')

  const { data, isLoading } = useRevenueTransactions(page, 20, filters, sortBy, sortOrder)

  const transactions = data?.transactions || []
  const pagination = data?.pagination
  const filterOptions = data?.filters

  // Apply filters
  const applyFilters = () => {
    const newFilters: TransactionFilters = {}
    if (searchInput.trim()) newFilters.search = searchInput.trim()
    if (selectedType) newFilters.type = selectedType
    if (selectedCategory) newFilters.category = selectedCategory
    if (selectedSource) newFilters.source = selectedSource
    if (selectedStatus) newFilters.status = selectedStatus
    if (amountMin) newFilters.amount_min = parseFloat(amountMin)
    if (amountMax) newFilters.amount_max = parseFloat(amountMax)
    setFilters(newFilters)
    setPage(1)
  }

  // Clear filters
  const clearFilters = () => {
    setSearchInput('')
    setSelectedType('')
    setSelectedCategory('')
    setSelectedSource('')
    setSelectedStatus('')
    setAmountMin('')
    setAmountMax('')
    setFilters({})
    setPage(1)
  }

  // Toggle sort
  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const hasActiveFilters = useMemo(() => {
    return Object.keys(filters).length > 0
  }, [filters])

  const getTypeColor = (type: string) => {
    return TYPE_COLORS[type] || 'bg-gray-500/10 text-gray-400'
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      {/* Header */}
      <div className="flex flex-col gap-4 p-4 border-b border-border sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Icon name="receipt_long" size="lg" className="text-primary-400" />
          <div>
            <h2 className="text-lg font-medium">{t('revenue.transactions.title')}</h2>
            <p className="text-sm text-muted">{t('revenue.transactions.desc')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              placeholder={t('revenue.transactions.searchPlaceholder')}
              className={cn(
                'h-9 w-48 rounded-lg bg-background pl-9 pr-3 text-sm',
                'border border-border',
                'focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
                'placeholder:text-muted-foreground'
              )}
            />
          </div>

          {/* Filter toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(hasActiveFilters && 'border-primary-500 text-primary-400')}
          >
            <Icon name="filter_list" size="sm" className="mr-1" />
            {t('common.filter')}
            {hasActiveFilters && (
              <span className="ml-1 bg-primary-500 text-white text-xs px-1.5 rounded-full">
                {Object.keys(filters).length}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-4 border-b border-border bg-surface-elevated/50">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Type Filter */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">
                {t('revenue.transactions.type')}
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className={cn(
                  'w-full h-9 rounded-lg bg-background px-3 text-sm',
                  'border border-border',
                  'focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
                )}
              >
                <option value="">{t('revenue.transactions.allTypes')}</option>
                {filterOptions?.types.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">
                {t('revenue.transactions.category')}
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={cn(
                  'w-full h-9 rounded-lg bg-background px-3 text-sm',
                  'border border-border',
                  'focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
                )}
              >
                <option value="">{t('revenue.transactions.allCategories')}</option>
                {filterOptions?.categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Source Filter */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">
                {t('revenue.transactions.source')}
              </label>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className={cn(
                  'w-full h-9 rounded-lg bg-background px-3 text-sm',
                  'border border-border',
                  'focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
                )}
              >
                <option value="">{t('revenue.transactions.allSources')}</option>
                <option value="recurring">{t('revenue.transactions.sourceRecurring')}</option>
                <option value="onetime">{t('revenue.transactions.sourceOnetime')}</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">
                {t('revenue.transactions.status', 'Status')}
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className={cn(
                  'w-full h-9 rounded-lg bg-background px-3 text-sm',
                  'border border-border',
                  'focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
                )}
              >
                <option value="">{t('revenue.transactions.allStatuses', 'All statuses')}</option>
                {INVOICE_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            {/* Amount Range */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">
                {t('revenue.transactions.amountRange')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={amountMin}
                  onChange={(e) => setAmountMin(e.target.value)}
                  placeholder={t('revenue.transactions.min')}
                  className={cn(
                    'w-full h-9 rounded-lg bg-background px-3 text-sm',
                    'border border-border',
                    'focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
                  )}
                />
                <span className="text-muted">-</span>
                <input
                  type="number"
                  value={amountMax}
                  onChange={(e) => setAmountMax(e.target.value)}
                  placeholder={t('revenue.transactions.max')}
                  className={cn(
                    'w-full h-9 rounded-lg bg-background px-3 text-sm',
                    'border border-border',
                    'focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
                  )}
                />
              </div>
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              {t('revenue.transactions.clearFilters')}
            </Button>
            <Button size="sm" onClick={applyFilters}>
              {t('revenue.transactions.applyFilters')}
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th
                className="px-4 py-3 text-left text-xs font-medium text-muted cursor-pointer hover:text-foreground"
                onClick={() => toggleSort('date')}
              >
                <div className="flex items-center gap-1">
                  {t('revenue.transactions.date')}
                  {sortBy === 'date' && (
                    <Icon name={sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'} size="xs" />
                  )}
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted">
                {t('revenue.transactions.invoice')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted">
                {t('revenue.transactions.status', 'Status')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted">
                {t('revenue.transactions.client')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted">
                {t('revenue.transactions.category')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted">
                {t('revenue.transactions.product')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted">
                {t('revenue.transactions.type')}
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-muted cursor-pointer hover:text-foreground"
                onClick={() => toggleSort('amount')}
              >
                <div className="flex items-center justify-end gap-1">
                  {t('revenue.transactions.amount')}
                  {sortBy === 'amount' && (
                    <Icon name={sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'} size="xs" />
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-14" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                  <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                </tr>
              ))
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted">
                    <Icon name="receipt_long" size="xl" className="opacity-50" />
                    <p>{t('revenue.transactions.noTransactions')}</p>
                  </div>
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-surface-hover/50">
                  <td className="px-4 py-3 text-sm">{formatDate(tx.date)}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono text-primary-400">#{tx.invoice_num}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                      STATUS_COLORS[tx.invoice_status] || 'bg-gray-500/10 text-gray-400'
                    )}>
                      {tx.invoice_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium truncate max-w-[200px]" title={tx.client_name}>
                    {tx.client_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {tx.category || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm truncate max-w-[200px]" title={tx.product_name}>
                    {tx.product_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                      getTypeColor(tx.type)
                    )}>
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    {formatCurrency(tx.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-sm text-muted">
            {t('revenue.transactions.showingPage', {
              page: pagination.page,
              total: pagination.total_pages,
            })}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
            >
              <Icon name="chevron_left" size="sm" />
            </Button>
            {/* Page numbers */}
            {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
              const pageNum = page <= 3
                ? i + 1
                : page >= pagination.total_pages - 2
                  ? pagination.total_pages - 4 + i
                  : page - 2 + i
              if (pageNum < 1 || pageNum > pagination.total_pages) return null
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPage(pageNum)}
                  className="w-8 h-8 p-0"
                >
                  {pageNum}
                </Button>
              )
            })}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= pagination.total_pages}
            >
              <Icon name="chevron_right" size="sm" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
