/**
 * Zapier Connector Types
 */

import type { WebhookEventType } from '@/lib/webhooks/types'

export interface ZapierConnectorConfig {
  /** Zapier Catch Hook URL */
  webhook_url: string
}

export interface ZapierConnector {
  id: string
  tenant_id: string
  type: 'zapier'
  name: string
  config: ZapierConnectorConfig
  events: WebhookEventType[]
  enabled: boolean
}

export interface SendZapierResult {
  success: boolean
  error?: string
}
