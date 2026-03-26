import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { useFilters, PERIOD_PRESETS, type WhmcsInstance, type PeriodPreset } from '@/app/providers'
import { cn } from '@/shared/lib/utils'

function CustomDateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { customDateRange, setCustomDateRange } = useFilters()
  const [start, setStart] = React.useState(customDateRange?.start || '')
  const [end, setEnd] = React.useState(customDateRange?.end || '')

  // Sync with existing range when opened
  React.useEffect(() => {
    if (open && customDateRange) {
      setStart(customDateRange.start)
      setEnd(customDateRange.end)
    }
  }, [open, customDateRange])

  const handleApply = () => {
    if (start && end && start <= end) {
      setCustomDateRange(start, end)
      onClose()
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm rounded-xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="date_range" size="md" className="text-primary-400" />
            <h3 className="font-semibold">{t('filters.custom')}</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <Icon name="close" size="md" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">{t('filters.from')}</label>
              <input
                type="date"
                value={start}
                onChange={e => setStart(e.target.value)}
                className={cn(
                  'w-full h-10 rounded-lg border border-border bg-surface-elevated px-3 text-sm',
                  'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
                )}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">{t('filters.to')}</label>
              <input
                type="date"
                value={end}
                onChange={e => setEnd(e.target.value)}
                className={cn(
                  'w-full h-10 rounded-lg border border-border bg-surface-elevated px-3 text-sm',
                  'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
                )}
              />
            </div>
          </div>

          {start && end && start > end && (
            <p className="text-xs text-error">{t('filters.invalidRange', 'Start date must be before end date')}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button size="sm" onClick={handleApply} disabled={!start || !end || start > end}>
            <Icon name="check" size="sm" className="mr-1.5" />
            {t('filters.apply')}
          </Button>
        </div>
      </div>
    </>
  )
}

interface DashboardFiltersProps {
  showPeriod?: boolean
}

export function DashboardFilters({ showPeriod = true }: DashboardFiltersProps) {
  const { t } = useTranslation()
  const {
    tenants,
    allInstances,
    currentInstance,
    setCurrentInstance,
    period,
    setPeriod,
    isLoadingTenants,
    hasMultipleInstances,
  } = useFilters()

  const [instanceDropdownOpen, setInstanceDropdownOpen] = React.useState(false)
  const [periodDropdownOpen, setPeriodDropdownOpen] = React.useState(false)
  const [customModalOpen, setCustomModalOpen] = React.useState(false)
  const instanceRef = React.useRef<HTMLDivElement>(null)
  const periodRef = React.useRef<HTMLDivElement>(null)

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (instanceRef.current && !instanceRef.current.contains(event.target as Node)) {
        setInstanceDropdownOpen(false)
      }
      if (periodRef.current && !periodRef.current.contains(event.target as Node)) {
        setPeriodDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInstanceSelect = (instance: WhmcsInstance | null) => {
    setCurrentInstance(instance)
    setInstanceDropdownOpen(false)
  }

  const handlePeriodSelect = (newPeriod: PeriodPreset) => {
    if (newPeriod === 'custom') {
      setPeriodDropdownOpen(false)
      setCustomModalOpen(true)
    } else {
      setPeriod(newPeriod)
      setPeriodDropdownOpen(false)
    }
  }

  const { customDateRange } = useFilters()
  const currentPeriodLabel = period === 'custom' && customDateRange
    ? `${customDateRange.start} — ${customDateRange.end}`
    : t(PERIOD_PRESETS.find(p => p.value === period)?.labelKey || 'filters.30d')

  const PeriodDropdownContent = () => (
    <div className="absolute right-0 top-full mt-1 z-40 min-w-[180px] rounded-lg border border-border bg-background shadow-lg">
      <div className="p-1">
        {PERIOD_PRESETS.map((preset) => (
          <button
            key={preset.value}
            className={cn(
              "w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left transition-colors",
              preset.value === period
                ? "bg-primary-500/10 text-primary-400"
                : "hover:bg-surface-hover"
            )}
            onClick={() => handlePeriodSelect(preset.value)}
          >
            {preset.value === 'custom' && <Icon name="date_range" size="sm" className="text-muted" />}
            {t(preset.labelKey)}
          </button>
        ))}
      </div>
    </div>
  )

  // Don't show instance filter if user has only 1 instance
  if (!hasMultipleInstances) {
    // If also not showing period, return null
    if (!showPeriod) {
      return null
    }

    return (
      <div className="flex items-center gap-2">
        {/* Period Selector Only */}
        <div ref={periodRef} className="relative">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 min-w-[130px] justify-between"
            onClick={() => setPeriodDropdownOpen(!periodDropdownOpen)}
          >
            <div className="flex items-center gap-2">
              <Icon name="calendar_month" size="md" className="text-muted" />
              <span className="truncate max-w-[200px]">{currentPeriodLabel}</span>
            </div>
            <Icon
              name="expand_more"
              size="md"
              className={cn(
                "text-muted transition-transform",
                periodDropdownOpen && "rotate-180"
              )}
            />
          </Button>

          {periodDropdownOpen && <PeriodDropdownContent />}
        </div>

        <CustomDateModal open={customModalOpen} onClose={() => setCustomModalOpen(false)} />
      </div>
    )
  }

  // currentInstance === null means "All instances"
  const isAllSelected = currentInstance === null
  const displayInstanceName = isAllSelected
    ? t('filters.allInstances')
    : currentInstance?.instance_name || t('filters.select')

  // Group instances by tenant for the dropdown
  const instancesByTenant = React.useMemo(() => {
    return tenants.map(tenant => ({
      tenant,
      instances: tenant.instances,
    }))
  }, [tenants])

  // Check if we have multiple tenants (need grouped view)
  const hasMultipleTenants = tenants.length > 1

  return (
    <div className="flex items-center gap-2">
      {/* Instance Selector */}
      <div ref={instanceRef} className="relative">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 min-w-[180px] justify-between"
          onClick={() => setInstanceDropdownOpen(!instanceDropdownOpen)}
          disabled={isLoadingTenants}
        >
          <span className="truncate max-w-[160px]">
            {isLoadingTenants ? t('common.loading') : displayInstanceName}
          </span>
          <Icon
            name="expand_more"
            size="md"
            className={cn(
              "text-muted transition-transform",
              instanceDropdownOpen && "rotate-180"
            )}
          />
        </Button>

        {instanceDropdownOpen && (
          <div className="absolute right-0 top-full mt-1 z-40 min-w-[260px] max-h-[400px] overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
            <div className="p-1">
              {/* "All instances" option */}
              <button
                className={cn(
                  "w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left transition-colors",
                  isAllSelected
                    ? "bg-primary-500/10 text-primary-400"
                    : "hover:bg-surface-hover"
                )}
                onClick={() => handleInstanceSelect(null)}
              >
                <Icon name="domain" size="md" />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{t('filters.allInstances')}</p>
                  <p className="text-xs text-muted">{t('filters.allInstancesDesc', { count: allInstances.length })}</p>
                </div>
              </button>

              {/* Divider */}
              <div className="my-1 border-t border-border" />

              {/* Instances - grouped by tenant if multiple tenants */}
              {hasMultipleTenants ? (
                // Grouped view
                instancesByTenant.map(({ tenant, instances }) => (
                  <div key={tenant.tenant_id}>
                    {/* Tenant header */}
                    <div className="px-3 py-1.5 text-xs font-medium text-muted uppercase tracking-wider">
                      {tenant.tenant_name}
                    </div>

                    {/* Instances under this tenant */}
                    {instances.map((instance) => (
                      <button
                        key={instance.instance_id}
                        className={cn(
                          "w-full flex items-center gap-2 rounded-md px-3 py-2 pl-6 text-sm text-left transition-colors",
                          !isAllSelected && instance.instance_id === currentInstance?.instance_id
                            ? "bg-primary-500/10 text-primary-400"
                            : "hover:bg-surface-hover"
                        )}
                        onClick={() => handleInstanceSelect(instance)}
                      >
                        <Icon name="dns" size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">{instance.instance_name}</p>
                          <p className="text-xs text-muted truncate">{instance.instance_slug}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ))
              ) : (
                // Flat view (single tenant)
                allInstances.map((instance) => (
                  <button
                    key={instance.instance_id}
                    className={cn(
                      "w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left transition-colors",
                      !isAllSelected && instance.instance_id === currentInstance?.instance_id
                        ? "bg-primary-500/10 text-primary-400"
                        : "hover:bg-surface-hover"
                    )}
                    onClick={() => handleInstanceSelect(instance)}
                  >
                    <Icon name="dns" size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{instance.instance_name}</p>
                      <p className="text-xs text-muted truncate">{instance.instance_slug}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Period Selector */}
      {showPeriod && (
        <div ref={periodRef} className="relative">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 min-w-[130px] justify-between"
            onClick={() => setPeriodDropdownOpen(!periodDropdownOpen)}
          >
            <div className="flex items-center gap-2">
              <Icon name="calendar_month" size="md" className="text-muted" />
              <span className="truncate max-w-[200px]">{currentPeriodLabel}</span>
            </div>
            <Icon
              name="expand_more"
              size="md"
              className={cn(
                "text-muted transition-transform",
                periodDropdownOpen && "rotate-180"
              )}
            />
          </Button>

          {periodDropdownOpen && <PeriodDropdownContent />}
        </div>
      )}

      <CustomDateModal open={customModalOpen} onClose={() => setCustomModalOpen(false)} />
    </div>
  )
}
