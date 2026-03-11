/**
 * Webhook Types and Constants
 * 
 * Defines all webhook-related types, event names, and constants.
 */

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * All available webhook event types
 */
export const WEBHOOK_EVENTS = [
  // Client events
  'client.new',
  'client.churned',
  
  // Subscription events  
  'subscription.cancelled',
  
  // Sync events
  'sync.completed',
  'sync.failed',
] as const

export type WebhookEventType = typeof WEBHOOK_EVENTS[number]

/**
 * Event type metadata for UI display
 */
export const WEBHOOK_EVENT_INFO: Record<WebhookEventType, { 
  category: 'client' | 'subscription' | 'sync'
  description: string 
}> = {
  'client.new': {
    category: 'client',
    description: 'Triggered when a new client is detected during sync',
  },
  'client.churned': {
    category: 'client', 
    description: 'Triggered when a client status changes to Inactive or Closed',
  },
  'subscription.cancelled': {
    category: 'subscription',
    description: 'Triggered when a service/hosting is cancelled',
  },
  'sync.completed': {
    category: 'sync',
    description: 'Triggered when a WHMCS sync completes successfully',
  },
  'sync.failed': {
    category: 'sync',
    description: 'Triggered when a WHMCS sync fails',
  },
}

// ============================================================================
// CONNECTOR TYPES
// ============================================================================

export type ConnectorType = 'webhook' | 'slack' | 'discord'

/**
 * Webhook-specific configuration
 */
export interface WebhookConfig {
  url: string
  secret: string
  headers?: Record<string, string>
}

/**
 * Connector record from database
 */
export interface Connector {
  id: string
  tenant_id: string
  type: ConnectorType
  name: string
  config: WebhookConfig | Record<string, unknown>
  events: WebhookEventType[]
  enabled: boolean
  created_at: string
  updated_at: string
}

/**
 * Connector with stats (from get_tenant_connectors function)
 */
export interface ConnectorWithStats extends Omit<Connector, 'config'> {
  config: {
    url?: string
    has_secret?: boolean
  }
  total_events: number
  failed_events: number
  last_event_at: string | null
}

// ============================================================================
// EVENT PAYLOAD TYPES
// ============================================================================

/**
 * Base webhook payload structure (sent to endpoints)
 */
export interface WebhookPayload<T = Record<string, unknown>> {
  id: string           // Event ID (evt_xxx)
  type: WebhookEventType
  created_at: string   // ISO timestamp
  tenant_id: string
  data: T
}

/**
 * Client new event data
 */
export interface ClientNewEventData {
  client_id: number
  email: string
  first_name: string
  last_name: string
  company_name: string | null
  date_created: string
  instance_id: string
  instance_name: string
}

/**
 * Client churned event data
 */
export interface ClientChurnedEventData {
  client_id: number
  email: string
  first_name: string
  last_name: string
  company_name: string | null
  status: string
  previous_status: string
  instance_id: string
  instance_name: string
}

/**
 * Subscription cancelled event data
 */
export interface SubscriptionCancelledEventData {
  service_id: number
  client_id: number
  client_email: string
  product_name: string
  domain: string | null
  amount: number
  billing_cycle: string
  cancellation_date: string
  instance_id: string
  instance_name: string
}

/**
 * Sync completed event data
 */
export interface SyncCompletedEventData {
  instance_id: string
  instance_name: string
  records_synced: Record<string, number>
  duration_ms: number
  snapshot_id?: string | null
}

/**
 * Sync failed event data
 */
export interface SyncFailedEventData {
  instance_id: string
  instance_name: string
  error: string
}

// ============================================================================
// CONNECTOR EVENT TYPES
// ============================================================================

export type ConnectorEventStatus = 'pending' | 'sent' | 'failed'

/**
 * Connector event record from database
 */
export interface ConnectorEvent {
  id: string
  connector_id: string
  event_type: WebhookEventType
  event_id: string
  payload: WebhookPayload
  status: ConnectorEventStatus
  response_code: number | null
  response_body: string | null
  error_message: string | null
  attempts: number
  max_attempts: number
  next_retry_at: string | null
  sent_at: string | null
  created_at: string
}

/**
 * Connector event summary (from get_connector_events function)
 */
export interface ConnectorEventSummary {
  id: string
  event_type: WebhookEventType
  event_id: string
  status: ConnectorEventStatus
  response_code: number | null
  error_message: string | null
  attempts: number
  sent_at: string | null
  created_at: string
}

// ============================================================================
// RETRY CONFIGURATION
// ============================================================================

/**
 * Retry delays in seconds (exponential backoff)
 * Attempt 1: immediate
 * Attempt 2: 1 minute
 * Attempt 3: 5 minutes
 * Attempt 4: 30 minutes
 * Attempt 5: 2 hours
 */
export const RETRY_DELAYS_SECONDS = [0, 60, 300, 1800, 7200] as const

/**
 * Maximum number of delivery attempts
 */
export const MAX_RETRY_ATTEMPTS = 5

/**
 * Request timeout in milliseconds
 */
export const WEBHOOK_TIMEOUT_MS = 30000

/**
 * Maximum response body size to store (in characters)
 */
export const MAX_RESPONSE_BODY_LENGTH = 1000
