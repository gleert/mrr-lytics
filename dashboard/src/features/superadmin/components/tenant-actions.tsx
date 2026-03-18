import * as React from 'react'
import { cn } from '@/shared/lib/utils'
import { Icon } from '@/shared/components/ui/icon'
import { Button } from '@/shared/components/ui/button'
import { type AdminTenant } from '../hooks/use-superadmin'
import {
  useSuspendTenant,
  useResumeTenant,
  useChangePlan,
  useSyncTenant,
  useTenantLogs,
  useImpersonateTenant,
  type SyncLog,
} from '../hooks/use-superadmin-actions'

const PLANS = [
  { id: 'free', name: 'Free', price: 0 },
  { id: 'starter', name: 'Starter', price: 19 },
  { id: 'pro', name: 'Pro', price: 49 },
  { id: 'business', name: 'Business', price: 99 },
]

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-muted/10 text-muted border-muted/20',
  starter: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  pro: 'bg-primary-500/10 text-primary-400 border-primary-500/20',
  business: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

function SyncLogRow({ log }: { log: SyncLog }) {
  const isOk = log.status === 'completed'
  const duration = log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : '—'
  const records = log.records_synced
    ? Object.values(log.records_synced).reduce((a, b) => a + b, 0)
    : 0

  return (
    <div className="flex items-center gap-3 text-xs py-2 border-b border-border last:border-0">
      <span className={cn('w-2 h-2 rounded-full shrink-0', isOk ? 'bg-success' : log.status === 'running' ? 'bg-warning animate-pulse' : 'bg-error')} />
      <span className="text-muted truncate flex-1">{log.instance_name}</span>
      <span className="text-muted capitalize">{log.triggered_by}</span>
      <span className="text-muted">{duration}</span>
      <span className="text-foreground font-medium">{records} rec</span>
      <span className="text-muted">{new Date(log.started_at).toLocaleString()}</span>
      {log.error_message && (
        <span className="text-error truncate max-w-[120px]" title={log.error_message}>
          {log.error_message}
        </span>
      )}
    </div>
  )
}

interface TenantActionsProps {
  tenant: AdminTenant
}

