import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils'

interface BillingIntervalToggleProps {
  value: 'month' | 'year'
  onChange: (value: 'month' | 'year') => void
}

export function BillingIntervalToggle({ value, onChange }: BillingIntervalToggleProps) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => onChange('month')}
        className={cn(
          'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
          value === 'month' 
            ? 'bg-primary-500 text-white' 
            : 'text-muted hover:text-foreground'
        )}
      >
        {t('billing.monthly', 'Monthly')}
      </button>

      <button
        type="button"
        onClick={() => onChange('year')}
        className={cn(
          'px-4 py-2 text-sm font-medium rounded-lg transition-colors relative',
          value === 'year' 
            ? 'bg-primary-500 text-white' 
            : 'text-muted hover:text-foreground'
        )}
      >
        {t('billing.yearly', 'Yearly')}
        <span className="absolute -top-2 -right-2 bg-success text-white text-xs px-1.5 py-0.5 rounded-full">
          -20%
        </span>
      </button>
    </div>
  )
}
