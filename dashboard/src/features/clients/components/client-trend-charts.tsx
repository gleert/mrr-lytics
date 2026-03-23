import { useMemo } from 'react'
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
  ComposedChart,
  Line,
  Legend,
  ReferenceLine,
} from 'recharts'
import { Icon } from '@/shared/components/ui/icon'
import { ChartSkeleton } from '@/shared/components/ui/chart-skeleton'
import type { ClientStats } from '@/shared/types'
import { ChartTooltip } from '@/shared/components/chart-tooltip'

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
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
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

  const sharedTooltipCursor = { fill: 'var(--color-border)', opacity: 0.3 }

  // Build combined net trend data
  const netTrendData = useMemo(() => {
    const dateMap = new Map<string, { date: string; new_clients: number; churned: number; net: number }>()

    stats.new_clients_trend?.forEach(p => {
      const entry = dateMap.get(p.date) || { date: p.date, new_clients: 0, churned: 0, net: 0 }
      entry.new_clients += p.count
      entry.net += p.count
      dateMap.set(p.date, entry)
    })

    stats.churned_clients_trend?.forEach(p => {
      const entry = dateMap.get(p.date) || { date: p.date, new_clients: 0, churned: 0, net: 0 }
      entry.churned += p.count
      entry.net -= p.count
      dateMap.set(p.date, entry)
    })

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [stats.new_clients_trend, stats.churned_clients_trend])

  const renderChart = (
    data: ClientStats['new_clients_trend'],
    color: string,
  ) => {
    if (isLoading) {
      return <ChartSkeleton height={160} />
    }

    if (!data || data.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-44 text-muted gap-1">
          <Icon name="bar_chart" size="xl" className="mb-1 opacity-40" />
          <p className="text-sm font-medium">{t('clients.noTrendData')}</p>
          <p className="text-xs">{t('clients.noTrendDataHint')}</p>
        </div>
      )
    }

    return (
      <div className="h-[140px] sm:h-[160px] lg:h-[176px]">
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
              cursor={sharedTooltipCursor}
              content={<ChartTooltip />}
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
    <div className="space-y-4">
      {/* New vs Churned side by side */}
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
            {renderChart(stats.new_clients_trend, '#10B981')}
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
            {renderChart(stats.churned_clients_trend, 'var(--color-error)')}
          </div>
          {stats.churned_clients_trend && stats.churned_clients_trend.length > 0 && (
            <div className="px-4 pb-3">
              <p className="text-xs text-muted">{t('clients.churnedClientsTrendNote')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Net Growth Trend — combined chart */}
      {netTrendData.length > 1 && (
        <div className="rounded-xl border border-border bg-surface">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <Icon name="swap_vert" size="lg" className="text-primary-400" />
            <div>
              <h3 className="text-base font-medium">{t('clients.netTrendTitle')}</h3>
              <p className="text-xs text-muted">{t('clients.netTrendDesc')}</p>
            </div>
            <span className={`ml-auto text-2xl font-semibold tabular-nums ${
              stats.net_growth > 0 ? 'text-emerald-400' : stats.net_growth < 0 ? 'text-red-400' : 'text-foreground'
            }`}>
              {stats.net_growth > 0 ? '+' : ''}{stats.net_growth}
            </span>
          </div>
          <div className="p-4">
            {isLoading ? (
              <ChartSkeleton height={200} />
            ) : (
              <div className="h-[180px] sm:h-[200px] lg:h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={netTrendData} {...sharedChartProps}>
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
                    <YAxis {...sharedYAxisProps} width={32} />
                    <Tooltip
                      cursor={sharedTooltipCursor}
                      content={<ChartTooltip />}
                    />
                    <Legend
                      formatter={(value) => (
                        <span className="text-xs">
                          {value === 'new_clients' ? t('clients.newClients') :
                           value === 'churned' ? t('clients.churnedClients') :
                           t('clients.netGrowth')}
                        </span>
                      )}
                    />
                    <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="3 3" />
                    <Bar dataKey="new_clients" fill="#10B981" radius={[4, 4, 0, 0]} opacity={0.8} />
                    <Bar dataKey="churned" fill="var(--color-error)" radius={[4, 4, 0, 0]} opacity={0.8} />
                    <Line
                      type="monotone"
                      dataKey="net"
                      stroke="#7C3AED"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#7C3AED' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
