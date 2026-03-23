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
} from 'recharts'
import { Icon } from '@/shared/components/ui/icon'
import { KPICard } from '@/features/dashboard/components/kpi-card'
import { useTopProducts, useMRRBreakdown } from '@/features/dashboard/hooks/use-metrics'
import { useCurrency } from '@/shared/hooks/use-currency'
import { ChartTooltip } from '@/shared/components/chart-tooltip'
import { ChartSkeleton } from '@/shared/components/ui/chart-skeleton'
import type { Product, ProductGroup } from '../hooks/use-products'

const COLORS = [
  '#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#EC4899', '#06B6D4', '#8B5CF6', '#F97316', '#14B8A6',
]

interface ProductStatsProps {
  products: Product[]
  productGroups: ProductGroup[]
  isLoading: boolean
}

export function ProductStats({ products, productGroups, isLoading: productsLoading }: ProductStatsProps) {
  const { t } = useTranslation()
  const { formatCurrency, symbol } = useCurrency()
  const { data: topProducts, isLoading: topLoading } = useTopProducts(10)
  const { data: mrrBreakdown, isLoading: breakdownLoading } = useMRRBreakdown()

  // Calculate stats from products data
  const stats = useMemo(() => {
    const totalProducts = products.length
    const totalGroups = productGroups.length
    const categorized = products.filter(p => p.category || p.inherited_category).length
    const categorizedPct = totalProducts > 0 ? Math.round((categorized / totalProducts) * 100) : 0

    // Distribution by paytype
    const payTypeMap = new Map<string, number>()
    products.forEach(p => {
      const type = p.paytype || 'unknown'
      payTypeMap.set(type, (payTypeMap.get(type) || 0) + 1)
    })
    const payTypeDistribution = Array.from(payTypeMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // Distribution by product type
    const productTypeMap = new Map<string, number>()
    products.forEach(p => {
      const type = p.type || 'unknown'
      productTypeMap.set(type, (productTypeMap.get(type) || 0) + 1)
    })
    const typeDistribution = Array.from(productTypeMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    return { totalProducts, totalGroups, categorized, categorizedPct, payTypeDistribution, typeDistribution }
  }, [products, productGroups])

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KPICard
          title={t('products.stats.totalProducts')}
          value={stats.totalProducts}
          loading={productsLoading}
          icon={<Icon name="inventory_2" size="2xl" />}
          accentColor="primary"
        />
        <KPICard
          title={t('products.stats.totalGroups')}
          value={stats.totalGroups}
          loading={productsLoading}
          icon={<Icon name="folder" size="2xl" />}
          accentColor="info"
        />
        <KPICard
          title={t('products.stats.categorized')}
          value={stats.categorizedPct}
          format="percent"
          loading={productsLoading}
          icon={<Icon name="label" size="2xl" />}
          accentColor={stats.categorizedPct >= 80 ? 'success' : stats.categorizedPct >= 50 ? 'warning' : 'error'}
        />
        <KPICard
          title={t('products.stats.totalMrr')}
          value={topProducts?.total_mrr ?? 0}
          format="currency"
          loading={topLoading}
          icon={<Icon name="paid" size="2xl" />}
          accentColor="success"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Products by MRR */}
        <div className="rounded-xl border border-border bg-surface">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <Icon name="leaderboard" size="lg" className="text-primary-400" />
            <div>
              <h3 className="text-base font-medium">{t('products.stats.topByMrr')}</h3>
              <p className="text-xs text-muted">{t('products.stats.topByMrrDesc')}</p>
            </div>
          </div>
          <div className="p-4">
            {topLoading ? (
              <ChartSkeleton height={220} />
            ) : !topProducts?.products?.length ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted gap-1">
                <Icon name="bar_chart" size="xl" className="mb-1 opacity-50" />
                <p className="text-sm font-medium">{t('products.stats.noData')}</p>
              </div>
            ) : (
              <div className="h-[220px] sm:h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topProducts.products.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--color-border)' }}
                      tickFormatter={(v) => `${symbol}${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--color-border)' }}
                      width={90}
                      tickFormatter={(v) => v.length > 12 ? v.slice(0, 12) + '…' : v}
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--color-border)', opacity: 0.3 }}
                      content={
                        <ChartTooltip
                          valueFormatter={(v, key) =>
                            key === 'mrr' ? formatCurrency(v) :
                            key === 'active_services' ? `${v} services` : String(v)
                          }
                        />
                      }
                    />
                    <Bar dataKey="mrr" radius={[0, 4, 4, 0]}>
                      {topProducts.products.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          {/* Top product pills with service count */}
          {topProducts?.products && topProducts.products.length > 0 && (
            <div className="px-4 pb-4">
              <div className="flex flex-wrap gap-2">
                {topProducts.products.slice(0, 5).map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-elevated text-xs">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="font-medium truncate max-w-[100px]">{p.name}</span>
                    <span className="text-muted">{p.active_services} srv</span>
                    <span className="text-muted">·</span>
                    <span className="font-medium">{p.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* MRR by Category/Group */}
        <div className="rounded-xl border border-border bg-surface">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <Icon name="donut_large" size="lg" className="text-primary-400" />
            <div>
              <h3 className="text-base font-medium">{t('products.stats.mrrByCategory')}</h3>
              <p className="text-xs text-muted">{t('products.stats.mrrByCategoryDesc')}</p>
            </div>
          </div>
          <div className="p-4">
            {breakdownLoading ? (
              <ChartSkeleton height={220} />
            ) : !mrrBreakdown?.breakdown?.length ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted gap-1">
                <Icon name="donut_large" size="xl" className="mb-1 opacity-50" />
                <p className="text-sm font-medium">{t('products.stats.noData')}</p>
              </div>
            ) : (
              <div className="h-[220px] sm:h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={mrrBreakdown.breakdown.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--color-border)' }}
                      tickFormatter={(v) => `${symbol}${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--color-border)' }}
                      width={90}
                      tickFormatter={(v) => v.length > 12 ? v.slice(0, 12) + '…' : v}
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--color-border)', opacity: 0.3 }}
                      content={
                        <ChartTooltip
                          valueFormatter={(v, key) =>
                            key === 'mrr' ? formatCurrency(v) : String(v)
                          }
                        />
                      }
                    />
                    <Bar dataKey="mrr" radius={[0, 4, 4, 0]}>
                      {mrrBreakdown.breakdown.slice(0, 8).map((item, i) => (
                        <Cell key={i} fill={item.color || COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          {/* Categorization status */}
          {mrrBreakdown && (
            <div className="px-4 pb-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-elevated text-xs">
                <Icon name="info" size="sm" className="text-muted shrink-0" />
                <span className="text-muted">
                  {mrrBreakdown.using_categories
                    ? t('products.stats.categoriesActive', { pct: (100 - mrrBreakdown.uncategorized_mrr_pct).toFixed(0) })
                    : t('products.stats.categoriesInactive')}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Distribution cards */}
      {!productsLoading && (stats.payTypeDistribution.length > 0 || stats.typeDistribution.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* By Pay Type */}
          {stats.payTypeDistribution.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <h3 className="text-sm font-medium mb-3">{t('products.stats.byPayType')}</h3>
              <div className="space-y-2">
                {stats.payTypeDistribution.map((item, i) => {
                  const pct = stats.totalProducts > 0 ? (item.count / stats.totalProducts) * 100 : 0
                  return (
                    <div key={item.name} className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm flex-1 capitalize">{item.name}</span>
                      <span className="text-sm font-medium">{item.count}</span>
                      <div className="w-16 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                      </div>
                      <span className="text-xs text-muted w-10 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* By Product Type */}
          {stats.typeDistribution.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <h3 className="text-sm font-medium mb-3">{t('products.stats.byType')}</h3>
              <div className="space-y-2">
                {stats.typeDistribution.map((item, i) => {
                  const pct = stats.totalProducts > 0 ? (item.count / stats.totalProducts) * 100 : 0
                  return (
                    <div key={item.name} className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[(i + 3) % COLORS.length] }} />
                      <span className="text-sm flex-1 capitalize">{item.name}</span>
                      <span className="text-sm font-medium">{item.count}</span>
                      <div className="w-16 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[(i + 3) % COLORS.length] }} />
                      </div>
                      <span className="text-xs text-muted w-10 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
