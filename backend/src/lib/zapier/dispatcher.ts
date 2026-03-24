/**
 * Zapier Event Dispatcher
 *
 * Dispatches events to all Zapier connectors subscribed to that event type.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendZapierNotification } from './sender'
import type { ZapierConnector } from './types'
import type { WebhookEventType } from '@/lib/webhooks/types'

export async function dispatchZapierEvent(
  tenantId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient()

  const { data: connectors, error } = await supabase
    .from('connectors')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('type', 'zapier')
    .eq('enabled', true)
    .contains('events', [eventType])

  if (error) {
    console.error(`[Zapier] Failed to fetch zapier connectors for event ${eventType}:`, error)
    return
  }

  if (!connectors || connectors.length === 0) return

  await Promise.all(
    connectors.map(async (connector) => {
      try {
        await sendZapierNotification(connector as ZapierConnector, eventType, data)
      } catch (err) {
        console.error(`[Zapier] Failed to send ${eventType} to connector ${connector.id}:`, err)
      }
    })
  )
}

// ─── Named convenience wrappers ───────────────────────────────────────────────

export const dispatchZapierClientNew = (tenantId: string, data: Record<string, unknown>) =>
  dispatchZapierEvent(tenantId, 'client.new', data)

export const dispatchZapierClientChurned = (tenantId: string, data: Record<string, unknown>) =>
  dispatchZapierEvent(tenantId, 'client.churned', data)

export const dispatchZapierSubscriptionCancelled = (tenantId: string, data: Record<string, unknown>) =>
  dispatchZapierEvent(tenantId, 'subscription.cancelled', data)

export const dispatchZapierSyncCompleted = (tenantId: string, data: Record<string, unknown>) =>
  dispatchZapierEvent(tenantId, 'sync.completed', data)

export const dispatchZapierSyncFailed = (tenantId: string, data: Record<string, unknown>) =>
  dispatchZapierEvent(tenantId, 'sync.failed', data)
