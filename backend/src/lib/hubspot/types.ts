/**
 * HubSpot Connector Types
 */

import type { WebhookEventType } from '@/lib/webhooks/types'

export interface HubspotConnectorConfig {
  /** HubSpot Private App Access Token */
  access_token: string
  /** Optional portal ID for reference */
  portal_id?: string
  /** CRM actions to perform per event */
  actions: {
    create_contacts: boolean
    update_lifecycle: boolean
    log_notes: boolean
  }
}

export interface HubspotConnector {
  id: string
  tenant_id: string
  type: 'hubspot'
  name: string
  config: HubspotConnectorConfig
  events: WebhookEventType[]
  enabled: boolean
}

export interface SendHubspotResult {
  success: boolean
  error?: string
}
