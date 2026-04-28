import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
import { cn } from '@/shared/lib/utils'
import { useAdminTenants, useIsSuperAdmin, type AdminTenant } from '../hooks/use-superadmin'
import { Navigate } from 'react-router-dom'
import { TenantActions } from '../components/tenant-actions'

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-muted/10 text-muted',
  starter: 'bg-blue-500/10 text-blue-400',
  advanced: 'bg-cyan-500/10 text-cyan-400',
  pro: 'bg-primary-500/10 text-primary-400',
  business: 'bg-amber-500/10 text-amber-400',
  enterprise: 'bg-amber-500/10 text-amber-400',
}

const DEMO_INSTANCE = {
  url: 'https://api.mrrlytics.com/api/demo/whmcs',
  apiKey: 'mrr_demo_b822911c03604af664dd7333b694bf7b',
  label: 'Demo · Acme Hosting',
}

function CopyableField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted">{label}</p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={value}
          className={cn(
            'flex-1 bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none truncate',
            mono && 'font-mono',
          )}
        />
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          aria-label={`Copiar ${label}`}
        >
          <Icon name={copied ? 'check' : 'content_copy'} size="sm" className={copied ? 'text-success' : ''} />
        </button>
      </div>
    </div>
  )
}

function DemoInstanceCard() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 shrink-0">
          <Icon name="science" size="lg" className="text-primary-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-foreground">Instancia demo de WHMCS</h3>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-400">
              {DEMO_INSTANCE.label}
            </span>
          </div>
          <p className="text-sm text-muted mt-1">
            Conecta cualquier tenant a este endpoint para llenar el dashboard con datos sintéticos
            (~50 clientes, 6 meses de historial). El dataset evoluciona solo: cada sync trae nuevos
            clientes y facturas mensuales si ha pasado tiempo desde la última llamada.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <CopyableField label="URL del endpoint" value={DEMO_INSTANCE.url} />
        <CopyableField label="API Key (X-MRRlytics-Key)" value={DEMO_INSTANCE.apiKey} mono />
      </div>

      <div className="rounded-lg border border-border bg-surface-elevated p-4 space-y-2">
        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <Icon name="link" size="sm" className="text-muted" />
          Cómo conectarla a un tenant
        </p>
        <ol className="text-sm text-muted space-y-1 list-decimal list-inside">
          <li>Entra al tenant (impersonate desde la lista de abajo o desde tu propia cuenta).</li>
          <li>
            Ve a <code className="bg-surface px-1 rounded text-foreground">/sync</code> y pulsa{' '}
            <em>Add Instance</em>.
          </li>
          <li>
            Pega la URL y la API Key de arriba; el nombre puede ser cualquiera (ej.{' '}
            <em>“Demo Acme”</em>).
          </li>
          <li>El test de conexión debe responder OK; lanza un sync manual para poblar las métricas.</li>
        </ol>
      </div>

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
        <p className="text-xs text-amber-400 flex items-start gap-1.5">
          <Icon name="info" size="sm" className="mt-0.5 shrink-0" />
          <span>
            La API key es pública intencionadamente — el endpoint solo expone datos sintéticos.
            Si quieres aislar varios “entornos demo”, inserta filas adicionales en{' '}
            <code className="bg-surface px-1 rounded">demo_instances</code> con otros{' '}
            <code className="bg-surface px-1 rounded">seed</code> /{' '}
            <code className="bg-surface px-1 rounded">start_date</code>.
          </span>
        </p>
      </div>
    </div>
  )
}

function TenantRow({ tenant, onClick, isSelected }: {
  tenant: AdminTenant
  onClick: () => void
  isSelected: boolean
}) {
  const planColor = PLAN_COLORS[tenant.plan_id] ?? 'bg-muted/10 text-muted'

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left flex items-center gap-4 px-4 py-3 rounded-xl transition-colors',
        isSelected
          ? 'bg-primary-500/10 border border-primary-500/20'
          : 'hover:bg-surface-hover border border-transparent'
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{tenant.name}</p>
        <p className="text-xs text-muted truncate">{tenant.slug}</p>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full hidden sm:inline-flex', planColor)}>
          {tenant.plan_name}
        </span>
        <div className="text-right hidden sm:block">
          <p className="text-xs text-muted">Usuarios</p>
          <p className="text-sm font-medium text-foreground">{tenant.member_count}</p>
        </div>
        <div className="text-right hidden md:block">
          <p className="text-xs text-muted">Instancias</p>
          <p className="text-sm font-medium text-foreground">{tenant.instance_count}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Creado</p>
          <p className="text-sm text-muted">
            {new Date(tenant.created_at).toLocaleDateString()}
          </p>
        </div>
        <Icon name="chevron_right" size="sm" className={cn('transition-transform', isSelected && 'rotate-90')} />
      </div>
    </button>
  )
}

