import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'

export function TrialExpiredWall() {
  const { t } = useTranslation()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-2xl text-center">
        {/* Icon */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/10">
          <Icon name="timer_off" size="2xl" className="text-warning" />
        </div>

        <h2 className="text-xl font-semibold text-foreground mb-2">
          {t('billing.trialExpiredTitle')}
        </h2>
        <p className="text-sm text-muted leading-relaxed mb-6">
          {t('billing.trialExpiredDesc')}
        </p>

        {/* Plan highlights */}
        <div className="text-left bg-primary-500/5 border border-primary-500/10 rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-3">
            {t('billing.trialExpiredUnlock')}
          </p>
          <ul className="space-y-2">
            {(['unlockInstances', 'unlockHistory', 'unlockExports', 'unlockTeam'] as const).map((key) => (
              <li key={key} className="flex items-center gap-2 text-sm text-foreground">
                <Icon name="check_circle" size="sm" className="text-success shrink-0" />
                {t(`billing.${key}`)}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <Link to="/settings/billing">
            <Button className="w-full">
              <Icon name="upgrade" size="sm" className="mr-2" />
              {t('billing.upgadeNow')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
