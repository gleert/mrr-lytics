import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { cn } from '@/shared/lib/utils'
import type { WhmcsInstanceFull, CreateInstanceData, UpdateInstanceData } from '../hooks/use-instances'

interface InstanceFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateInstanceData | UpdateInstanceData) => void
  instance?: WhmcsInstanceFull | null
  isLoading?: boolean
}

const PRESET_COLORS = [
  '#7C3AED', // Purple (primary)
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#8B5CF6', // Violet
]

export function InstanceFormModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  instance, 
  isLoading 
}: InstanceFormModalProps) {
  const { t } = useTranslation()
  const isEdit = !!instance

  const [name, setName] = React.useState('')
  const [whmcsUrl, setWhmcsUrl] = React.useState('')
  const [apiToken, setApiToken] = React.useState('')
  const [color, setColor] = React.useState(PRESET_COLORS[0])
  const [syncEnabled, setSyncEnabled] = React.useState(true)
  const [syncInterval, setSyncInterval] = React.useState(6)
  const [showToken, setShowToken] = React.useState(false)

  // Reset form when modal opens/closes or instance changes
  React.useEffect(() => {
    if (isOpen && instance) {
      setName(instance.name)
      setWhmcsUrl(instance.whmcs_url)
      setApiToken('') // Don't show existing token for security
      setColor(instance.color || PRESET_COLORS[0])
      setSyncEnabled(instance.sync_enabled)
      setSyncInterval(instance.sync_interval_hours)
      setShowToken(false)
    } else if (isOpen && !instance) {
      setName('')
      setWhmcsUrl('')
      setApiToken('')
      setColor(PRESET_COLORS[0])
      setSyncEnabled(true)
      setSyncInterval(6)
      setShowToken(false)
    }
  }, [isOpen, instance])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const data: CreateInstanceData | UpdateInstanceData = {
      name: name.trim(),
      whmcs_url: whmcsUrl.trim(),
      color,
      sync_enabled: syncEnabled,
      sync_interval_hours: syncInterval,
    }

    // Only include token if provided (for security, don't send empty)
    if (apiToken.trim()) {
      data.api_token = apiToken.trim()
    }

    onSubmit(data)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-surface-elevated border border-border rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? t('instances.editInstance') : t('instances.addInstance')}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <Icon name="close" size="md" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* WHMCS Module prerequisite banner (only on create) */}
          {!isEdit && (
            <div className="rounded-xl border border-primary-500/20 bg-primary-500/5 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
                  <Icon name="extension" size="md" className="text-primary-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-tight">
                    {t('instances.moduleRequired')}
                  </p>
                  <p className="mt-1 text-xs text-muted leading-relaxed">
                    {t('instances.moduleRequiredDesc')}
                  </p>
                  <a
                    href="/downloads/mrrlytics-whmcs-module.zip"
                    download
                    className={cn(
                      'mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-1.5',
                      'bg-primary-500 text-white text-xs font-medium',
                      'hover:bg-primary-600 transition-colors'
                    )}
                  >
                    <Icon name="download" size="sm" />
                    {t('instances.downloadModule')}
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium leading-tight text-foreground">
              {t('instances.name')} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('instances.namePlaceholder')}
              required
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
            />
          </div>

          {/* WHMCS URL */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium leading-tight text-foreground">
              {t('instances.whmcsUrl')} *
            </label>
            <input
              type="url"
              value={whmcsUrl}
              onChange={(e) => setWhmcsUrl(e.target.value)}
              placeholder="https://billing.example.com/modules/addons/mrrlytics/api.php"
              required
              className="w-full px-3.5 py-2 bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
            />
            <p className="text-xs text-muted">
              {t('instances.whmcsUrlHint')}
            </p>
          </div>

          {/* API Token */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium leading-tight text-foreground">
              {t('instances.apiToken')} {!isEdit && '*'}
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder={isEdit ? t('instances.apiTokenPlaceholderEdit') : t('instances.apiTokenPlaceholder')}
                required={!isEdit}
                className="w-full px-3.5 py-2 pr-12 bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
              >
                <Icon name={showToken ? 'visibility_off' : 'visibility'} size="md" />
              </button>
            </div>
            <p className="text-xs text-muted">
              {t('instances.apiTokenHint')}
            </p>
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium leading-tight text-foreground">
              {t('instances.color')}
            </label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  onClick={() => setColor(presetColor)}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-all',
                    color === presetColor 
                      ? 'border-foreground scale-110' 
                      : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: presetColor }}
                />
              ))}
              {/* Custom color picker */}
              <div className="relative">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 w-8 h-8 opacity-0 cursor-pointer"
                />
                <div 
                  className="w-8 h-8 rounded-full border-2 border-dashed border-border flex items-center justify-center"
                  style={{ backgroundColor: !PRESET_COLORS.includes(color) ? color : undefined }}
                >
                  {PRESET_COLORS.includes(color) && (
                    <Icon name="palette" size="sm" className="text-muted" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sync Settings */}
          <div className="space-y-3">
            <label className="block text-sm font-medium leading-tight text-foreground">
              {t('instances.syncSettings')}
            </label>
            
            {/* Sync Enabled Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">{t('instances.enableSync')}</span>
              <button
                type="button"
                onClick={() => setSyncEnabled(!syncEnabled)}
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors',
                  syncEnabled ? 'bg-primary-500' : 'bg-muted/30'
                )}
              >
                <span
                  className={cn(
                    'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                    syncEnabled ? 'left-6' : 'left-1'
                  )}
                />
              </button>
            </div>

            {/* Sync Interval */}
            {syncEnabled && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted">{t('instances.syncEveryLabel')}</span>
                <select
                  value={syncInterval}
                  onChange={(e) => setSyncInterval(Number(e.target.value))}
                  className="px-3 py-1.5 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                >
                  <option value={1}>1 {t('instances.hour')}</option>
                  <option value={3}>3 {t('instances.hours')}</option>
                  <option value={6}>6 {t('instances.hours')}</option>
                  <option value={12}>12 {t('instances.hours')}</option>
                  <option value={24}>24 {t('instances.hours')}</option>
                </select>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !name.trim() || !whmcsUrl.trim()}
            >
              {isLoading ? (
                <>
                  <Icon name="sync" size="md" className="animate-spin mr-2" />
                  {t('common.saving')}
                </>
              ) : (
                isEdit ? t('common.save') : t('instances.addInstance')
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