function TenantDetail({ tenant }: { tenant: AdminTenant }) {
  return (
    <div className="space-y-6">
      {/* Header + stats row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{tenant.name}</h3>
          <p className="text-xs text-muted font-mono mt-0.5">{tenant.id}</p>
        </div>
        <div className="flex gap-3">
        {[
          { label: 'Plan', value: tenant.plan_name, icon: 'workspace_premium', color: PLAN_COLORS[tenant.plan_id]?.split(' ')[1] ?? 'text-muted' },
          { label: 'Precio/mes', value: tenant.plan_price === 0 ? 'Gratis' : `€${tenant.plan_price}`, icon: 'payments', color: 'text-foreground' },
          { label: 'Estado', value: tenant.status, icon: 'circle', color: tenant.status === 'active' ? 'text-success' : 'text-muted' },
          { label: 'Moneda', value: tenant.currency || '—', icon: 'paid', color: 'text-foreground' },
          { label: 'Usuarios', value: tenant.member_count, icon: 'group', color: 'text-foreground' },
          { label: 'Instancias', value: tenant.instance_count, icon: 'dns', color: 'text-foreground' },
        ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-border bg-surface-elevated px-4 py-2.5 text-center min-w-[80px]">
              <p className={cn('text-base font-semibold capitalize', stat.color)}>{stat.value}</p>
              <p className="text-xs text-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <Icon name="bolt" size="sm" className="text-muted" />
          Acciones
        </h4>
        <TenantActions tenant={tenant} />
      </div>

      <div className="border-t border-border" />

      {/* Members + Instances in two columns */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Members */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <Icon name="group" size="sm" className="text-muted" />
            Usuarios ({tenant.member_count})
          </h4>
          {tenant.members.length === 0 ? (
            <p className="text-sm text-muted">Sin usuarios</p>
          ) : (
            <div className="space-y-2">
              {tenant.members.map(member => (
                <div key={member.user_id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-elevated px-3 py-2">
                  <div className="min-w-0 flex-1">
                    {member.full_name && (
                      <p className="text-sm font-medium text-foreground truncate">{member.full_name}</p>
                    )}
                    <p className="text-xs text-muted truncate">{member.email ?? member.user_id}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      member.is_active ? 'bg-success' : 'bg-muted'
                    )} />
                    <span className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      member.role === 'admin'
                        ? 'bg-primary-500/10 text-primary-400'
                        : 'bg-muted/10 text-muted'
                    )}>
                      {member.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instances */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <Icon name="dns" size="sm" className="text-muted" />
            Instancias WHMCS ({tenant.instance_count})
          </h4>
          {tenant.instances.length === 0 ? (
            <p className="text-sm text-muted">Sin instancias configuradas</p>
          ) : (
            <div className="space-y-2">
              {tenant.instances.map(instance => (
                <div key={instance.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-elevated px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{instance.name}</p>
                    <p className="text-xs text-muted truncate">{instance.whmcs_url}</p>
                  </div>
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                    instance.is_active
                      ? 'bg-success/10 text-success'
                      : 'bg-muted/10 text-muted'
                  )}>
                    {instance.is_active ? 'activa' : 'inactiva'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function SuperAdminPage() {
  useTranslation()
  const isSuperAdmin = useIsSuperAdmin()
  const { data, isLoading } = useAdminTenants()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Guard: redirect if not superadmin
  if (!isSuperAdmin) {
    return <Navigate to="/" replace />
  }

  const tenants = data?.tenants ?? []
  const filtered = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase())
  )
  const selected = filtered.find(t => t.id === selectedId) ?? null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Icon name="admin_panel_settings" size="lg" className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Superadmin</h1>
          <p className="text-sm text-muted">
            {data?.total ?? '...'} tenants registrados
          </p>
        </div>
      </div>

      {/* Demo instance card */}
      <DemoInstanceCard />

      {/* Tenant list - full width */}
      <div className="rounded-xl border border-border bg-surface flex flex-col">
        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar tenant..."
              className="w-full bg-surface-elevated border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>
        </div>

        {/* List */}
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Icon name="sync" size="xl" className="animate-spin text-muted" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted">
              <Icon name="search_off" size="xl" className="mb-2 opacity-50" />
              <p className="text-sm">No se encontraron tenants</p>
            </div>
          ) : (
            filtered.map(tenant => (
              <TenantRow
                key={tenant.id}
                tenant={tenant}
                isSelected={tenant.id === selectedId}
                onClick={() => setSelectedId(tenant.id === selectedId ? null : tenant.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Detail panel - full width, shown below when a tenant is selected */}
      {selected && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <TenantDetail tenant={selected} />
        </div>
      )}
    </div>
  )
}
