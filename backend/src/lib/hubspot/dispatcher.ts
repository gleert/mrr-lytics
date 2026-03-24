/**
 * HubSpot Event Dispatcher
 *
 * Dispatches events to all HubSpot connectors subscribed to that event type.
 * Mirrors the Slack dispatcher pattern.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendHubspotNotification } from './sender'
import type { HubspotConnector } from './types'
import type { WebhookEventType } from '@/lib/webhooks/types'

export async function dispatchHubspotEvent(
  tenantId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient()

  const { data: connectors, error } = await supabase
    .from('connectors')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('type', 'hubspot')
    .eq('enabled', true)
    .contains('events', [eventType])

  if (error) {
    console.error(`[HubSpot] Failed to fetch hubspot connectors for event ${eventType}:`, error)
    return
  }

  if (!connectors || connectors.length === 0) return

  await Promise.all(
    connectors.map(async (connector) => {
      try {
        await sendHubspotNotification(connector as HubspotConnector, eventType, data)
      } catch (err) {
        console.error(`[HubSpot] Failed to send ${eventType} to connector ${connector.id}:`, err)
      }
    })
  )
}

// ─── Named convenience wrappers ───────────────────────────────────────────────

export const dispatchHubspotClientNew = (tenantId: string, data: Record<string, unknown>) =>
  dispatchHubspotEvent(tenantId, 'client.new', data)

export const dispatchHubspotClientChurned = (tenantId: string, data: Record<string, unknown>) =>
  dispatchHubspotEvent(tenantId, 'client.churned', data)

export const dispatchHubspotSubscriptionCancelled = (tenantId: string, data: Record<string, unknown>) =>
  dispatchHubspotEvent(tenantId, 'subscription.cancelled', data)

export const dispatchHubspotSyncCompleted = (tenantId: string, data: Record<string, unknown>) =>
  dispatchHubspotEvent(tenantId, 'sync.completed', data)

export const dispatchHubspotSyncFailed = (tenantId: string, data: Record<string, unknown>) =>
  dispatchHubspotEvent(tenantId, 'sync.failed', data)
