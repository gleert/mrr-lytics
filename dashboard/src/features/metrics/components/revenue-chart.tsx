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
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { ChartTooltip } from '@/shared/components/chart-tooltip'
import { formatCurrency } from '@/shared/lib/utils'

interface RevenueChartProps {
  data: Array<{ product_name: string; mrr: number; active_count: number; percentage: number }>
  loading?: boolean
}

const COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

export function RevenueChart({ data, loading }: RevenueChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    )
  }

  // Sort by MRR and take top 5
  const chartData = [...data]
    .sort((a, b) => b.mrr - a.mrr)
    .slice(0, 5)
    .map((item) => ({
      ...item,
      name: item.product_name.length > 20
        ? item.product_name.substring(0, 20) + '...'
        : item.product_name,
    }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium">Revenue by Product</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                horizontal={true}
                vertical={false}
              />
              <XAxis
                type="number"
                stroke="var(--color-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCurrency(value)}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="var(--color-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormatter={(label) => chartData.find(d => d.name === label)?.product_name || label}
                    valueFormatter={(v) => formatCurrency(v)}
                  />
                }
              />
              <Bar dataKey="mrr" radius={[0, 4, 4, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
