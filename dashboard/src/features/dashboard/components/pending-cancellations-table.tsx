import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
import { usePendingCancellations } from '../hooks/use-metrics'
import { cn } from '@/shared/lib/utils'
import { useCurrency } from '@/shared/hooks/use-currency'
import { TableSkeleton } from '@/shared/components/ui/chart-skeleton'

export function PendingCancellationsTable() {
  const { t } = useTranslation()
  const { data, isLoading } = usePendingCancellations(10)
  const { formatCurrency } = useCurrency()

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '-'
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const getDaysUntilBadge = (days: number) => {
    if (days <= 7) {
      return 'bg-destructive/10 text-destructive'
    } else if (days <= 14) {
      return 'bg-warning/10 text-warning'
    }
    return 'bg-muted/10 text-muted'
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Icon name="event_busy" size="lg" className="text-destructive" />
          <div>
            <h2 className="text-lg font-medium">{t('dashboard.pendingCancellations.title')}</h2>
            <p className="text-sm text-muted">{t('dashboard.pendingCancellations.desc')}</p>
          </div>
        </div>
        {data && data.count > 0 && (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-muted">{t('dashboard.pendingCancellations.totalLoss')}</p>
              <p className="text-lg font-bold text-destructive">-{formatCurrency(data.total_mrr_loss)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="p-4">
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : !data?.cancellations?.length ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted">
            <Icon name="check_circle" size="xl" className="mb-2 text-success opacity-50" />
            <p>{t('dashboard.pendingCancellations.noCancellations')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 px-2 text-left text-sm font-medium text-muted">
                  {t('dashboard.pendingCancellations.client')}
                </th>
                <th className="py-3 px-2 text-left text-sm font-medium text-muted">
                  {t('dashboard.pendingCancellations.item')}
                </th>
                <th className="py-3 px-2 text-right text-sm font-medium text-muted">
                  {t('dashboard.pendingCancellations.mrrLoss')}
                </th>
                <th className="py-3 px-2 text-right text-sm font-medium text-muted">
                  {t('dashboard.pendingCancellations.churnDate')}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.cancellations.map((cancellation) => (
                <tr 
                  key={cancellation.id} 
                  className="border-b border-border/50 last:border-0 hover:bg-surface-hover transition-colors"
                >
                  <td className="py-3 px-2">
                    <span className="font-medium">{cancellation.client_name}</span>
                  </td>
                  <td className="py-3 px-2">
                    <span className="text-muted truncate max-w-[200px] block">{cancellation.item_name}</span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className="font-medium text-destructive">-{formatCurrency(cancellation.mrr_loss)}</span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-sm">{formatDate(cancellation.churn_date)}</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        getDaysUntilBadge(cancellation.days_until_churn)
                      )}>
                        {cancellation.days_until_churn}d
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
