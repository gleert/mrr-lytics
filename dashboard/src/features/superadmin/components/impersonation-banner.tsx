import { Icon } from '@/shared/components/ui/icon'

interface ImpersonationBannerProps {
  tenantId: string
  onExit: () => void
}

export function ImpersonationBanner({ tenantId, onExit }: ImpersonationBannerProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-black flex items-center justify-between px-4 py-2 text-sm font-medium">
      <div className="flex items-center gap-2">
        <Icon name="manage_accounts" size="sm" />
        <span>
          Modo superadmin — Estás viendo el tenant <code className="bg-black/10 px-1 rounded text-xs">{tenantId}</code>
        </span>
      </div>
      <button
        onClick={onExit}
        className="flex items-center gap-1.5 bg-black/15 hover:bg-black/25 px-3 py-1 rounded-lg transition-colors"
      >
        <Icon name="logout" size="sm" />
        Salir
      </button>
    </div>
  )
}
