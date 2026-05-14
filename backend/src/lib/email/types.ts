/**
 * Email Connector Types
 */

import type { WebhookEventType } from '@/lib/webhooks/types'

export interface EmailConnectorConfig {
  use_platform?: boolean // true = ignore host/port/user/password/from and use platform SMTP env
  host?: string
  port?: number
  secure?: boolean       // true = TLS (port 465), false = STARTTLS (port 587)
  user?: string
  password?: string
  from?: string          // "display name <address@domain.com>"
  to: string             // recipient address (always required)
}

export interface EmailConnector {
  id: string
  tenant_id: string
  type: 'email'
  name: string
  config: EmailConnectorConfig
  events: WebhookEventType[]
  enabled: boolean
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}
