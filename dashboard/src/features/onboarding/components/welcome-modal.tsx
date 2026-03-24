import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'

interface WelcomeModalProps {
  onStart: () => void
  onSkip: () => void
}

export function WelcomeModal({ onStart, onSkip }: WelcomeModalProps) {
  const { t } = useTranslation()

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[65] bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" />

      {/* Modal */}
      <div className="fixed inset-0 z-[67] flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-300 text-center">
          {/* Icon */}
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Icon name="waving_hand" size="2xl" className="text-primary" />
          </div>

          <h2 className="text-xl font-semibold text-foreground mb-2">
            {t('onboarding.welcome.title')}
          </h2>
          <p className="text-sm text-muted leading-relaxed mb-6">
            {t('onboarding.welcome.description')}
          </p>

          <div className="flex flex-col gap-2">
            <Button onClick={onStart} className="w-full">
              {t('onboarding.welcome.startTour')}
            </Button>
            <Button variant="ghost" onClick={onSkip} className="w-full text-muted">
              {t('onboarding.welcome.skip')}
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
