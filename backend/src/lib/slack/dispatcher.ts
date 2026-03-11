/**
 * Slack Event Dispatcher
 *
 * Dispatches events to all Slack connectors subscribed to that event type.
 * Mirrors the email dispatcher pattern.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendSlackNotification } from './sender'
import type { SlackConnector } from './types'
import type { WebhookEventType } from '@/lib/webhooks/types'

export async function dispatchSlackEvent(
  tenantId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient()

  const { data: connectors, error } = await supabase
    .from('connectors')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('type', 'slack')
    .eq('enabled', true)
    .contains('events', [eventType])

  if (error) {
    console.error(`[Slack] Failed to fetch slack connectors for event ${eventType}:`, error)
    return
  }

  if (!connectors || connectors.length === 0) return

  await Promise.all(
    connectors.map(async (connector) => {
      try {
        await sendSlackNotification(connector as SlackConnector, eventType, data)
      } catch (err) {
        console.error(`[Slack] Failed to send ${eventType} to connector ${connector.id}:`, err)
      }
    })
  )
}

// ─── Named convenience wrappers ───────────────────────────────────────────────

export const dispatchSlackClientNew = (tenantId: string, data: Record<string, unknown>) =>
  dispatchSlackEvent(tenantId, 'client.new', data)

export const dispatchSlackClientChurned = (tenantId: string, data: Record<string, unknown>) =>
  dispatchSlackEvent(tenantId, 'client.churned', data)

export const dispatchSlackSubscriptionCancelled = (tenantId: string, data: Record<string, unknown>) =>
  dispatchSlackEvent(tenantId, 'subscription.cancelled', data)

export const dispatchSlackSyncCompleted = (tenantId: string, data: Record<string, unknown>) =>
  dispatchSlackEvent(tenantId, 'sync.completed', data)

export const dispatchSlackSyncFailed = (tenantId: string, data: Record<string, unknown>) =>
  dispatchSlackEvent(tenantId, 'sync.failed', data)
