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
  // When `use_platform` is set, send through the platform's shared SMTP
  // (same env the /api/contact handler uses) instead of tenant-supplied
  // credentials — tenant only configures the recipient.
  const usePlatform = connector.config.use_platform === true
  const host = usePlatform ? process.env.SMTP_HOST : connector.config.host
  const portRaw = usePlatform ? process.env.SMTP_PORT : connector.config.port
  const port = typeof portRaw === 'number' ? portRaw : Number(portRaw || '465')
  const secure = usePlatform ? port === 465 : !!connector.config.secure
  const user = usePlatform ? process.env.SMTP_USER : connector.config.user
  const password = usePlatform ? process.env.SMTP_PASS : connector.config.password
  const from = usePlatform
    ? (process.env.SMTP_FROM || `MRRlytics <${user}>`)
    : connector.config.from
  const to = connector.config.to

  if (!host || !user || !password || !from || !to) {
    return {
      success: false,
      error: usePlatform
        ? 'Platform SMTP env vars are not configured'
        : 'Email connector is missing required SMTP fields',
    }
  }

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
