/**
 * Slack sender — posts messages to Slack Incoming Webhooks
 */

import { renderSlackMessage } from './templates'
import type { SlackConnector, SendSlackResult } from './types'
import type { WebhookEventType } from '@/lib/webhooks/types'

export async function sendSlackNotification(
  connector: SlackConnector,
  eventType: WebhookEventType,
  eventData: Record<string, unknown>
): Promise<SendSlackResult> {
  const { webhook_url, channel } = connector.config

  try {
    const payload = renderSlackMessage(eventType, eventData)

    // Optionally override the channel
    const body: Record<string, unknown> = { ...payload }
    if (channel?.trim()) body.channel = channel.trim()

    const response = await fetch(webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      console.error(`[Slack] HTTP ${response.status} for ${eventType}:`, text)
      return { success: false, error: `HTTP ${response.status}: ${text}` }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[Slack] Failed to send ${eventType} to ${webhook_url}:`, message)
    return { success: false, error: message }
  }
}

export async function sendTestSlack(connector: SlackConnector): Promise<SendSlackResult> {
  return sendSlackNotification(
    connector,
    'sync.completed',
    {
      instance_name: 'Test Instance',
      instance_id: 'test',
      records_synced: { clients: 42, hosting: 18, domains: 7 },
      duration_ms: 1234,
      snapshot_id: null,
      _note: 'This is a test notification from MRRlytics',
    }
  )
}
