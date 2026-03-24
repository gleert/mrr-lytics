import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { cn } from '@/shared/lib/utils'
import { ZapierLogo } from './connector-logos'
import {
  type ZapierConnector,
  type CreateZapierConnectorData,
  type UpdateZapierConnectorData,
  type WebhookEventType,
  WEBHOOK_EVENTS,
} from '../hooks/use-connectors'

interface ZapierFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateZapierConnectorData | UpdateZapierConnectorData) => void
  connector?: ZapierConnector | null
  isLoading?: boolean
}

// ─── Event checkbox ──────────────────────────────────────────────────────────

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

// ─── Modal ────────────────────────────────────────────────────────────────────

export function ZapierFormModal({
  isOpen,
  onClose,
  onSubmit,
  connector,
  isLoading = false,
}: ZapierFormModalProps) {
  const { t } = useTranslation()
  const isEdit = !!connector

  const [name, setName] = React.useState('')
  const [webhookUrl, setWebhookUrl] = React.useState('')
  const [events, setEvents] = React.useState<WebhookEventType[]>([])

  React.useEffect(() => {
    if (isOpen) {
      if (connector) {
        setName(connector.name)
        setWebhookUrl('')
        setEvents(connector.events)
      } else {
        setName('')
        setWebhookUrl('')
        setEvents([])
      }
    }
  }, [isOpen, connector])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (isEdit) {
      const data: UpdateZapierConnectorData = {}
      if (name !== connector?.name) data.name = name
      if (webhookUrl.trim()) data.webhook_url = webhookUrl.trim()
      if (JSON.stringify(events) !== JSON.stringify(connector?.events)) data.events = events
      onSubmit(data)
    } else {
      onSubmit({
        name,
        webhook_url: webhookUrl.trim(),
        events,
      })
    }
  }

  const toggleEvent = (event: WebhookEventType) => {
    setEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    )
  }

  const isValid = name.trim() &&
    (isEdit || webhookUrl.trim()) &&
    events.length > 0

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-surface-elevated border border-border rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF4A00]/20">
              <ZapierLogo className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold">
              {isEdit ? t('connectors.editZapier') : t('connectors.addZapier')}
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
              <Label htmlFor="zapier-name">{t('connectors.zapierName')}</Label>
              <Input
                id="zapier-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('connectors.zapierNamePlaceholder')}
                required
              />
            </div>

            {/* Webhook URL */}
            <div className="space-y-1.5">
              <Label htmlFor="zapier-url">{t('connectors.zapierWebhookUrl')}</Label>
              <Input
                id="zapier-url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder={t('connectors.zapierWebhookUrlPlaceholder')}
                required={!isEdit}
              />
              <p className="text-xs text-muted">{t('connectors.zapierWebhookUrlHint')}</p>
              {isEdit && (
                <p className="text-xs text-muted">
                  {t('connectors.zapierUrlKeepHint')}
                </p>
              )}
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
              ) : isEdit ? t('common.save') : t('connectors.createZapier')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
