import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'

interface TourPopoverProps {
  title: string
  description: string
  currentStep: number
  totalSteps: number
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  style: React.CSSProperties
}

export function TourPopover({
  title,
  description,
  currentStep,
  totalSteps,
  onNext,
  onBack,
  onSkip,
  style,
}: TourPopoverProps) {
  const { t } = useTranslation()
  const isFirst = currentStep === 0
  const isLast = currentStep === totalSteps - 1

  return (
    <div
      className="fixed z-[67] w-[320px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      style={style}
    >
      {/* Progress dots */}
      <div className="flex items-center gap-1.5 mb-3">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === currentStep
                ? 'w-4 bg-primary'
                : i < currentStep
                ? 'w-1.5 bg-primary/40'
                : 'w-1.5 bg-border'
            }`}
          />
        ))}
        <span className="ml-auto text-xs text-muted">
          {t('onboarding.progress', { current: currentStep + 1, total: totalSteps })}
        </span>
      </div>

      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted leading-relaxed mb-4">{description}</p>

      <div className="flex items-center justify-between">
        <button
          onClick={onSkip}
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          {t('onboarding.skipTour')}
        </button>

        <div className="flex items-center gap-2">
          {!isFirst && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              {t('onboarding.back')}
            </Button>
          )}
          <Button size="sm" onClick={onNext}>
            {isLast ? t('onboarding.finish') : t('onboarding.next')}
          </Button>
        </div>
      </div>
    </div>
  )
}
