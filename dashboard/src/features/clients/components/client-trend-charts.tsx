import { useTranslation } from 'react-i18next'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Icon } from '@/shared/components/ui/icon'
import type { ClientStats } from '@/shared/types'

interface ClientTrendChartsProps {
  stats: ClientStats
  isLoading: boolean
}

const formatBucketDate = (
  value: string,
  bucketType: ClientStats['bucket_type']
): string => {
  if (bucketType === 'monthly') {
    const [year, month] = value.split('-')
    return `${month}/${year.slice(2)}`
  }
  const d = new Date(value)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

export function ClientTrendCharts({ stats, isLoading }: ClientTrendChartsProps) {
  const { t } = useTranslation()

  const sharedChartProps = {
    margin: { top: 10, right: 16, left: 0, bottom: 8 },
  }

  const sharedXAxisProps = {
    tick: { fill: 'var(--color-muted)', fontSize: 11 },
    tickLine: false,
    axisLine: { stroke: 'var(--color-border)' },
  }

  const sharedYAxisProps = {
    tick: { fill: 'var(--color-muted)', fontSize: 11 },
    tickLine: false,
    axisLine: false,
    allowDecimals: false,
    width: 28,
  }

  const sharedTooltipProps = {
    contentStyle: {
      backgroundColor: 'var(--color-background)',
      border: '1px solid var(--color-border)',
      borderRadius: '8px',
      fontSize: 12,
    },
    labelStyle: { color: 'var(--color-foreground)' },
    cursor: { fill: 'var(--color-border)', opacity: 0.3 },
  }

  const renderChart = (
    data: ClientStats['new_clients_trend'],
    color: string,
    tooltipLabel: string,
  ) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-44">
          <Icon name="sync" size="xl" className="animate-spin text-muted" />
        </div>
      )
    }

    if (!data || data.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-44 text-muted">
          <Icon name="bar_chart" size="xl" className="mb-2 opacity-40" />
          <p className="text-sm">{t('forecasting.noData')}</p>
        </div>
      )
    }

    return (
      <div style={{ height: 176 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} {...sharedChartProps}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => formatBucketDate(v, stats.bucket_type)}
              {...sharedXAxisProps}
            />
            <YAxis {...sharedYAxisProps} />
            <Tooltip
              {...sharedTooltipProps}
              formatter={(value) => [Number(value) || 0, tooltipLabel]}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* New Clients */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Icon name="person_add" size="lg" className="text-success" />
          <div>
            <h3 className="text-base font-medium">{t('clients.newClientsTrendTitle')}</h3>
            <p className="text-xs text-muted">{t('clients.newClientsTrendDesc')}</p>
          </div>
          <span className="ml-auto text-2xl font-semibold tabular-nums text-success">
            {stats.new_clients}
          </span>
        </div>
        <div className="p-4">
          {renderChart(
            stats.new_clients_trend,
            '#10B981',
            t('clients.newClients'),
          )}
        </div>
      </div>

      {/* Churned Clients */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Icon name="person_remove" size="lg" className="text-error" />
          <div>
            <h3 className="text-base font-medium">{t('clients.churnedClientsTrendTitle')}</h3>
            <p className="text-xs text-muted">{t('clients.churnedClientsTrendDesc')}</p>
          </div>
          <span className="ml-auto text-2xl font-semibold tabular-nums text-error">
            {stats.churned_clients}
          </span>
        </div>
        <div className="p-4">
          {renderChart(
            stats.churned_clients_trend,
            'var(--color-error)',
            t('clients.churnedClients'),
          )}
        </div>
        {stats.churned_clients_trend && stats.churned_clients_trend.length > 0 && (
          <div className="px-4 pb-3">
            <p className="text-xs text-muted">{t('clients.churnedClientsTrendNote')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
