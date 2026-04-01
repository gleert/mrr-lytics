import * as React from 'react'
import { useTranslation } from 'react-i18next'
import * as XLSX from 'xlsx'
import { NoInstancesGuard } from '@/shared/components/no-instances-guard'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/ui/icon'
import { DashboardFilters } from '@/features/dashboard/components/dashboard-filters'
import { useFilters } from '@/app/providers'
import {
  useCategories,
  useCreateCategory,
  type CreateCategoryData,
  type UpdateCategoryData,
} from '@/features/categories'
import { CategoryFormModal } from '@/features/categories/components/category-form-modal'
import {
  useBillableItems,
  useCreateBillableItemCategoryMapping,
  useDeleteBillableItemCategoryMapping,
  type BillableItem,
} from '../hooks/use-billable-items'
import { BillableItemRow } from '../components/billable-item-row'
import { BillableItemsStats } from '../components/billable-items-stats'

export function BillableItemsPage() {
  const { t } = useTranslation()
  const { userRole } = useFilters()
  const isAdmin = userRole === 'admin'

  const [searchQuery, setSearchQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'completed' | 'one_time'>('all')
  const [cycleFilter, setCycleFilter] = React.useState<string>('all')
  const [updatingItems, setUpdatingItems] = React.useState<Set<string>>(new Set())
  const [isCategoryFormOpen, setIsCategoryFormOpen] = React.useState(false)

  const { data, isLoading } = useBillableItems()
  const { data: categories } = useCategories()
  const createMapping = useCreateBillableItemCategoryMapping()
  const deleteMapping = useDeleteBillableItemCategoryMapping()
  const createCategory = useCreateCategory()

  const availableCycles = React.useMemo(() => {
    if (!data?.items) return []
    const cycles = [...new Set(data.items.map(i => i.recurcycle).filter(Boolean))] as string[]
    return cycles.sort()
  }, [data?.items])

  const filteredItems = React.useMemo(() => {
    if (!data?.items) return []
    const query = searchQuery.toLowerCase()
    return data.items
      .filter(item => {
        if (item.status === 'one_time') return false
        if (statusFilter !== 'all' && item.status !== statusFilter) return false
        if (cycleFilter !== 'all' && (item.recurcycle || null) !== cycleFilter) return false
        if (query && !item.description?.toLowerCase().includes(query) && !item.client_name?.toLowerCase().includes(query)) return false
        return true
      })
      .sort((a, b) => (b.in_period ? 1 : 0) - (a.in_period ? 1 : 0))
  }, [data?.items, searchQuery, statusFilter, cycleFilter])

  const handleCategoryChange = async (item: BillableItem, categoryId: string | null) => {
    const itemKey = `${item.instance_id}:${item.whmcs_id}`
    setUpdatingItems(prev => new Set(prev).add(itemKey))

    try {
      if (categoryId === null && item.category) {
        await deleteMapping.mutateAsync({
          categoryId: item.category.id,
          instanceId: item.instance_id,
          whmcsId: item.whmcs_id,
        })
      } else if (categoryId) {
        if (item.category && item.category.id !== categoryId) {
          await deleteMapping.mutateAsync({
            categoryId: item.category.id,
            instanceId: item.instance_id,
            whmcsId: item.whmcs_id,
          })
        }
        await createMapping.mutateAsync({
          categoryId,
          data: {
            instance_id: item.instance_id,
            mapping_type: 'billable_item',
            whmcs_id: item.whmcs_id,
          },
        })
      }
    } catch (err) {
      console.error('Failed to update billable item category mapping:', err)
    } finally {
      setUpdatingItems(prev => {
        const next = new Set(prev)
        next.delete(itemKey)
        return next
      })
    }
  }

  const handleCreateCategory = async (data: CreateCategoryData | UpdateCategoryData) => {
    try {
      await createCategory.mutateAsync(data as CreateCategoryData)
      setIsCategoryFormOpen(false)
    } catch (err) {
      console.error('Failed to create category:', err)
    }
  }

  const [exportOpen, setExportOpen] = React.useState(false)
  const exportRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const exportRows = () => filteredItems.map(item => ({
    instance: item.instance_name,
    description: item.description || '',
    client: item.client_name || '',
    amount: item.amount,
    cycle: item.recurcycle || '',
    status: item.status,
    monthly_mrr: item.monthly_mrr,
    category: item.category?.name || '',
    due_date: item.duedate || '',
  }))

  const exportColumns = [
    { key: 'instance',    label: t('products.instance') },
    { key: 'description', label: t('billableItems.table.description') },
    { key: 'client',      label: t('billableItems.table.client') },
    { key: 'amount',      label: t('billableItems.table.amount') },
    { key: 'cycle',       label: t('billableItems.table.cycle') },
    { key: 'status',      label: t('common.filter') },
    { key: 'monthly_mrr', label: t('billableItems.table.monthlyMrr') },
    { key: 'category',    label: t('billableItems.table.category') },
    { key: 'due_date',    label: 'Due Date' },
  ]

  const handleExportCsv = () => {
    const rows = exportRows()
    if (!rows.length) return
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`
    const header = exportColumns.map(c => escape(c.label)).join(',')
    const lines = rows.map(row =>
      exportColumns.map(c => escape(String((row as Record<string, unknown>)[c.key] ?? ''))).join(',')
    )
    const csv = '\uFEFF' + [header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `billable-items-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExportOpen(false)
  }

  const handleExportXlsx = () => {
    const rows = exportRows()
    if (!rows.length) return
    const data = [
      exportColumns.map(c => c.label),
      ...rows.map(row => exportColumns.map(c => (row as Record<string, unknown>)[c.key] ?? '')),
    ]
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = exportColumns.map(() => ({ wch: 20 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Billable Items')
    XLSX.writeFile(wb, `billable-items-${new Date().toISOString().split('T')[0]}.xlsx`)
    setExportOpen(false)
  }

  return (
    <NoInstancesGuard>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t('billableItems.title')}</h1>
            <p className="text-muted">{t('billableItems.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Export dropdown */}
            <div className="relative" ref={exportRef}>
              <button
                onClick={() => setExportOpen(v => !v)}
                disabled={filteredItems.length === 0}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border bg-surface hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icon name="download" size="sm" />
                {t('common.export')}
                <Icon name="expand_more" size="sm" />
              </button>
              {exportOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-surface-elevated border border-border rounded-lg shadow-xl py-1 z-50">
                  <button
                    onClick={handleExportCsv}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover transition-colors"
                  >
                    <Icon name="description" size="sm" />
                    CSV
                  </button>
                  <button
                    onClick={handleExportXlsx}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover transition-colors"
                  >
                    <Icon name="table_view" size="sm" />
                    Excel (.xlsx)
                  </button>
                </div>
              )}
            </div>
            <DashboardFilters showPeriod={true} />
          </div>
        </div>

        {/* KPI Stats */}
        <BillableItemsStats
          items={data?.items || []}
          totalMrr={data?.total_mrr || 0}
          isLoading={isLoading}
        />

        {/* Table card */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Icon name="receipt_long" size="md" />
              {t('billableItems.title')}
              {(searchQuery || statusFilter !== 'all' || cycleFilter !== 'all') && (
                <span className="text-sm font-normal text-muted">
                  ({filteredItems.length} / {data?.items?.length || 0})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-4">
            {/* Search + filters */}
            <div className="px-4 pb-4 flex flex-wrap gap-2 items-center">
              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
                className="px-3 py-1.5 text-sm rounded-lg border border-border bg-surface-elevated"
              >
                <option value="all">{t('billableItems.filters.allStatuses')}</option>
                <option value="active">{t('billableItems.status.active')}</option>
                <option value="completed">{t('billableItems.status.completed')}</option>
              </select>

              {/* Cycle filter */}
              <select
                value={cycleFilter}
                onChange={e => setCycleFilter(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg border border-border bg-surface-elevated"
              >
                <option value="all">{t('billableItems.filters.allCycles')}</option>
                {availableCycles.map(cycle => (
                  <option key={cycle} value={cycle}>
                    {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                  </option>
                ))}
              </select>

              {/* Search */}
              <div className="relative">
                <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t('billableItems.searchPlaceholder')}
                  className="pl-9 pr-3 py-1.5 text-sm rounded-lg border border-border bg-surface-elevated w-48 text-foreground placeholder:text-muted focus:outline-none"
                />
              </div>
            </div>

            {/* Table body */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Icon name="sync" size="xl" className="animate-spin text-muted" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Icon name="receipt_long" size="2xl" className="text-muted/30 mb-3" />
                <p className="text-muted">{t('billableItems.noItems')}</p>
              </div>
            ) : (
              <div data-tour="billable-items-table" className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-surface/50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-28">
                        {t('products.instance')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                        {t('billableItems.table.description')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-40">
                        {t('billableItems.table.client')}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider w-28">
                        {t('billableItems.table.amount')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-24">
                        {t('billableItems.table.cycle')}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider w-28">
                        {t('billableItems.table.monthlyMrr')}
                      </th>
                      {isAdmin && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-48">
                          {t('billableItems.table.category')}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map(item => (
                      <BillableItemRow
                        key={item.id}
                        item={item}
                        categories={categories || []}
                        onCategoryChange={categoryId => handleCategoryChange(item, categoryId)}
                        onCreateCategory={() => setIsCategoryFormOpen(true)}
                        isUpdating={updatingItems.has(`${item.instance_id}:${item.whmcs_id}`)}
                        showCategoryColumn={isAdmin}
                        inPeriod={item.in_period}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <CategoryFormModal
          isOpen={isCategoryFormOpen}
          onClose={() => setIsCategoryFormOpen(false)}
          onSubmit={handleCreateCategory}
          category={null}
          isLoading={createCategory.isPending}
        />
      </div>
    </NoInstancesGuard>
  )
}
