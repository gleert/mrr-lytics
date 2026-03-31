import { Icon } from '@/shared/components/ui/icon'
import { Button } from '@/shared/components/ui/button'
import { useModuleUpdate } from '../hooks/use-module-update'

export function ModuleUpdateBanner() {
  const { data, isLoading } = useModuleUpdate()

  if (isLoading || !data?.hasOutdatedInstances) return null

  const { latestVersion, outdatedInstances, downloadUrl, releaseNotes } = data

  const names = outdatedInstances.map((i) => i.name).join(', ')
  const installedVersion = outdatedInstances[0].installedVersion

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2 text-sm bg-amber-50 border-b border-amber-200 dark:bg-warning/10 dark:border-warning/20">
      <div className="flex items-center gap-2 min-w-0">
        <Icon name="system_update" size="md" className="text-amber-700 dark:text-warning shrink-0" />
        <span className="text-amber-700 dark:text-warning truncate">
          <strong>Módulo WHMCS desactualizado</strong>
          {' · '}
          {names}
          {installedVersion ? ` — v${installedVersion} → v${latestVersion}` : ` — actualizar a v${latestVersion}`}
          {releaseNotes ? ` · ${releaseNotes}` : ''}
        </span>
      </div>
      <a href={downloadUrl} target="_blank" rel="noreferrer" className="shrink-0">
        <Button size="sm" variant="outline" className="border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-200 dark:border-warning/30 dark:bg-warning/15 dark:text-warning dark:hover:bg-warning/25">
          Descargar v{latestVersion}
        </Button>
      </a>
    </div>
  )
}
