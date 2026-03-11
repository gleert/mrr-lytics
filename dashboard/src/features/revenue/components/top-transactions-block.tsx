import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
import { useTopTransactions } from '../hooks/use-revenue-stats'
import { useCurrency } from '@/shared/hooks/use-currency'

export function TopTransactionsBlock() {
  const { t } = useTranslation()
  const { formatCurrency, formatCurrencyCompact } = useCurrency()
  const { data, isLoading } = useTopTransactions(5)

  if (isLoading) {
    return (
      <div className="rounded-xl bg-surface border border-border p-6">
        <div className="flex items-center justify-center h-32">
          <Icon name="sync" size="xl" className="animate-spin text-muted" />
        </div>
      </div>
    )
  }

  const transactions = data?.transactions || []
  const totalAmount = data?.total_amount || 0

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl bg-surface border border-border p-6">
        <div className="flex flex-col items-center justify-center h-32 text-muted">
          <Icon name="receipt_long" size="xl" className="mb-2 opacity-50" />
          <p>{t('revenue.topTransactions.noTransactions')}</p>
        </div>
      </div>
    )
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

  const rankColors = [
    'bg-amber-400 text-amber-900',
    'bg-slate-300 text-slate-700',
    'bg-amber-600 text-amber-100',
    'bg-surface-elevated text-muted',
    'bg-surface-elevated text-muted',
  ]

  return (
    <div className="rounded-xl bg-surface border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Icon name="emoji_events" size="lg" className="text-amber-400" />
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {t('revenue.topTransactions.title')}
            </h3>
            <p className="text-xs text-muted">{t('revenue.topTransactions.subtitle')}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">{t('revenue.total')}</p>
          <p className="text-lg font-bold text-foreground tabular-nums">
            {formatCurrencyCompact(totalAmount)}
          </p>
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border">
        {transactions.map((tx, index) => (
          <div
            key={tx.id}
            className={`flex items-center gap-4 px-5 transition-colors ${
              index === 0
                ? 'py-4 bg-amber-500/5 border-l-2 border-amber-400 hover:bg-amber-500/10'
                : 'py-3.5 hover:bg-surface-elevated'
            }`}
          >
            {/* Rank badge */}
            <span
              className={`flex-shrink-0 flex items-center justify-center rounded-full text-xs font-bold ${
                index === 0
                  ? 'w-7 h-7 bg-amber-400 text-amber-900'
                  : `w-6 h-6 ${rankColors[index] ?? rankColors[3]}`
              }`}
            >
              {index + 1}
            </span>

            {/* Client + product */}
            <div className="min-w-0 flex-1">
              <p className={`font-medium truncate ${index === 0 ? 'text-base text-foreground' : 'text-sm text-foreground'}`}>
                {tx.client_name}
              </p>
              <p className="text-xs text-muted truncate">{tx.product_name}</p>
            </div>

            {/* Invoice + date */}
            <div className="hidden sm:flex flex-col items-end text-right flex-shrink-0">
              <span className="text-xs font-mono text-muted">#{tx.invoice_num}</span>
              <span className="text-xs text-muted">{formatDate(tx.date)}</span>
            </div>

            {/* Amount */}
            <span className={`flex-shrink-0 font-semibold tabular-nums ${index === 0 ? 'text-base text-amber-400' : 'text-sm text-foreground'}`}>
              {formatCurrency(tx.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
