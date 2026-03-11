/**
 * Email sender — sends notification emails via user-configured SMTP
 */

import nodemailer from 'nodemailer'
import { renderEventEmail, renderEventSubject } from './templates'
import type { EmailConnector, SendEmailResult } from './types'
import type { WebhookEventType } from '@/lib/webhooks/types'

export async function sendEmailNotification(
  connector: EmailConnector,
  eventType: WebhookEventType,
  eventData: Record<string, unknown>
): Promise<SendEmailResult> {
  const { host, port, secure, user, password, from, to } = connector.config

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass: password },
      connectionTimeout: 10_000,
      greetingTimeout: 5_000,
    })

    const subject = renderEventSubject(eventType, eventData)
    const html = renderEventEmail({ eventType, eventData, tenantId: connector.tenant_id })

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
    })

    return { success: true, messageId: info.messageId }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[Email] Failed to send ${eventType} to ${to}:`, message)
    return { success: false, error: message }
  }
}

export async function sendTestEmail(connector: EmailConnector): Promise<SendEmailResult> {
  return sendEmailNotification(
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
