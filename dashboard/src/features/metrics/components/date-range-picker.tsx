import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, ChevronDown } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

export type DateRange = 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'last_year'

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

const ranges: { value: DateRange; labelKey: string }[] = [
  { value: 'this_month', labelKey: 'metrics.thisMonth' },
  { value: 'last_month', labelKey: 'metrics.lastMonth' },
  { value: 'last_3_months', labelKey: 'metrics.last3Months' },
  { value: 'last_6_months', labelKey: 'metrics.last6Months' },
  { value: 'last_year', labelKey: 'metrics.lastYear' },
]

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedRange = ranges.find((r) => r.value === value)

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        className="gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Calendar className="h-4 w-4" />
        {selectedRange ? t(selectedRange.labelKey) : 'Select range'}
        <ChevronDown className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div className="glass absolute right-0 top-full z-50 mt-2 w-48 rounded-xl p-1.5 shadow-lg animate-fade-in">
          {ranges.map((range) => (
            <button
              key={range.value}
              className={cn(
                'flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-light transition-colors',
                'hover:bg-surface-hover',
                value === range.value && 'bg-primary-500/15 text-primary-400'
              )}
              onClick={() => {
                onChange(range.value)
                setIsOpen(false)
              }}
            >
              {t(range.labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
