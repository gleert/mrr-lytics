/**
 * Salesforce Connector Types
 */

import type { WebhookEventType } from '@/lib/webhooks/types'

export interface SalesforceConnectorConfig {
  /** Salesforce Access Token (from Connected App or Personal Access Token) */
  access_token: string
  /** Salesforce instance URL, e.g. https://mycompany.salesforce.com */
  instance_url: string
  /** CRM actions to perform per event */
  actions: {
    create_contacts: boolean
    update_lead_status: boolean
    log_tasks: boolean
  }
}

export interface SalesforceConnector {
  id: string
  tenant_id: string
  type: 'salesforce'
  name: string
  config: SalesforceConnectorConfig
  events: WebhookEventType[]
  enabled: boolean
}

export interface SendSalesforceResult {
  success: boolean
  error?: string
}
