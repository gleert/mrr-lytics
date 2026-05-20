import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
import { Card, CardContent } from '@/shared/components/ui/card'
import { TableSkeleton } from '@/shared/components/ui/chart-skeleton'
import { NoInstancesGuard } from '@/shared/components/no-instances-guard'
import { DashboardFilters } from '@/features/dashboard/components/dashboard-filters'
import { useCurrency } from '@/shared/hooks/use-currency'
import { cn } from '@/shared/lib/utils'
import { useMRRLedger, type MRRLedgerEntry } from '../hooks/use-metrics'

const TYPE_BADGE: Record<MRRLedgerEntry['type'], string> = {
  hosting: 'bg-info/10 text-info',
  billable: 'bg-warning/10 text-warning',
  domain: 'bg-primary-500/10 text-primary-400',
}

export function MRRLedgerPage() {
  const { t } = useTranslation()
  const { formatCurrency } = useCurrency()
  const { data, isLoading, error } = useMRRLedger()

  // Running balance accumulates over the date-sorted entries up to the MRR total.
  const rows = useMemo(() => {
    const result: { entry: MRRLedgerEntry; balance: number }[] = []
    ;(data?.entries ?? []).reduce((sum, entry) => {
      const next = sum + entry.monthly_amount
      result.push({ entry, balance: Math.round(next * 100) / 100 })
      return next
    }, 0)
    return result
  }, [data])

  const typeLabel = (type: MRRLedgerEntry['type']) =>
    t(`dashboard.mrrLedger.type.${type}`)

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
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">{t('dashboard.mrrLedger.colDate')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">{t('dashboard.mrrLedger.colClient')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">{t('dashboard.mrrLedger.colConcept')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">{t('dashboard.mrrLedger.colType')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">{t('dashboard.mrrLedger.colCycle')}</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">{t('dashboard.mrrLedger.colMrr')}</th>
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
