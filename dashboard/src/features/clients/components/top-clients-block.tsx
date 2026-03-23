import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
import { TableSkeleton } from '@/shared/components/ui/chart-skeleton'
import { useTopClients } from '../hooks/use-client-stats'
import { useCurrency } from '@/shared/hooks/use-currency'

export function TopClientsBlock() {
  const { t } = useTranslation()
  const { data, isLoading } = useTopClients(4)
  const { formatCurrency } = useCurrency()

  if (isLoading) {
    return (
      <div className="rounded-xl overflow-hidden bg-surface border border-border p-6">
        <TableSkeleton rows={4} />
      </div>
    )
  }

  const clients = data?.clients || []
  const totalRevenue = data?.total_revenue || 0

  if (clients.length === 0) {
    return (
      <div className="rounded-xl overflow-hidden p-8 bg-surface border border-border">
        <div className="flex flex-col items-center justify-center h-32 text-muted">
          <Icon name="people" size="xl" className="mb-2 opacity-50" />
          <p>{t('clients.topClients.noData')}</p>
        </div>
      </div>
    )
  }

  const maxRevenue = clients[0]?.revenue_in_period || 1

  return (
    <div className="rounded-xl overflow-hidden p-8 bg-gradient-to-br from-violet-600 to-violet-700">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left — headline */}
        <div className="lg:w-2/5 flex flex-col justify-center">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white/70">
              <Icon name="emoji_events" size="lg" />
              <span className="text-sm font-medium uppercase tracking-wider">
                {t('clients.topClients.title')}
              </span>
            </div>
            <p className="text-3xl sm:text-4xl font-black text-white leading-tight">
              {clients[0]?.name || '—'}
            </p>
            <p className="text-lg font-light text-white/80">
              {formatCurrency(totalRevenue, { maximumFractionDigits: 0 })} {t('clients.topClients.subtitle')}
            </p>
          </div>
        </div>

        {/* Right — client cards */}
        <div className="lg:w-3/5 flex items-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            {clients.map((client, index) => {
              const barWidth = Math.round((client.revenue_in_period / maxRevenue) * 100)
              return (
                <div
                  key={client.client_id}
                  className="flex flex-col gap-2 px-4 py-3 rounded-xl bg-white/90 text-violet-900 transition-all hover:scale-[1.02] hover:shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold shrink-0">
                        {index + 1}
                      </span>
                      <span
                        className="text-sm font-semibold truncate max-w-[120px]"
                        title={client.name}
                      >
                        {client.name}
                      </span>
                    </div>
                    <span className="font-bold text-violet-700 tabular-nums shrink-0">
                      {formatCurrency(client.revenue_in_period, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  {/* Revenue bar */}
                  <div className="h-1 bg-violet-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-400 rounded-full transition-all duration-500"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  {/* MRR sub-line */}
                  {client.current_mrr > 0 && (
                    <p className="text-xs text-violet-500">
                      {t('clients.topClients.mrr')}: {formatCurrency(client.current_mrr, { maximumFractionDigits: 0 })}/mo
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
