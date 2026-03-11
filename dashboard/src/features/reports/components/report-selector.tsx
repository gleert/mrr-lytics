import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
import { cn } from '@/shared/lib/utils'
import type { ReportType } from '../hooks/use-report-export'

interface ReportDefinition {
  type: ReportType
  icon: string
  cardBg: string
  cardBorder: string
  iconBg: string
  badgeBg: string
  badgeText: string
}

const REPORTS: ReportDefinition[] = [
  { type: 'mrr',      icon: 'trending_up',   cardBg: 'bg-primary-600',  cardBorder: 'border-primary-400',  iconBg: 'bg-primary-700',  badgeBg: 'bg-primary-500/40',  badgeText: 'text-white' },
  { type: 'revenue',  icon: 'paid',       cardBg: 'bg-primary-600',  cardBorder: 'border-primary-400',  iconBg: 'bg-primary-700',  badgeBg: 'bg-primary-500/40',  badgeText: 'text-white' },
  { type: 'clients',  icon: 'group',          cardBg: 'bg-primary-600',  cardBorder: 'border-primary-400',  iconBg: 'bg-primary-700',  badgeBg: 'bg-primary-500/40',  badgeText: 'text-white' },
  { type: 'domains',  icon: 'language',       cardBg: 'bg-primary-600',  cardBorder: 'border-primary-400',  iconBg: 'bg-primary-700',  badgeBg: 'bg-primary-500/40',  badgeText: 'text-white' },
  { type: 'churn',    icon: 'trending_down',  cardBg: 'bg-primary-600',  cardBorder: 'border-primary-400',  iconBg: 'bg-primary-700',  badgeBg: 'bg-primary-500/40',  badgeText: 'text-white' },
  { type: 'products', icon: 'inventory_2',    cardBg: 'bg-primary-600',  cardBorder: 'border-primary-400',  iconBg: 'bg-primary-700',  badgeBg: 'bg-primary-500/40',  badgeText: 'text-white' },
]

interface ReportSelectorProps {
  selected: ReportType | null
  onSelect: (type: ReportType) => void
  /** Total rows for the currently selected report — shown as a badge */
  selectedTotalRows?: number | null
  /** Whether the selected report is still loading */
  selectedIsLoading?: boolean
}

export function ReportSelector({ selected, onSelect, selectedTotalRows, selectedIsLoading }: ReportSelectorProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-medium text-foreground">{t('reports.selectReport')}</h2>
        <p className="text-sm text-muted">{t('reports.selectReportDesc')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {REPORTS.map(({ type, icon, cardBg, cardBorder, iconBg, badgeBg, badgeText }) => {
          const isSelected = selected === type
          const showBadge = isSelected && (selectedIsLoading || (selectedTotalRows != null && selectedTotalRows > 0))

          return (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className={cn(
                'group relative flex items-start gap-4 p-4 rounded-xl border text-left transition-all duration-200',
                cardBg,
                isSelected
                  ? cn(cardBorder, 'ring-2 ring-white/10 shadow-md')
                  : cn('border-transparent hover:border-white/10 hover:brightness-110')
              )}
            >
              {/* Icon */}
              <div className={cn('flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0', iconBg)}>
                <Icon name={icon} size="lg" className="text-white" />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold leading-tight text-white">
                    {t(`reports.reportTypes.${type}`)}
                  </p>

                  {/* Row count badge */}
                  {showBadge && (
                    selectedIsLoading ? (
                      <span className="inline-flex items-center h-4 w-10 rounded-full bg-white/10 animate-pulse" />
                    ) : (
                      <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums', badgeBg, badgeText)}>
                        {selectedTotalRows?.toLocaleString()}
                      </span>
                    )
                  )}
                </div>
                <p className="text-xs text-white/65 mt-1 leading-relaxed">
                  {t(`reports.reportTypes.${type}Desc`)}
                </p>
              </div>

              {/* Selected checkmark */}
              {isSelected && (
                <div className="absolute top-3 right-3 flex items-center justify-center w-5 h-5 rounded-full bg-black/40 backdrop-blur-sm">
                  <Icon name="check" size="sm" className="text-white" />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
