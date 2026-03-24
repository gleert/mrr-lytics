/**
 * Zapier sender — pushes event data to Zapier Catch Hooks
 */

import type { ZapierConnector, SendZapierResult } from './types'
import type { WebhookEventType } from '@/lib/webhooks/types'

/**
 * Send event data to a Zapier Catch Hook URL
 */
export async function sendZapierNotification(
  connector: ZapierConnector,
  eventType: WebhookEventType,
  eventData: Record<string, unknown>
): Promise<SendZapierResult> {
  try {
    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      connector_name: connector.name,
      ...eventData,
    }

    const response = await fetch(connector.config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      return { success: false, error: `Zapier returned HTTP ${response.status}` }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[Zapier] Failed to send ${eventType} to connector ${connector.id}:`, message)
    return { success: false, error: message }
  }
}

/**
 * Test the Zapier connection by sending a test payload
 */
export async function sendTestZapier(connector: ZapierConnector): Promise<SendZapierResult> {
  try {
    const response = await fetch(connector.config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'test',
        timestamp: new Date().toISOString(),
        message: 'Test event from MRRlytics',
        connector_name: connector.name,
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      if (response.status === 404 || response.status === 410) {
        return { success: false, error: 'Webhook URL not found — check your Zap is active' }
      }
      return { success: false, error: `Zapier returned HTTP ${response.status}` }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed'
    return { success: false, error: message }
  }
}
