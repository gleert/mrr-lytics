import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { cn } from '@/shared/lib/utils'
import { SlackLogo } from './connector-logos'
import {
  type SlackConnector,
  type CreateSlackConnectorData,
  type UpdateSlackConnectorData,
  type WebhookEventType,
  WEBHOOK_EVENTS,
} from '../hooks/use-connectors'

interface SlackFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateSlackConnectorData | UpdateSlackConnectorData) => void
  connector?: SlackConnector | null
  isLoading?: boolean
}

// ─── Styled event checkbox (same as email/webhook modals) ─────────────────────

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

export function SlackFormModal({
  isOpen,
  onClose,
  onSubmit,
  connector,
  isLoading = false,
}: SlackFormModalProps) {
  const { t } = useTranslation()
  const isEdit = !!connector

  const [name, setName] = React.useState('')
  const [webhookUrl, setWebhookUrl] = React.useState('')
  const [channel, setChannel] = React.useState('')
  const [events, setEvents] = React.useState<WebhookEventType[]>([])

  React.useEffect(() => {
    if (isOpen) {
      if (connector) {
        setName(connector.name)
        setWebhookUrl('') // API returns masked URL — require re-entry only if changing
        setChannel(connector.config.channel ?? '')
        setEvents(connector.events)
      } else {
        setName('')
        setWebhookUrl('')
        setChannel('')
        setEvents([])
      }
    }
  }, [isOpen, connector])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isEdit) {
      const data: UpdateSlackConnectorData = {}
      if (name !== connector?.name) data.name = name
      if (webhookUrl.trim()) data.webhook_url = webhookUrl.trim()
      if (channel !== (connector?.config.channel ?? '')) data.channel = channel.trim() || undefined
      if (JSON.stringify(events) !== JSON.stringify(connector?.events)) data.events = events
      onSubmit(data)
    } else {
      onSubmit({
        name,
        webhook_url: webhookUrl.trim(),
        channel: channel.trim() || undefined,
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
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#4A154B]/20">
              <SlackLogo className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold">
              {isEdit ? t('connectors.editSlack') : t('connectors.addSlack')}
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
              <Label htmlFor="slack-name">{t('connectors.slackName')}</Label>
              <Input
                id="slack-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('connectors.slackNamePlaceholder')}
                required
              />
            </div>

            {/* Webhook URL */}
            <div className="space-y-1.5">
              <Label htmlFor="slack-url">{t('connectors.slackWebhookUrl')}</Label>
              <Input
                id="slack-url"
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder={t('connectors.slackWebhookUrlPlaceholder')}
                required={!isEdit}
              />
              <p className="text-xs text-muted">{t('connectors.slackWebhookUrlHint')}</p>
              {isEdit && (
                <p className="text-xs text-muted">
                  Leave blank to keep the existing webhook URL.
                </p>
              )}
            </div>

            {/* Channel override */}
            <div className="space-y-1.5">
              <Label htmlFor="slack-channel">{t('connectors.slackChannel')}</Label>
              <Input
                id="slack-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder={t('connectors.slackChannelPlaceholder')}
              />
              <p className="text-xs text-muted">{t('connectors.slackChannelHint')}</p>
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
              ) : isEdit ? t('common.save') : t('connectors.createSlack')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
