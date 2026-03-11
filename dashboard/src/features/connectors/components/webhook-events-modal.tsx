import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { useConnectorEvents, type Connector, type ConnectorEvent } from '../hooks/use-connectors'
import { formatDistanceToNow } from 'date-fns'

interface WebhookEventsModalProps {
  isOpen: boolean
  onClose: () => void
  connector: Connector | null
}

function EventStatusBadge({ status }: { status: ConnectorEvent['status'] }) {
  const { t } = useTranslation()
  
  const config = {
    sent: { icon: 'check_circle', color: 'text-success', bg: 'bg-success/10' },
    pending: { icon: 'schedule', color: 'text-warning', bg: 'bg-warning/10' },
    failed: { icon: 'error', color: 'text-danger', bg: 'bg-danger/10' },
  }
  
  const { icon, color, bg } = config[status]
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${bg} ${color}`}>
      <Icon name={icon} size="xs" />
      {t(`connectors.eventStatus.${status}`)}
    </span>
  )
}

function EventRow({ event }: { event: ConnectorEvent }) {
  const { t } = useTranslation()
  
  const timeAgo = formatDistanceToNow(new Date(event.created_at), { addSuffix: true })
  
  return (
    <div className="flex items-center justify-between p-4 border-b border-border last:border-0 hover:bg-surface-hover/50 transition-colors">
      <div className="flex items-center gap-4">
        <EventStatusBadge status={event.status} />
        <div>
          <p className="font-medium text-sm">
            {t(`connectors.events.${event.event_type}`)}
          </p>
          <p className="text-xs text-muted mt-0.5">
            {event.event_id}
          </p>
        </div>
      </div>
      
      <div className="text-right">
        <p className="text-sm text-muted">{timeAgo}</p>
        {event.response_code && (
          <p className={`text-xs ${event.response_code >= 200 && event.response_code < 300 ? 'text-success' : 'text-danger'}`}>
            HTTP {event.response_code}
          </p>
        )}
        {event.error_message && !event.response_code && (
          <p className="text-xs text-danger truncate max-w-[150px]" title={event.error_message}>
            {event.error_message}
          </p>
        )}
        {event.status === 'pending' && event.attempts > 0 && (
          <p className="text-xs text-warning">
            {t('connectors.retryAttempt', { count: event.attempts })}
          </p>
        )}
      </div>
    </div>
  )
}

export function WebhookEventsModal({
  isOpen,
  onClose,
  connector,
}: WebhookEventsModalProps) {
  const { t } = useTranslation()
  const { data: events, isLoading, error } = useConnectorEvents(connector?.id || '', 50)

  if (!isOpen || !connector) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-surface-elevated border border-border rounded-xl shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <div>
            <h2 className="text-xl font-semibold">
              {t('connectors.eventLog')}
            </h2>
            <p className="text-sm text-muted mt-1">
              {connector.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <Icon name="close" size="lg" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Icon name="sync" size="xl" className="animate-spin text-muted" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Icon name="error" size="xl" className="text-danger mb-2" />
              <p className="text-muted">{t('connectors.eventsLoadError')}</p>
            </div>
          ) : events && events.length > 0 ? (
            <div className="divide-y divide-border">
              {events.map(event => (
                <EventRow key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Icon name="inbox" size="xl" className="text-muted mb-2" />
              <p className="text-muted">{t('connectors.noEvents')}</p>
              <p className="text-sm text-muted mt-1">{t('connectors.noEventsDescription')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border shrink-0">
          <Button variant="outline" onClick={onClose} className="w-full">
            {t('common.close')}
          </Button>
        </div>
      </div>
    </div>
  )
}
