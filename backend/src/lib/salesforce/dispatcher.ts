/**
 * Salesforce Event Dispatcher
 *
 * Dispatches events to all Salesforce connectors subscribed to that event type.
 * Mirrors the HubSpot/Slack dispatcher pattern.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendSalesforceNotification } from './sender'
import type { SalesforceConnector } from './types'
import type { WebhookEventType } from '@/lib/webhooks/types'

export async function dispatchSalesforceEvent(
  tenantId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient()

  const { data: connectors, error } = await supabase
    .from('connectors')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('type', 'salesforce')
    .eq('enabled', true)
    .contains('events', [eventType])

  if (error) {
    console.error(`[Salesforce] Failed to fetch salesforce connectors for event ${eventType}:`, error)
    return
  }

  if (!connectors || connectors.length === 0) return

  await Promise.all(
    connectors.map(async (connector) => {
      try {
        await sendSalesforceNotification(connector as SalesforceConnector, eventType, data)
      } catch (err) {
        console.error(`[Salesforce] Failed to send ${eventType} to connector ${connector.id}:`, err)
      }
    })
  )
}

// ─── Named convenience wrappers ───────────────────────────────────────────────

export const dispatchSalesforceClientNew = (tenantId: string, data: Record<string, unknown>) =>
  dispatchSalesforceEvent(tenantId, 'client.new', data)

export const dispatchSalesforceClientChurned = (tenantId: string, data: Record<string, unknown>) =>
  dispatchSalesforceEvent(tenantId, 'client.churned', data)

export const dispatchSalesforceSubscriptionCancelled = (tenantId: string, data: Record<string, unknown>) =>
  dispatchSalesforceEvent(tenantId, 'subscription.cancelled', data)

export const dispatchSalesforceSyncCompleted = (tenantId: string, data: Record<string, unknown>) =>
  dispatchSalesforceEvent(tenantId, 'sync.completed', data)

export const dispatchSalesforceSyncFailed = (tenantId: string, data: Record<string, unknown>) =>
  dispatchSalesforceEvent(tenantId, 'sync.failed', data)
