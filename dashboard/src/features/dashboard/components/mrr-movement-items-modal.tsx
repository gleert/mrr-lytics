import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { useCurrency } from '@/shared/hooks/use-currency'
import { useMRRMovementItems, type MRRMovementItem } from '../hooks/use-metrics'

interface MRRMovementItemsModalProps {
  isOpen: boolean
  onClose: () => void
  type: 'new' | 'churned' | null
  month: string | null
}

function ItemRow({ item, type }: { item: MRRMovementItem; type: 'new' | 'churned' }) {
  const { formatCurrency } = useCurrency()

  const amountClass = type === 'new' ? 'text-success' : 'text-error'
  const amountPrefix = type === 'new' ? '+' : '-'
  const kindColor = item.kind === 'hosting' ? 'bg-info/10 text-info' : 'bg-warning/10 text-warning'

  return (
    <div className="flex items-center justify-between gap-4 p-4 border-b border-border last:border-0 hover:bg-surface-hover/50 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide font-medium ${kindColor}`}>
            {item.kind}
          </span>
          <span className="text-sm font-medium truncate">{item.client_name}</span>
        </div>
        <p className="text-xs text-muted truncate" title={item.description}>
          {item.description}
        </p>
        {item.reference_date && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {new Date(item.reference_date).toLocaleDateString()}
          </p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-semibold tabular-nums ${amountClass}`}>
          {amountPrefix}{formatCurrency(item.monthly_amount)}
        </p>
        <p className="text-[11px] text-muted">{item.billing_cycle}</p>
      </div>
    </div>
  )
}

export function MRRMovementItemsModal({ isOpen, onClose, type, month }: MRRMovementItemsModalProps) {
  const { t } = useTranslation()
  const { formatCurrency } = useCurrency()
  const { data, isLoading, error } = useMRRMovementItems(isOpen ? type : null, month)

  if (!isOpen || !type) return null

  const title = type === 'new'
    ? t('dashboard.mrrMovementItems.titleNew')
    : t('dashboard.mrrMovementItems.titleChurned')

  const monthLabel = month
    ? (() => {
        const [y, m] = month.split('-').map(Number)
        return new Date(y, (m || 1) - 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      })()
    : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-surface-elevated border border-border rounded-xl shadow-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="text-sm text-muted mt-1">{monthLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            aria-label={t('common.close')}
          >
            <Icon name="close" size="lg" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Icon name="sync" size="xl" className="animate-spin text-muted" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Icon name="error" size="xl" className="text-danger mb-2" />
              <p className="text-muted">{t('common.error')}</p>
            </div>
          ) : data && data.items.length > 0 ? (
            <div className="divide-y divide-border">
              {data.items.map(item => (
                <ItemRow key={`${item.instance_id}:${item.kind}:${item.whmcs_id}`} item={item} type={type} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Icon name="inbox" size="xl" className="text-muted mb-2" />
              <p className="text-muted">{t('dashboard.mrrMovementItems.empty')}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 p-6 border-t border-border shrink-0">
          {data && (
            <div className="text-sm">
              <span className="text-muted">{t('dashboard.mrrMovementItems.total')}: </span>
              <span className={`font-semibold tabular-nums ${type === 'new' ? 'text-success' : 'text-error'}`}>
                {type === 'new' ? '+' : '-'}{formatCurrency(data.total)}
              </span>
              <span className="text-muted ml-2">· {t('dashboard.mrrMovementItems.count', { count: data.count })}</span>
            </div>
          )}
          <Button variant="outline" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </div>
  )
}
