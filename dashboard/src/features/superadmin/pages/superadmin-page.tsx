import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/icon'
import { cn } from '@/shared/lib/utils'
import { useAdminTenants, useIsSuperAdmin, type AdminTenant } from '../hooks/use-superadmin'
import { Navigate } from 'react-router-dom'

function TenantRow({ tenant, onClick, isSelected }: {
  tenant: AdminTenant
  onClick: () => void
  isSelected: boolean
}) {
  const planColor = {
    free: 'text-muted',
    starter: 'text-blue-400',
    pro: 'text-primary-400',
    enterprise: 'text-amber-400',
  }[tenant.plan] ?? 'text-muted'

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
      <div className="flex items-center gap-6 shrink-0">
        <div className="text-right hidden sm:block">
          <p className="text-xs text-muted">Plan</p>
          <p className={cn('text-sm font-medium capitalize', planColor)}>{tenant.plan}</p>
        </div>
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
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">{tenant.name}</h3>
        <p className="text-sm text-muted">{tenant.id}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Plan', value: tenant.plan, icon: 'workspace_premium' },
          { label: 'Miembros', value: tenant.member_count, icon: 'group' },
          { label: 'Instancias', value: tenant.instance_count, icon: 'dns' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-border bg-surface-elevated p-3 text-center">
            <Icon name={stat.icon} size="sm" className="text-primary-400 mb-1 mx-auto" />
            <p className="text-lg font-semibold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Members */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <Icon name="group" size="sm" className="text-muted" />
          Usuarios
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
                <span className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                  member.role === 'admin'
                    ? 'bg-primary-500/10 text-primary-400'
                    : 'bg-muted/10 text-muted'
                )}>
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instances */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <Icon name="dns" size="sm" className="text-muted" />
          Instancias WHMCS
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
                  'w-2 h-2 rounded-full shrink-0',
                  instance.is_active ? 'bg-success' : 'bg-muted'
                )} />
              </div>
            ))}
          </div>
        )}
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
    <div className="space-y-6 max-w-7xl mx-auto">
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

      {/* Main layout */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Tenant list */}
        <div className="lg:col-span-3 rounded-xl border border-border bg-surface flex flex-col">
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
          <div className="flex-1 p-2 space-y-1 overflow-y-auto max-h-[60vh]">
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

        {/* Detail panel */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-surface p-5">
          {selected ? (
            <TenantDetail tenant={selected} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted py-12">
              <Icon name="arrow_back" size="xl" className="mb-3 opacity-30 rotate-180" />
              <p className="text-sm text-center">Selecciona un tenant para ver los detalles</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
