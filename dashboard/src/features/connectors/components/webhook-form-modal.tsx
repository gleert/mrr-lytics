import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { cn } from '@/shared/lib/utils'
import {
  type Connector,
  type CreateConnectorData,
  type UpdateConnectorData,
  type WebhookEventType,
  WEBHOOK_EVENTS,
} from '../hooks/use-connectors'

interface WebhookFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateConnectorData | UpdateConnectorData) => void
  connector?: Connector | null
  isLoading?: boolean
  newSecret?: string | null
}

// Events that are now fully wired and dispatch in real syncs
const LIVE_EVENTS = new Set<WebhookEventType>([
  'client.new',
  'client.churned',
  'subscription.cancelled',
  'sync.completed',
  'sync.failed',
])

// ─── Styled checkbox row ──────────────────────────────────────────────────────

interface EventCheckboxProps {
  event: WebhookEventType
  checked: boolean
  onChange: () => void
}

function EventCheckbox({ event, checked, onChange }: EventCheckboxProps) {
  const { t } = useTranslation()
  const isLive = LIVE_EVENTS.has(event)

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
      {/* Custom checkbox */}
      <div className={cn(
        'mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all',
        checked
          ? 'bg-primary-500 border-primary-500'
          : 'border-border-hover bg-transparent'
      )}>
        {checked && <Icon name="check" size="sm" className="text-white" style={{ fontSize: '10px' }} />}
      </div>

      {/* Label + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'text-sm font-medium',
            checked ? 'text-foreground' : 'text-foreground'
          )}>
            {t(`connectors.events.${event}`)}
          </span>
          {isLive && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">
          {t(`connectors.events.${event}.desc`)}
        </p>
      </div>
    </button>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function WebhookFormModal({
  isOpen,
  onClose,
  onSubmit,
  connector,
  isLoading = false,
  newSecret,
}: WebhookFormModalProps) {
  const { t } = useTranslation()
  const isEdit = !!connector

  const [name, setName] = React.useState('')
  const [url, setUrl] = React.useState('')
  const [events, setEvents] = React.useState<WebhookEventType[]>([])
  const [secretCopied, setSecretCopied] = React.useState(false)

  React.useEffect(() => {
    if (isOpen) {
      if (connector) {
        setName(connector.name)
        setUrl(connector.config.url || '')
        setEvents(connector.events)
      } else {
        setName('')
        setUrl('')
        setEvents([])
      }
      setSecretCopied(false)
    }
  }, [isOpen, connector])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isEdit) {
      const data: UpdateConnectorData = {}
      if (name !== connector?.name) data.name = name
      if (url !== connector?.config.url) data.url = url
      if (JSON.stringify(events) !== JSON.stringify(connector?.events)) data.events = events
      onSubmit(data)
    } else {
      onSubmit({ name, url, events })
    }
  }

  const toggleEvent = (event: WebhookEventType) => {
    setEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    )
  }

  const copySecret = () => {
    if (newSecret) {
      navigator.clipboard.writeText(newSecret)
      setSecretCopied(true)
      setTimeout(() => setSecretCopied(false), 2000)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-surface-elevated border border-border rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">
            {isEdit ? t('connectors.editWebhook') : t('connectors.addWebhook')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <Icon name="close" size="lg" />
          </button>
        </div>

        {/* Secret Display (only after create) */}
        {newSecret && (
          <div className="p-6 border-b border-border bg-warning/5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Icon name="key" className="text-warning" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-warning">{t('connectors.saveSecret')}</h3>
                <p className="text-sm text-muted mt-1">{t('connectors.saveSecretDescription')}</p>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-surface rounded-lg text-sm font-mono text-foreground break-all">
                    {newSecret}
                  </code>
                  <Button variant="outline" size="sm" onClick={copySecret}>
                    <Icon name={secretCopied ? 'check' : 'content_copy'} size="sm" className="mr-1" />
                    {secretCopied ? t('connectors.copied') : t('connectors.copy')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name">{t('connectors.webhookName')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('connectors.webhookNamePlaceholder')}
                required
              />
            </div>

            {/* URL */}
            <div className="space-y-1.5">
              <Label htmlFor="url">{t('connectors.webhookUrl')}</Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                required
              />
              <p className="text-xs text-muted">{t('connectors.webhookUrlHint')}</p>
            </div>

            {/* Events */}
            <div className="space-y-3">
              {/* Header with select all/none */}
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

              {/* Event list — flat, no category headers */}
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
              {newSecret ? t('common.close') : t('common.cancel')}
            </Button>
            {!newSecret && (
              <Button
                type="submit"
                disabled={isLoading || events.length === 0 || !name || !url}
              >
                {isLoading ? (
                  <>
                    <Icon name="sync" size="sm" className="animate-spin mr-2" />
                    {t('common.saving')}
                  </>
                ) : isEdit ? t('common.save') : t('connectors.createWebhook')}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
