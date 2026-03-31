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
    <div className="flex items-center justify-between gap-4 px-4 py-2 text-sm bg-warning/10 border-b border-warning/20">
      <div className="flex items-center gap-2 min-w-0">
        <Icon name="system_update" size="md" className="text-warning shrink-0" />
        <span className="text-warning truncate">
          <strong>Módulo WHMCS desactualizado</strong>
          {' · '}
          {names}
          {installedVersion ? ` — v${installedVersion} → v${latestVersion}` : ` — actualizar a v${latestVersion}`}
          {releaseNotes ? ` · ${releaseNotes}` : ''}
        </span>
      </div>
      <a href={downloadUrl} target="_blank" rel="noreferrer" className="shrink-0">
        <Button size="sm" variant="outline" className="border-warning/50 text-warning hover:bg-warning/10">
          Descargar v{latestVersion}
        </Button>
      </a>
    </div>
  )
}
