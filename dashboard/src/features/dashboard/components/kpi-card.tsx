import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { cn, formatPercent } from '@/shared/lib/utils'
import { useCurrency } from '@/shared/hooks/use-currency'

interface KPICardProps {
  title: string
  value: number | string
  changePercent?: number
  changeLabel?: string
  format?: 'currency' | 'percent' | 'number'
  loading?: boolean
  icon?: React.ReactNode
  accentColor?: 'primary' | 'success' | 'warning' | 'error' | 'info'
}

const accentColors = {
  primary: {
    bg: 'bg-primary-500/10',
    text: 'text-primary-400',
    glow: 'shadow-primary-500/20',
  },
  success: {
    bg: 'bg-success/10',
    text: 'text-success',
    glow: 'shadow-success/20',
  },
  warning: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    glow: 'shadow-warning/20',
  },
  error: {
    bg: 'bg-error/10',
    text: 'text-error',
    glow: 'shadow-error/20',
  },
  info: {
    bg: 'bg-info/10',
    text: 'text-info',
    glow: 'shadow-info/20',
  },
}

export function KPICard({
  title,
  value,
  changePercent,
  changeLabel,
  format = 'number',
  loading = false,
  icon,
  accentColor = 'primary',
}: KPICardProps) {
  const { t } = useTranslation()
  const { formatCurrency } = useCurrency()
  const colors = accentColors[accentColor]

  const formattedValue = React.useMemo(() => {
    if (typeof value === 'string') return value
    switch (format) {
      case 'currency':
        return formatCurrency(value)
      case 'percent':
        return `${value.toFixed(2)}%`
      default:
        return value.toLocaleString()
    }
  }, [value, format, formatCurrency])

  const trend = React.useMemo(() => {
    if (changePercent === undefined) return null
    if (changePercent > 0) return 'up'
    if (changePercent < 0) return 'down'
    return 'neutral'
  }, [changePercent])

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl" />
          </div>
          <Skeleton className="mt-3 sm:mt-4 h-7 sm:h-9 w-32" />
          <Skeleton className="mt-2 sm:mt-3 h-4 w-24" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted">{title}</p>
          {icon && (
            <div className={cn(
              'flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl',
              colors.bg,
              colors.text
            )}>
              {icon}
            </div>
          )}
        </div>

        <p className="mt-3 sm:mt-4 text-2xl sm:text-3xl font-semibold tracking-tight truncate">{formattedValue}</p>

        {changePercent !== undefined && (
          <div className="mt-2 sm:mt-3 flex items-center gap-2">
            <div
              className={cn(
                'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                trend === 'up' && 'bg-success/10 text-success',
                trend === 'down' && 'bg-error/10 text-error',
                trend === 'neutral' && 'bg-muted/10 text-muted'
              )}
            >
              <TrendIcon className="h-3 w-3" />
              {formatPercent(changePercent)}
            </div>
            <span className="text-xs text-muted-foreground">{changeLabel || t('common.vsPreviousPeriod')}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