export function TenantActions({ tenant }: TenantActionsProps) {
  const [showLogs, setShowLogs] = React.useState(false)
  const [showPlanChange, setShowPlanChange] = React.useState(false)
  const [impersonateLink, setImpersonateLink] = React.useState<string | null>(null)
  const [syncResult, setSyncResult] = React.useState<string | null>(null)

  const suspend = useSuspendTenant(tenant.id)
  const resume = useResumeTenant(tenant.id)
  const changePlan = useChangePlan(tenant.id)
  const sync = useSyncTenant(tenant.id)
  const impersonate = useImpersonateTenant(tenant.id)
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useTenantLogs(tenant.id, showLogs)

  const isSuspended = tenant.status === 'suspended'

  const handleSync = async () => {
    setSyncResult(null)
    const res = await sync.mutateAsync()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (res as any)?.data
    if (data?.results) {
      const ok = data.results.filter((r: { success: boolean }) => r.success).length
      setSyncResult(`${ok}/${data.results.length} instancias sincronizadas`)
    }
  }

  const handleImpersonate = async () => {
    setImpersonateLink(null)
    const res = await impersonate.mutateAsync()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (res as any)?.data
    if (data?.magic_link) {
      setImpersonateLink(data.magic_link)
    }
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(tenant.id)
  }

  return (
    <div className="space-y-5 pt-2">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {/* Suspend / Resume */}
        {isSuspended ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => resume.mutate()}
            disabled={resume.isPending}
            className="border-success/30 text-success hover:bg-success/10"
          >
            {resume.isPending ? (
              <Icon name="sync" size="sm" className="mr-1.5 animate-spin" />
            ) : (
              <Icon name="play_circle" size="sm" className="mr-1.5" />
            )}
            Reactivar
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => suspend.mutate()}
            disabled={suspend.isPending}
            className="border-error/30 text-error hover:bg-error/10"
          >
            {suspend.isPending ? (
              <Icon name="sync" size="sm" className="mr-1.5 animate-spin" />
            ) : (
              <Icon name="pause_circle" size="sm" className="mr-1.5" />
            )}
            Suspender
          </Button>
        )}

        {/* Sync */}
        <Button
          size="sm"
          variant="outline"
          onClick={handleSync}
          disabled={sync.isPending}
        >
          {sync.isPending ? (
            <Icon name="sync" size="sm" className="mr-1.5 animate-spin" />
          ) : (
            <Icon name="sync" size="sm" className="mr-1.5" />
          )}
          Sync manual
        </Button>

        {/* Logs */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setShowLogs(v => {
              if (!v) refetchLogs()
              return !v
            })
          }}
        >
          <Icon name="receipt_long" size="sm" className="mr-1.5" />
          {showLogs ? 'Ocultar logs' : 'Ver logs'}
        </Button>

        {/* Change plan */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowPlanChange(v => !v)}
        >
          <Icon name="workspace_premium" size="sm" className="mr-1.5" />
          Cambiar plan
        </Button>

        {/* Impersonate */}
        <Button
          size="sm"
          variant="outline"
          onClick={handleImpersonate}
          disabled={impersonate.isPending}
          className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
        >
          {impersonate.isPending ? (
            <Icon name="sync" size="sm" className="mr-1.5 animate-spin" />
          ) : (
            <Icon name="manage_accounts" size="sm" className="mr-1.5" />
          )}
          Entrar como tenant
        </Button>

        {/* Copy ID */}
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopyId}
        >
          <Icon name="content_copy" size="sm" className="mr-1.5" />
          Copiar ID
        </Button>
      </div>

      {/* Sync result */}
      {syncResult && (
        <p className="text-sm text-success flex items-center gap-1.5">
          <Icon name="check_circle" size="sm" />
          {syncResult}
        </p>
      )}

      {/* Impersonate link */}
      {impersonateLink && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
          <p className="text-xs font-medium text-amber-400 flex items-center gap-1.5">
            <Icon name="warning" size="sm" />
            Link de impersonation generado (expira en 1 hora)
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={impersonateLink}
              className="flex-1 text-xs bg-surface-elevated border border-border rounded px-2 py-1 text-muted font-mono truncate"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(impersonateLink)
              }}
            >
              <Icon name="content_copy" size="sm" />
            </Button>
            <Button
              size="sm"
              onClick={() => window.open(impersonateLink, '_blank')}
            >
              <Icon name="open_in_new" size="sm" />
            </Button>
          </div>
        </div>
      )}

      {/* Plan change panel */}
      {showPlanChange && (
        <div className="rounded-lg border border-border bg-surface-elevated p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Cambiar plan de suscripción</p>
          <div className="flex flex-wrap gap-2">
            {PLANS.map(plan => {
              const isCurrentPlan = tenant.plan_id === plan.id
              return (
                <button
                  key={plan.id}
                  onClick={() => {
                    if (!isCurrentPlan) {
                      changePlan.mutate(plan.id)
                      setShowPlanChange(false)
                    }
                  }}
                  disabled={changePlan.isPending || isCurrentPlan}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
                    isCurrentPlan
                      ? cn(PLAN_COLORS[plan.id], 'border opacity-100 cursor-default')
                      : 'border-border text-muted hover:text-foreground hover:bg-surface-hover'
                  )}
                >
                  {isCurrentPlan && <Icon name="check" size="sm" />}
                  {plan.name}
                  <span className="text-xs opacity-70">
                    {plan.price === 0 ? 'Gratis' : `€${plan.price}/mes`}
                  </span>
                </button>
              )
            })}
          </div>
          {changePlan.isPending && (
            <p className="text-xs text-muted flex items-center gap-1.5">
              <Icon name="sync" size="sm" className="animate-spin" />
              Cambiando plan...
            </p>
          )}
        </div>
      )}

      {/* Logs panel */}
      {showLogs && (
        <div className="rounded-lg border border-border bg-surface-elevated">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="text-sm font-medium text-foreground">Últimos sync logs</p>
          </div>
          <div className="px-4">
            {logsLoading ? (
              <div className="py-4 flex items-center justify-center">
                <Icon name="sync" size="lg" className="animate-spin text-muted" />
              </div>
            ) : !logsData?.logs?.length ? (
              <p className="py-4 text-sm text-muted text-center">Sin logs disponibles</p>
            ) : (
              logsData.logs.map(log => <SyncLogRow key={log.id} log={log} />)
            )}
          </div>
        </div>
      )}
    </div>
  )
}
