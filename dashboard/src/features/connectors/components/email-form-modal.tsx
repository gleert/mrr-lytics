import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { cn } from '@/shared/lib/utils'
import {
  type EmailConnector,
  type CreateEmailConnectorData,
  type UpdateEmailConnectorData,
  type WebhookEventType,
  WEBHOOK_EVENTS,
} from '../hooks/use-connectors'

interface EmailFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateEmailConnectorData | UpdateEmailConnectorData) => void
  connector?: EmailConnector | null
  isLoading?: boolean
}

// All events are "Live" for email connectors
const LIVE_EVENTS = new Set<WebhookEventType>(WEBHOOK_EVENTS)

// ─── Styled checkbox row (shared pattern with WebhookFormModal) ───────────────

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
          <span className="text-sm font-medium text-foreground">
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

// ─── Toggle switch ────────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean
  onChange: (value: boolean) => void
  id: string
}

function Toggle({ checked, onChange, id }: ToggleProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
        checked ? 'bg-primary-500' : 'bg-border'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          checked ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </button>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function EmailFormModal({
  isOpen,
  onClose,
  onSubmit,
  connector,
  isLoading = false,
}: EmailFormModalProps) {
  const { t } = useTranslation()
  const isEdit = !!connector

  const [name, setName] = React.useState('')
  const [host, setHost] = React.useState('')
  const [port, setPort] = React.useState('587')
  const [secure, setSecure] = React.useState(false)
  const [user, setUser] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const [events, setEvents] = React.useState<WebhookEventType[]>([])

  React.useEffect(() => {
    if (isOpen) {
      if (connector) {
        setName(connector.name)
        setHost(connector.config.host)
        setPort(String(connector.config.port))
        setSecure(connector.config.secure)
        setUser(connector.config.user)
        setPassword('') // Never pre-fill password
        setFrom(connector.config.from)
        setTo(connector.config.to)
        setEvents(connector.events)
      } else {
        setName('')
        setHost('')
        setPort('587')
        setSecure(false)
        setUser('')
        setPassword('')
        setFrom('')
        setTo('')
        setEvents([])
      }
    }
  }, [isOpen, connector])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const portNum = parseInt(port, 10)
    if (isEdit) {
      const data: UpdateEmailConnectorData = {}
      if (name !== connector?.name) data.name = name
      if (host !== connector?.config.host) data.host = host
      if (portNum !== connector?.config.port) data.port = portNum
      if (secure !== connector?.config.secure) data.secure = secure
      if (user !== connector?.config.user) data.user = user
      if (password.trim()) data.password = password
      if (from !== connector?.config.from) data.from = from
      if (to !== connector?.config.to) data.to = to
      if (JSON.stringify(events) !== JSON.stringify(connector?.events)) data.events = events
      onSubmit(data)
    } else {
      onSubmit({ name, host, port: portNum, secure, user, password, from, to, events })
    }
  }

  const toggleEvent = (event: WebhookEventType) => {
    setEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    )
  }

  const isValid = name.trim() && host.trim() && port.trim() && user.trim() &&
    (isEdit || password.trim()) && from.trim() && to.trim() && events.length > 0

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-surface-elevated border border-border rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-500/10">
              <Icon name="email" className="text-primary-400" />
            </div>
            <h2 className="text-xl font-semibold">
              {isEdit ? t('connectors.editEmail') : t('connectors.addEmail')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <Icon name="close" size="lg" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="email-name">{t('connectors.emailName')}</Label>
              <Input
                id="email-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('connectors.emailNamePlaceholder')}
                required
              />
            </div>

            {/* SMTP Host + Port */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="email-host">{t('connectors.emailHost')}</Label>
                <Input
                  id="email-host"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder={t('connectors.emailHostPlaceholder')}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email-port">{t('connectors.emailPort')}</Label>
                <Input
                  id="email-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder={t('connectors.emailPortPlaceholder')}
                  required
                />
              </div>
            </div>

            {/* TLS Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface">
              <div>
                <p className="text-sm font-medium">{t('connectors.emailSecure')}</p>
                <p className="text-xs text-muted mt-0.5">{t('connectors.emailSecureHint')}</p>
              </div>
              <Toggle id="email-secure" checked={secure} onChange={setSecure} />
            </div>

            {/* SMTP Username */}
            <div className="space-y-1.5">
              <Label htmlFor="email-user">{t('connectors.emailUser')}</Label>
              <Input
                id="email-user"
                type="email"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder={t('connectors.emailUserPlaceholder')}
                required
              />
            </div>

            {/* SMTP Password */}
            <div className="space-y-1.5">
              <Label htmlFor="email-password">{t('connectors.emailPassword')}</Label>
              <Input
                id="email-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEdit
                  ? t('connectors.emailPasswordHint')
                  : t('connectors.emailPasswordPlaceholder')
                }
                required={!isEdit}
                autoComplete="new-password"
              />
              {isEdit && (
                <p className="text-xs text-muted">{t('connectors.emailPasswordHint')}</p>
              )}
            </div>

            {/* From */}
            <div className="space-y-1.5">
              <Label htmlFor="email-from">{t('connectors.emailFrom')}</Label>
              <Input
                id="email-from"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder={t('connectors.emailFromPlaceholder')}
                required
              />
            </div>

            {/* To */}
            <div className="space-y-1.5">
              <Label htmlFor="email-to">{t('connectors.emailTo')}</Label>
              <Input
                id="email-to"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder={t('connectors.emailToPlaceholder')}
                required
              />
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
              ) : isEdit ? t('common.save') : t('connectors.createEmail')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
