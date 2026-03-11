/**
 * Email notification HTML templates for each event type
 */

import type { WebhookEventType } from '@/lib/webhooks/types'

interface TemplateData {
  eventType: WebhookEventType
  eventData: Record<string, unknown>
  tenantId: string
}

const EVENT_LABELS: Record<WebhookEventType, string> = {
  'client.new': 'New Client',
  'client.churned': 'Client Churned',
  'subscription.cancelled': 'Subscription Cancelled',
  'sync.completed': 'Sync Completed',
  'sync.failed': 'Sync Failed',
}

const EVENT_COLORS: Record<WebhookEventType, string> = {
  'client.new': '#22c55e',
  'client.churned': '#ef4444',
  'subscription.cancelled': '#f59e0b',
  'sync.completed': '#6366f1',
  'sync.failed': '#ef4444',
}

const EVENT_ICONS: Record<WebhookEventType, string> = {
  'client.new': '👤',
  'client.churned': '👋',
  'subscription.cancelled': '❌',
  'sync.completed': '✅',
  'sync.failed': '⚠️',
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return value.toLocaleString()
  return String(value)
}

function renderDataRows(data: Record<string, unknown>): string {
  return Object.entries(data)
    .filter(([key]) => !['instance_id', 'tenant_id'].includes(key))
    .map(([key, value]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      return `
        <tr>
          <td style="padding: 8px 16px; color: #94a3b8; font-size: 13px; white-space: nowrap; border-bottom: 1px solid #1e293b;">${label}</td>
          <td style="padding: 8px 16px; color: #e2e8f0; font-size: 13px; border-bottom: 1px solid #1e293b;">${formatValue(value)}</td>
        </tr>`
    })
    .join('')
}

export function renderEventSubject(eventType: WebhookEventType, eventData: Record<string, unknown>): string {
  switch (eventType) {
    case 'client.new': {
      const name = eventData.company_name || `${eventData.first_name || ''} ${eventData.last_name || ''}`.trim()
      return `New client: ${name}`
    }
    case 'client.churned': {
      const name = eventData.company_name || `${eventData.first_name || ''} ${eventData.last_name || ''}`.trim()
      return `Client churned: ${name}`
    }
    case 'subscription.cancelled':
      return `Subscription cancelled: ${eventData.product_name || 'Unknown product'}`
    case 'sync.completed':
      return `Sync completed — ${eventData.instance_name || 'Instance'}`
    case 'sync.failed':
      return `⚠️ Sync failed — ${eventData.instance_name || 'Instance'}`
    default:
      return `MRRlytics event: ${eventType}`
  }
}

export function renderEventEmail({ eventType, eventData }: TemplateData): string {
  const label = EVENT_LABELS[eventType]
  const color = EVENT_COLORS[eventType]
  const icon = EVENT_ICONS[eventType]
  const timestamp = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${label}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 560px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom: 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size: 20px; font-weight: 700; color: #e2e8f0; letter-spacing: -0.5px;">MRRlytics</span>
                  </td>
                  <td align="right">
                    <span style="font-size: 12px; color: #64748b;">${timestamp}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Event badge + title -->
          <tr>
            <td style="background-color: #1e293b; border-radius: 12px 12px 0 0; padding: 24px 24px 20px; border-top: 3px solid ${color};">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right: 12px; font-size: 28px; vertical-align: middle;">${icon}</td>
                  <td>
                    <div style="font-size: 18px; font-weight: 700; color: #f1f5f9;">${label}</div>
                    <div style="font-size: 13px; color: #64748b; margin-top: 2px; font-family: monospace;">${eventType}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Data table -->
          <tr>
            <td style="background-color: #1e293b; padding: 0 0 8px; border-radius: 0 0 12px 12px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${renderDataRows(eventData)}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 20px; text-align: center;">
              <p style="font-size: 12px; color: #475569; margin: 0;">
                Sent by <strong style="color: #6366f1;">MRRlytics</strong> · 
                <a href="#" style="color: #475569; text-decoration: underline;">Manage notifications</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
