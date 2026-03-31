import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { useInstances } from './use-instances'

interface ModuleVersionInfo {
  version: string
  release_notes: string
  download_url: string
  released_at: string
}

function useLatestModuleVersion() {
  return useQuery({
    queryKey: ['module-version', 'v2'],
    queryFn: () => api.get<ModuleVersionInfo>('/api/module/version'),
    staleTime: 60 * 60 * 1000, // 1h
    gcTime: 0, // never persist to localStorage
    retry: false,
  })
}

export interface OutdatedInstance {
  id: string
  name: string
  installedVersion: string | null // null = old module that doesn't report version
}

export interface ModuleUpdateInfo {
  hasOutdatedInstances: boolean
  latestVersion: string
  outdatedInstances: OutdatedInstance[]
  downloadUrl: string
  releaseNotes: string
}

export function useModuleUpdate(): { data: ModuleUpdateInfo | null; isLoading: boolean } {
  const { data: latestInfo, isLoading: loadingVersion } = useLatestModuleVersion()
  const { data: instances, isLoading: loadingInstances } = useInstances()

  if (loadingVersion || loadingInstances) {
    return { data: null, isLoading: true }
  }

  if (!latestInfo || !instances) {
    return { data: null, isLoading: false }
  }

  const outdatedInstances: OutdatedInstance[] = instances
    .filter((inst) => {
      // Instance never synced — skip, we don't know its version
      if (!inst.last_sync_at) return false
      // module_version is null → old module version that doesn't report version → outdated
      if (!inst.module_version) return true
      return compareVersions(inst.module_version, latestInfo.version) < 0
    })
    .map((inst) => ({
      id: inst.id,
      name: inst.name,
      installedVersion: inst.module_version,
    }))

  return {
    data: {
      hasOutdatedInstances: outdatedInstances.length > 0,
      latestVersion: latestInfo.version,
      outdatedInstances,
      downloadUrl: latestInfo.download_url,
      releaseNotes: latestInfo.release_notes,
    },
    isLoading: false,
  }
}

/** Returns -1, 0, or 1 */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff < 0 ? -1 : 1
  }
  return 0
}
