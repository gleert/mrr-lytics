import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { cn } from '@/shared/lib/utils'
import { HubspotLogo } from './connector-logos'
import {
  type HubspotConnector,
  type CreateHubspotConnectorData,
  type UpdateHubspotConnectorData,
  type WebhookEventType,
  WEBHOOK_EVENTS,
} from '../hooks/use-connectors'

interface HubspotFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateHubspotConnectorData | UpdateHubspotConnectorData) => void
  connector?: HubspotConnector | null
  isLoading?: boolean
}

// ─── Event checkbox (reused pattern) ─────────────────────────────────────────

interface EventCheckboxProps {
  event: WebhookEventType
  checked: boolean
  onChange: () => void
}

function EventCheckbox({ event, checked, onChange }: EventCheckboxProps) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        'w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
        checked
          ? 'border-primary-500/50 bg-primary-500/10'
          : 'border-border bg-surface hover:border-border-hover hover:bg-surface-elevated'
      )}
    >
      <div className={cn(
        'mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all',
        checked
          ? 'bg-primary-500 border-primary-500'
          : 'border-border-hover bg-transparent'
      )}>
        {checked && <Icon name="check" size="sm" className="text-white" style={{ fontSize: '10px' }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">
            {t(`connectors.events.${event}`)}
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        </div>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">
          {t(`connectors.events.${event}.desc`)}
        </p>
      </div>
    </button>
  )
}

// ─── Toggle switch ───────────────────────────────────────────────────────────

interface ToggleProps {
  label: string
  hint: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function Toggle({ label, hint, checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
        checked
          ? 'border-[#FF7A59]/40 bg-[#FF7A59]/10'
          : 'border-border bg-surface hover:border-border-hover hover:bg-surface-elevated'
      )}
    >
      <div className={cn(
        'mt-0.5 flex-shrink-0 w-9 h-5 rounded-full relative transition-all',
        checked ? 'bg-[#FF7A59]' : 'bg-border-hover'
      )}>
        <div className={cn(
          'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
          checked ? 'left-[18px]' : 'left-0.5'
        )} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">{hint}</p>
      </div>
    </button>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function HubspotFormModal({
  isOpen,
  onClose,
  onSubmit,
  connector,
  isLoading = false,
}: HubspotFormModalProps) {
  const { t } = useTranslation()
  const isEdit = !!connector

  const [name, setName] = React.useState('')
  const [accessToken, setAccessToken] = React.useState('')
  const [portalId, setPortalId] = React.useState('')
  const [createContacts, setCreateContacts] = React.useState(true)
  const [updateLifecycle, setUpdateLifecycle] = React.useState(true)
  const [logNotes, setLogNotes] = React.useState(true)
  const [events, setEvents] = React.useState<WebhookEventType[]>([])

  React.useEffect(() => {
    if (isOpen) {
      if (connector) {
        setName(connector.name)
        setAccessToken('')
        setPortalId(connector.config.portal_id || '')
        setCreateContacts(connector.config.actions?.create_contacts ?? true)
        setUpdateLifecycle(connector.config.actions?.update_lifecycle ?? true)
        setLogNotes(connector.config.actions?.log_notes ?? true)
        setEvents(connector.events)
      } else {
        setName('')
        setAccessToken('')
        setPortalId('')
        setCreateContacts(true)
        setUpdateLifecycle(true)
        setLogNotes(true)
        setEvents([])
      }
    }
  }, [isOpen, connector])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const actions = {
      create_contacts: createContacts,
      update_lifecycle: updateLifecycle,
      log_notes: logNotes,
    }

    if (isEdit) {
      const data: UpdateHubspotConnectorData = { actions }
      if (name !== connector?.name) data.name = name
      if (accessToken.trim()) data.access_token = accessToken.trim()
      if (portalId !== (connector?.config.portal_id || '')) data.portal_id = portalId.trim() || undefined
      if (JSON.stringify(events) !== JSON.stringify(connector?.events)) data.events = events
      onSubmit(data)
    } else {
      onSubmit({
        name,
        access_token: accessToken.trim(),
        portal_id: portalId.trim() || undefined,
        events,
        actions,
      })
    }
  }

  const toggleEvent = (event: WebhookEventType) => {
    setEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    )
  }

  const isValid = name.trim() &&
    (isEdit || accessToken.trim()) &&
    events.length > 0

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-surface-elevated border border-border rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF7A59]/20">
              <HubspotLogo className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold">
              {isEdit ? t('connectors.editHubspot') : t('connectors.addHubspot')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <Icon name="close" size="lg" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="hubspot-name">{t('connectors.hubspotName')}</Label>
              <Input
                id="hubspot-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('connectors.hubspotNamePlaceholder')}
                required
              />
            </div>

            {/* Access Token */}
            <div className="space-y-1.5">
              <Label htmlFor="hubspot-token">{t('connectors.hubspotAccessToken')}</Label>
              <Input
                id="hubspot-token"
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder={t('connectors.hubspotAccessTokenPlaceholder')}
                required={!isEdit}
              />
              <p className="text-xs text-muted">{t('connectors.hubspotAccessTokenHint')}</p>
              {isEdit && (
                <p className="text-xs text-muted">
                  {t('connectors.hubspotTokenKeepHint')}
                </p>
              )}
            </div>

            {/* Portal ID */}
            <div className="space-y-1.5">
              <Label htmlFor="hubspot-portal">{t('connectors.hubspotPortalId')}</Label>
              <Input
                id="hubspot-portal"
                value={portalId}
                onChange={(e) => setPortalId(e.target.value)}
                placeholder={t('connectors.hubspotPortalIdPlaceholder')}
              />
              <p className="text-xs text-muted">{t('connectors.hubspotPortalIdHint')}</p>
            </div>

            {/* CRM Actions */}
            <div className="space-y-3">
              <Label>{t('connectors.hubspotActions')}</Label>
              <div className="space-y-1.5">
                <Toggle
                  label={t('connectors.hubspotCreateContacts')}
                  hint={t('connectors.hubspotCreateContactsHint')}
                  checked={createContacts}
                  onChange={setCreateContacts}
                />
                <Toggle
                  label={t('connectors.hubspotUpdateLifecycle')}
                  hint={t('connectors.hubspotUpdateLifecycleHint')}
                  checked={updateLifecycle}
                  onChange={setUpdateLifecycle}
                />
                <Toggle
                  label={t('connectors.hubspotLogNotes')}
                  hint={t('connectors.hubspotLogNotesHint')}
                  checked={logNotes}
                  onChange={setLogNotes}
                />
              </div>
            </div>

            {/* Events */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t('connectors.selectEvents')}</Label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted tabular-nums">
                    {events.length}/{WEBHOOK_EVENTS.length}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEvents([...WEBHOOK_EVENTS])}
                      className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                    >
                      {t('connectors.selectAll')}
                    </button>
                    <span className="text-muted">·</span>
                    <button
                      type="button"
                      onClick={() => setEvents([])}
                      className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                    >
                      {t('connectors.selectNone')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                {WEBHOOK_EVENTS.map(event => (
                  <EventCheckbox
                    key={event}
                    event={event}
                    checked={events.includes(event)}
                    onChange={() => toggleEvent(event)}
                  />
                ))}
              </div>

              {events.length === 0 && (
                <p className="text-xs text-danger">{t('connectors.selectAtLeastOne')}</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading || !isValid}>
              {isLoading ? (
                <>
                  <Icon name="sync" size="sm" className="animate-spin mr-2" />
                  {t('common.saving')}
                </>
              ) : isEdit ? t('common.save') : t('connectors.createHubspot')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
