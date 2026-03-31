import { useQuery } from '@tanstack/react-query'
import { useInstances } from './use-instances'

interface ModuleVersionInfo {
  version: string
  release_notes: string
  download_url: string
  released_at: string
}

function useLatestModuleVersion() {
  return useQuery({
    queryKey: ['module-version'],
    queryFn: async (): Promise<ModuleVersionInfo> => {
      const res = await fetch('/api/module/version')
      if (!res.ok) throw new Error('Failed to fetch module version')
      return res.json()
    },
    staleTime: 24 * 60 * 60 * 1000, // 24h
    retry: false,
  })
}

export interface ModuleUpdateInfo {
  hasOutdatedInstances: boolean
  latestVersion: string
  outdatedInstances: Array<{ id: string; name: string; installedVersion: string }>
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

  const outdatedInstances = instances
    .filter((inst) => {
      if (!inst.module_version) return false
      return compareVersions(inst.module_version, latestInfo.version) < 0
    })
    .map((inst) => ({
      id: inst.id,
      name: inst.name,
      installedVersion: inst.module_version!,
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

/** Returns -1, 0, or 1 like strcmp */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff < 0 ? -1 : 1
  }
  return 0
}
