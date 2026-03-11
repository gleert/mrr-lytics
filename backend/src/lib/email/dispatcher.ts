/**
 * Email Event Dispatcher
 *
 * Dispatches events to all email connectors subscribed to that event type.
 * Mirrors the webhook dispatcher pattern.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmailNotification } from './sender'
import type { EmailConnector } from './types'
import type { WebhookEventType } from '@/lib/webhooks/types'

export async function dispatchEmailEvent(
  tenantId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient()

  const { data: connectors, error } = await supabase
    .from('connectors')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('type', 'email')
    .eq('enabled', true)
    .contains('events', [eventType])

  if (error) {
    console.error(`[Email] Failed to fetch email connectors for event ${eventType}:`, error)
    return
  }

  if (!connectors || connectors.length === 0) return

  await Promise.all(
    connectors.map(async (connector) => {
      try {
        await sendEmailNotification(connector as EmailConnector, eventType, data)
      } catch (err) {
        console.error(`[Email] Failed to send ${eventType} to connector ${connector.id}:`, err)
      }
    })
  )
}

// ─── Named convenience wrappers (mirror webhook dispatcher) ──────────────────

export const dispatchEmailClientNew = (tenantId: string, data: Record<string, unknown>) =>
  dispatchEmailEvent(tenantId, 'client.new', data)

export const dispatchEmailClientChurned = (tenantId: string, data: Record<string, unknown>) =>
  dispatchEmailEvent(tenantId, 'client.churned', data)

export const dispatchEmailSubscriptionCancelled = (tenantId: string, data: Record<string, unknown>) =>
  dispatchEmailEvent(tenantId, 'subscription.cancelled', data)

export const dispatchEmailSyncCompleted = (tenantId: string, data: Record<string, unknown>) =>
  dispatchEmailEvent(tenantId, 'sync.completed', data)

export const dispatchEmailSyncFailed = (tenantId: string, data: Record<string, unknown>) =>
  dispatchEmailEvent(tenantId, 'sync.failed', data)
