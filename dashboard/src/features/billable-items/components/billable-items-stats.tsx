import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
import { KPICard } from '@/features/dashboard/components/kpi-card'
import type { BillableItem } from '../hooks/use-billable-items'

interface BillableItemsStatsProps {
  items: BillableItem[]
  totalMrr: number
  isLoading: boolean
}

export function BillableItemsStats({ items, totalMrr, isLoading }: BillableItemsStatsProps) {
  const { t } = useTranslation()

  const stats = useMemo(() => {
    const activeItems = items.filter(i => i.status !== 'one_time')
    const totalItems = activeItems.length
    const categorizedPct =
      totalItems > 0
        ? Math.round((activeItems.filter(i => i.category !== null).length / totalItems) * 1000) / 10
        : 0
    const avgAmount =
      totalItems > 0
        ? activeItems.reduce((sum, i) => sum + i.amount, 0) / totalItems
        : 0

    return { totalItems, categorizedPct, avgAmount }
  }, [items])

  return (
    <div data-tour="billable-items-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        title={t('billableItems.stats.totalItems')}
        value={stats.totalItems}
        format="number"
        loading={isLoading}
        icon={<Icon name="receipt_long" size="2xl" />}
        accentColor="primary"
      />
      <KPICard
        title={t('billableItems.stats.totalMrr')}
        value={totalMrr}
        format="currency"
        loading={isLoading}
        icon={<Icon name="trending_up" size="2xl" />}
        accentColor="success"
      />
      <KPICard
        title={t('billableItems.stats.categorized')}
        value={stats.categorizedPct}
        format="percent"
        loading={isLoading}
        icon={<Icon name="label" size="2xl" />}
        accentColor="info"
      />
      <KPICard
        title={t('billableItems.stats.avgAmount')}
        value={stats.avgAmount}
        format="currency"
        loading={isLoading}
        icon={<Icon name="payments" size="2xl" />}
        accentColor="warning"
      />
    </div>
  )
}
