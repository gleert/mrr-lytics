import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@/shared/components/ui/icon'
import { useFilters } from '@/app/providers'

export function SyncErrorBanner() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { allInstances } = useFilters()

  const errorInstances = allInstances.filter(i => i.status === 'error')

  if (errorInstances.length === 0) return null

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-xl border border-danger/30 bg-danger/5">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Icon name="sync_problem" className="text-danger shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">
            {t('dashboard.syncErrorBanner.title', { count: errorInstances.length })}
          </p>
          <p className="text-xs text-muted">
            {t('dashboard.syncErrorBanner.desc')}
          </p>
        </div>
      </div>
      <button
        onClick={() => navigate('/settings')}
        className="sm:shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger/15 text-danger text-xs font-semibold hover:bg-danger/25 active:scale-95 transition-all"
      >
        {t('dashboard.syncErrorBanner.cta')}
        <Icon name="arrow_forward" size="sm" />
      </button>
    </div>
  )
}
