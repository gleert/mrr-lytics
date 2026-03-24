import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { cn } from '@/shared/lib/utils'
import { SalesforceLogo } from './connector-logos'
import {
  type SalesforceConnector,
  type CreateSalesforceConnectorData,
  type UpdateSalesforceConnectorData,
  type WebhookEventType,
  WEBHOOK_EVENTS,
} from '../hooks/use-connectors'

interface SalesforceFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateSalesforceConnectorData | UpdateSalesforceConnectorData) => void
  connector?: SalesforceConnector | null
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
          ? 'border-[#00A1E0]/40 bg-[#00A1E0]/10'
          : 'border-border bg-surface hover:border-border-hover hover:bg-surface-elevated'
      )}
    >
      <div className={cn(
        'mt-0.5 flex-shrink-0 w-9 h-5 rounded-full relative transition-all',
        checked ? 'bg-[#00A1E0]' : 'bg-border-hover'
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

export function SalesforceFormModal({
  isOpen,
  onClose,
  onSubmit,
  connector,
  isLoading = false,
}: SalesforceFormModalProps) {
  const { t } = useTranslation()
  const isEdit = !!connector

  const [name, setName] = React.useState('')
  const [accessToken, setAccessToken] = React.useState('')
  const [instanceUrl, setInstanceUrl] = React.useState('')
  const [createContacts, setCreateContacts] = React.useState(true)
  const [updateLeadStatus, setUpdateLeadStatus] = React.useState(true)
  const [logTasks, setLogTasks] = React.useState(true)
  const [events, setEvents] = React.useState<WebhookEventType[]>([])

  React.useEffect(() => {
    if (isOpen) {
      if (connector) {
        setName(connector.name)
        setAccessToken('')
        setInstanceUrl(connector.config.instance_url || '')
        setCreateContacts(connector.config.actions?.create_contacts ?? true)
        setUpdateLeadStatus(connector.config.actions?.update_lead_status ?? true)
        setLogTasks(connector.config.actions?.log_tasks ?? true)
        setEvents(connector.events)
      } else {
        setName('')
        setAccessToken('')
        setInstanceUrl('')
        setCreateContacts(true)
        setUpdateLeadStatus(true)
        setLogTasks(true)
        setEvents([])
      }
    }
  }, [isOpen, connector])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const actions = {
      create_contacts: createContacts,
      update_lead_status: updateLeadStatus,
      log_tasks: logTasks,
    }

    if (isEdit) {
      const data: UpdateSalesforceConnectorData = { actions }
      if (name !== connector?.name) data.name = name
      if (accessToken.trim()) data.access_token = accessToken.trim()
      if (instanceUrl !== (connector?.config.instance_url || '')) data.instance_url = instanceUrl.trim()
      if (JSON.stringify(events) !== JSON.stringify(connector?.events)) data.events = events
      onSubmit(data)
    } else {
      onSubmit({
        name,
        access_token: accessToken.trim(),
        instance_url: instanceUrl.trim(),
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
    (isEdit || instanceUrl.trim()) &&
    events.length > 0

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-surface-elevated border border-border rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#00A1E0]/20">
              <SalesforceLogo className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold">
              {isEdit ? t('connectors.editSalesforce') : t('connectors.addSalesforce')}
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
              <Label htmlFor="sf-name">{t('connectors.salesforceName')}</Label>
              <Input
                id="sf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('connectors.salesforceNamePlaceholder')}
                required
              />
            </div>

            {/* Access Token */}
            <div className="space-y-1.5">
              <Label htmlFor="sf-token">{t('connectors.salesforceAccessToken')}</Label>
              <Input
                id="sf-token"
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder={t('connectors.salesforceAccessTokenPlaceholder')}
                required={!isEdit}
              />
              <p className="text-xs text-muted">{t('connectors.salesforceAccessTokenHint')}</p>
              {isEdit && (
                <p className="text-xs text-muted">
                  {t('connectors.salesforceTokenKeepHint')}
                </p>
              )}
            </div>

            {/* Instance URL */}
            <div className="space-y-1.5">
              <Label htmlFor="sf-instance">{t('connectors.salesforceInstanceUrl')}</Label>
              <Input
                id="sf-instance"
                value={instanceUrl}
                onChange={(e) => setInstanceUrl(e.target.value)}
                placeholder={t('connectors.salesforceInstanceUrlPlaceholder')}
                required={!isEdit}
              />
              <p className="text-xs text-muted">{t('connectors.salesforceInstanceUrlHint')}</p>
            </div>

            {/* CRM Actions */}
            <div className="space-y-3">
              <Label>{t('connectors.salesforceActions')}</Label>
              <div className="space-y-1.5">
                <Toggle
                  label={t('connectors.salesforceCreateContacts')}
                  hint={t('connectors.salesforceCreateContactsHint')}
                  checked={createContacts}
                  onChange={setCreateContacts}
                />
                <Toggle
                  label={t('connectors.salesforceUpdateLeadStatus')}
                  hint={t('connectors.salesforceUpdateLeadStatusHint')}
                  checked={updateLeadStatus}
                  onChange={setUpdateLeadStatus}
                />
                <Toggle
                  label={t('connectors.salesforceLogTasks')}
                  hint={t('connectors.salesforceLogTasksHint')}
                  checked={logTasks}
                  onChange={setLogTasks}
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
              ) : isEdit ? t('common.save') : t('connectors.createSalesforce')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
