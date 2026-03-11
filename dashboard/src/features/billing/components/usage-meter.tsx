import { cn } from '@/shared/lib/utils'
import { formatLimit, getUsagePercent, isLimitExceeded } from '../hooks/use-subscription'

interface UsageMeterProps {
  label: string
  current: number
  limit: number
  className?: string
}

export function UsageMeter({ label, current, limit, className }: UsageMeterProps) {
  const percent = getUsagePercent(current, limit)
  const exceeded = isLimitExceeded(current, limit)
  const isUnlimited = limit === -1

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className={cn(
          'font-medium',
          exceeded ? 'text-danger' : 'text-foreground'
        )}>
          {current} / {formatLimit(limit)}
        </span>
      </div>
      
      {!isUnlimited && (
        <div className="h-2 bg-muted/20 rounded-full overflow-hidden">
          <div 
            className={cn(
              'h-full rounded-full transition-all',
              percent >= 100 ? 'bg-danger' :
              percent >= 80 ? 'bg-warning' :
              'bg-primary-500'
            )}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
      )}

      {isUnlimited && (
        <div className="h-2 bg-success/20 rounded-full">
          <div className="h-full bg-success/40 rounded-full w-full" />
        </div>
      )}
    </div>
  )
}
