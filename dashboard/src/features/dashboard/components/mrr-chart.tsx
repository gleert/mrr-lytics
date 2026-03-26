import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useCurrency } from '@/shared/hooks/use-currency'
import { ChartTooltip } from '@/shared/components/chart-tooltip'

interface MRRChartProps {
  data: Array<{ date: string; mrr: number }>
  loading?: boolean
}

export function MRRChart({ data, loading }: MRRChartProps) {
  const { formatCurrency } = useCurrency()
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    )
  }

  const formattedData = data.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium">MRR Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={formattedData}
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                stroke="var(--color-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--color-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCurrency(value)}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    valueFormatter={(v) => formatCurrency(v)}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="mrr"
                stroke="var(--color-primary-600)"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 6,
                  fill: 'var(--color-primary-600)',
                  stroke: 'var(--color-background)',
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
