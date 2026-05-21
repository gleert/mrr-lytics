import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { TableSkeleton } from '@/shared/components/ui/chart-skeleton'
import { NoInstancesGuard } from '@/shared/components/no-instances-guard'
import { DashboardFilters } from '@/features/dashboard/components/dashboard-filters'
import {
  REPORT_COLUMNS,
  ledgerEntriesToRows,
  generateCsv,
  downloadCsv,
  generateXlsx,
  downloadXlsxFile,
} from '@/features/reports/hooks/use-report-export'
import { useFilters } from '@/app/providers'
import { useCurrency } from '@/shared/hooks/use-currency'
import { cn } from '@/shared/lib/utils'
import { useMRRLedger, type MRRLedgerEntry } from '../hooks/use-metrics'

const TYPE_BADGE: Record<MRRLedgerEntry['type'], string> = {
  hosting: 'bg-info/10 text-info',
  billable: 'bg-warning/10 text-warning',
  domain: 'bg-primary-500/10 text-primary-400',
}

type SortKey = 'date' | 'client' | 'concept' | 'type' | 'cycle' | 'mrr'

export function MRRLedgerPage() {
  const { t } = useTranslation()
  const { formatCurrency } = useCurrency()
  const { allInstances } = useFilters()
  const { data, isLoading, error } = useMRRLedger()

  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Build CSV/Excel exports from the already-loaded ledger entries (no extra fetch),
  // reusing the shared report export pipeline so columns and formatting stay consistent.
  const hasData = (data?.entries?.length ?? 0) > 0
  const buildExport = () => {
    const instanceName = new Map(allInstances.map(i => [i.instance_id, i.instance_name]))
    const columns = REPORT_COLUMNS.ledger
    const exportRows = ledgerEntriesToRows(data?.entries ?? [], instanceName)
    const headers = columns.map(c => t(c.labelKey))
    const filename = `mrrlytics-ledger-${new Date().toISOString().split('T')[0]}`
    return { columns, exportRows, headers, filename }
  }
  const handleDownloadCsv = () => {
    if (!hasData) return
    const { columns, exportRows, headers, filename } = buildExport()
    downloadCsv(generateCsv(exportRows, columns, headers), `${filename}.csv`)
  }
  const handleDownloadExcel = () => {
    if (!hasData) return
    const { columns, exportRows, headers, filename } = buildExport()
    downloadXlsxFile(generateXlsx(exportRows, columns, headers, 'Ledger'), `${filename}.xlsx`)
  }

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const typeLabel = (type: MRRLedgerEntry['type']) =>
    t(`dashboard.mrrLedger.type.${type}`)

  // Sort by the chosen column, then accumulate the running balance over the
  // displayed order so the last row always reaches the MRR total.
  const rows = useMemo(() => {
    const sorted = [...(data?.entries ?? [])]
    const dir = sortDir === 'asc' ? 1 : -1
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'mrr':
          return (a.monthly_amount - b.monthly_amount) * dir
        case 'date': {
          // Unknown dates always sort last, regardless of direction.
          if (!a.start_date && !b.start_date) return 0
          if (!a.start_date) return 1
          if (!b.start_date) return -1
          return (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0) * dir
        }
        case 'client':
          return a.client_name.localeCompare(b.client_name) * dir
        case 'concept':
          return a.description.localeCompare(b.description) * dir
        case 'cycle':
          return a.billing_cycle.localeCompare(b.billing_cycle) * dir
        case 'type':
          return a.type.localeCompare(b.type) * dir
        default:
          return 0
      }
    })
    const result: { entry: MRRLedgerEntry; balance: number }[] = []
    sorted.reduce((sum, entry) => {
      const next = sum + entry.monthly_amount
      result.push({ entry, balance: Math.round(next * 100) / 100 })
      return next
    }, 0)
    return result
  }, [data, sortKey, sortDir])

  const sortHeader = (label: string, key: SortKey, align: 'left' | 'right' = 'left') => (
    <th
      className={cn(
        'px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider cursor-pointer select-none hover:bg-surface-elevated transition-colors',
        align === 'right' ? 'text-right' : 'text-left'
      )}
      onClick={() => handleSort(key)}
      aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span className={cn('inline-flex items-center gap-1', align === 'right' && 'flex-row-reverse')}>
        {label}
        <Icon
          name={sortKey === key ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
          size="xs"
          className={sortKey === key ? 'text-primary-400' : 'text-muted-foreground/40'}
        />
      </span>
    </th>
  )

  return (
    <NoInstancesGuard>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-1"
            >
              <Icon name="arrow_back" size="sm" />
              {t('dashboard.mrrLedger.back')}
            </Link>
            <h1 className="text-2xl font-semibold text-foreground">{t('dashboard.mrrLedger.title')}</h1>
            <p className="text-muted">{t('dashboard.mrrLedger.subtitle')}</p>
          </div>
          <DashboardFilters />
        </div>

        {/* Summary */}
        {data && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted">{t('dashboard.mrrLedger.totalMrr')}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-primary-400">{formatCurrency(data.total)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('dashboard.mrrLedger.items', { count: data.count })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted">{typeLabel('hosting')}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-info">{formatCurrency(data.by_category.hosting)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted">{typeLabel('billable')}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-warning">{formatCurrency(data.by_category.billable)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted">{typeLabel('domain')}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-primary-400">{formatCurrency(data.by_category.domains)}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Download buttons */}
        {hasData && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="default" size="sm" onClick={handleDownloadCsv}>
              <Icon name="download" size="sm" />
              {t('dashboard.mrrLedger.downloadCsv')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
              <Icon name="grid_on" size="sm" />
              {t('dashboard.mrrLedger.downloadExcel')}
            </Button>
          </div>
        )}

        {/* Ledger table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6"><TableSkeleton /></div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Icon name="error" size="xl" className="text-error mb-2" />
                <p className="text-muted">{t('common.error')}</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Icon name="inbox" size="xl" className="text-muted mb-2" />
                <p className="text-muted">{t('dashboard.mrrLedger.empty')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-surface-elevated/50">
                      {sortHeader(t('dashboard.mrrLedger.colDate'), 'date')}
                      {sortHeader(t('dashboard.mrrLedger.colClient'), 'client')}
                      {sortHeader(t('dashboard.mrrLedger.colConcept'), 'concept')}
                      {sortHeader(t('dashboard.mrrLedger.colType'), 'type')}
                      {sortHeader(t('dashboard.mrrLedger.colCycle'), 'cycle')}
                      {sortHeader(t('dashboard.mrrLedger.colMrr'), 'mrr', 'right')}
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">{t('dashboard.mrrLedger.colBalance')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map(({ entry, balance }, i) => (
                      <tr
                        key={`${entry.instance_id}:${entry.type}:${entry.whmcs_id}:${i}`}
                        className="hover:bg-surface-hover/40 transition-colors"
                      >
                        <td className="px-4 py-2.5 text-sm text-muted whitespace-nowrap tabular-nums">
                          {entry.start_date ? new Date(entry.start_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-sm font-medium max-w-[200px] truncate" title={entry.client_name}>
                          {entry.client_name}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-muted max-w-[280px] truncate" title={entry.description}>
                          {entry.description}
                        </td>
                        <td className="px-4 py-2.5 text-sm">
                          <span className={cn('px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide font-medium', TYPE_BADGE[entry.type])}>
                            {typeLabel(entry.type)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-muted">{entry.billing_cycle}</td>
                        <td className="px-4 py-2.5 text-sm text-right tabular-nums">{formatCurrency(entry.monthly_amount)}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-semibold tabular-nums">{formatCurrency(balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-surface-elevated/40">
                      <td colSpan={5} className="px-4 py-3 text-sm font-semibold">{t('dashboard.mrrLedger.totalMrr')}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums">{formatCurrency(data?.total ?? 0)}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-primary-400">{formatCurrency(data?.total ?? 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </NoInstancesGuard>
  )
}
