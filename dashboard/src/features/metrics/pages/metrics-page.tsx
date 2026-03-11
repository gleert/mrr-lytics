import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { RevenueChart } from '../components/revenue-chart'
import { ChurnChart } from '../components/churn-chart'
import { DateRangePicker, type DateRange } from '../components/date-range-picker'
import { useMetrics, useMetricsHistory } from '@/features/dashboard/hooks/use-metrics'
import { formatCurrency } from '@/shared/lib/utils'

export function MetricsPage() {
  const { t } = useTranslation()
  const { data: metrics, isLoading, error } = useMetrics()
  const { data: history, isLoading: historyLoading } = useMetricsHistory(90) // 90 days for metrics page
  const [dateRange, setDateRange] = React.useState<DateRange>('last_3_months')

  // Transform history data for Churn chart
  const churnChartData = (history?.data ?? [])
    .map((point) => ({
      date: point.snapshot_date,
      rate: point.churn_rate,
      churned: point.churned_services,
    }))
    .reverse() // Show oldest to newest

  const handleExportCSV = () => {
    if (!metrics) return

    // Create CSV content from revenue by product
    const headers = ['Product', 'Active Count', 'MRR', 'Percentage']
    const rows = metrics.revenue_by_product.map((item) => [
      item.product_name,
      item.active_count.toString(),
      item.mrr.toString(),
      item.percentage.toFixed(2) + '%',
    ])

    const csvContent = [headers, ...rows]
      .map((row) => row.join(','))
      .join('\n')

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mrrlytics-metrics-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-error">Error loading metrics: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('metrics.title')}</h1>
          <p className="text-muted">Detailed analytics and trends</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button variant="outline" className="gap-2" onClick={handleExportCSV} disabled={!metrics}>
            <Download className="h-4 w-4" />
            {t('metrics.exportCsv')}
          </Button>
        </div>
      </div>

      {/* MRR Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))
        ) : (
          <>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted">Current MRR</p>
                <p className="mt-1 text-2xl font-semibold text-success">
                  {formatCurrency(metrics?.mrr.mrr ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted">ARR</p>
                <p className="mt-1 text-2xl font-semibold text-info">
                  {formatCurrency(metrics?.mrr.arr ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted">Active Services</p>
                <p className="mt-1 text-2xl font-semibold">
                  {metrics?.mrr.active_services ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted">Churn Rate (30d)</p>
                <p className="mt-1 text-2xl font-semibold text-warning">
                  {(metrics?.churn.churn_rate ?? 0).toFixed(2)}%
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Churn Rate Trend */}
      <ChurnChart data={churnChartData} loading={historyLoading} />

      {/* Revenue by Product */}
      <RevenueChart
        data={metrics?.revenue_by_product ?? []}
        loading={isLoading}
      />

      {/* MRR by Billing Cycle */}
      <Card>
        <CardHeader>
          <CardTitle>MRR by Billing Cycle</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : metrics?.mrr.mrr_by_cycle && metrics.mrr.mrr_by_cycle.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.mrr.mrr_by_cycle.map((item) => (
                <div
                  key={item.cycle}
                  className="rounded-lg border border-border p-4"
                >
                  <p className="text-sm font-medium text-muted">
                    {item.cycle}
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {formatCurrency(item.mrr)}
                  </p>
                  <p className="text-xs text-muted">
                    {item.count} services
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">No billing cycle data available</p>
          )}
        </CardContent>
      </Card>

      {/* Client & Invoice Summary */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Client Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-success/10 p-4">
                  <p className="text-sm font-medium text-success">Active</p>
                  <p className="mt-1 text-2xl font-semibold">{metrics?.clients.active ?? 0}</p>
                </div>
                <div className="rounded-lg bg-warning/10 p-4">
                  <p className="text-sm font-medium text-warning">Inactive</p>
                  <p className="mt-1 text-2xl font-semibold">{metrics?.clients.inactive ?? 0}</p>
                </div>
                <div className="rounded-lg bg-error/10 p-4">
                  <p className="text-sm font-medium text-error">Closed</p>
                  <p className="mt-1 text-2xl font-semibold">{metrics?.clients.closed ?? 0}</p>
                </div>
                <div className="rounded-lg bg-muted/10 p-4">
                  <p className="text-sm font-medium text-muted">Total</p>
                  <p className="mt-1 text-2xl font-semibold">{metrics?.clients.total ?? 0}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted">Paid Invoices</span>
                  <span className="font-semibold">{metrics?.invoices.paid_count ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Unpaid Invoices</span>
                  <span className="font-semibold text-warning">{metrics?.invoices.unpaid_count ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Total Paid</span>
                  <span className="font-semibold text-success">{formatCurrency(metrics?.invoices.total_paid ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Total Unpaid</span>
                  <span className="font-semibold text-error">{formatCurrency(metrics?.invoices.total_unpaid ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-muted">Revenue (Last 30 days)</span>
                  <span className="font-semibold">{formatCurrency(metrics?.invoices.revenue_last_30_days ?? 0)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
