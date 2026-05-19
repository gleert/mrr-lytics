import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { cn } from '@/shared/lib/utils'
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
  hint?: string
  details?: React.ReactNode
  /** When true, a positive change is bad (churn, overdue, etc) and gets red instead of green. */
  lowerIsBetter?: boolean
  /** Prior value to display alongside the change pill, so the comparison is explicit. */
  previousValue?: number
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
  hint,
  details,
  lowerIsBetter = false,
  previousValue,
}: KPICardProps) {
  const { t } = useTranslation()
  const { formatCurrency, formatPercent, formatNumber } = useCurrency()
  const colors = accentColors[accentColor]

  const formattedValue = React.useMemo(() => {
    if (typeof value === 'string') return value
    switch (format) {
      case 'currency':
        return formatCurrency(value)
      case 'percent':
        return formatPercent(value, { decimals: 2 })
      default:
        return formatNumber(value)
    }
  }, [value, format, formatCurrency])

  const trend = React.useMemo(() => {
    if (changePercent === undefined) return null
    if (changePercent > 0) return 'up'
    if (changePercent < 0) return 'down'
    return 'neutral'
  }, [changePercent])

  // For "lower is better" KPIs (churn, overdue) the colour semantic flips:
  // up = bad (red), down = good (green). Icon direction stays factual.
  const isGoodChange = trend === 'up' ? !lowerIsBetter : trend === 'down' ? lowerIsBetter : null

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  const formattedPreviousValue = React.useMemo(() => {
    if (previousValue === undefined) return null
    switch (format) {
      case 'currency':
        return formatCurrency(previousValue)
      case 'percent':
        return formatPercent(previousValue, { decimals: 2 })
      default:
        return formatNumber(previousValue)
    }
  }, [previousValue, format, formatCurrency, formatPercent, formatNumber])

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

        <p
          className="mt-3 sm:mt-4 text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight tabular-nums break-words"
          title={formattedValue}
        >
          {formattedValue}
        </p>

        {changePercent !== undefined && (
          <div className="mt-2 sm:mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
            <div
              className={cn(
                'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                isGoodChange === true && 'bg-success/10 text-success',
                isGoodChange === false && 'bg-error/10 text-error',
                isGoodChange === null && 'bg-muted/10 text-muted'
              )}
            >
              <TrendIcon className="h-3 w-3" />
              {formatPercent(changePercent, { sign: true })}
            </div>
            <span className="text-xs text-muted-foreground">
              {changeLabel || t('common.vsPreviousPeriod')}
              {formattedPreviousValue !== null && (
                <> · {t('common.previousValue', { value: formattedPreviousValue })}</>
              )}
            </span>
          </div>
        )}

        {hint && !changePercent && (
          <p className="mt-2 sm:mt-3 text-xs text-muted">{hint}</p>
        )}

        {details && (
          <div className="mt-2 text-xs text-muted-foreground leading-snug">
            {details}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
