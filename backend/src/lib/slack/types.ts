/**
 * Slack Connector Types
 */

import type { WebhookEventType } from '@/lib/webhooks/types'

export interface SlackConnectorConfig {
  /** Slack Incoming Webhook URL */
  webhook_url: string
  /** Optional channel override (e.g. #alerts) */
  channel?: string
}

export interface SlackConnector {
  id: string
  tenant_id: string
  type: 'slack'
  name: string
  config: SlackConnectorConfig
  events: WebhookEventType[]
  enabled: boolean
}

export interface SendSlackResult {
  success: boolean
  error?: string
}
