/**
 * Slack message templates
 *
 * Builds Block Kit payloads for each event type.
 * https://api.slack.com/block-kit
 */

import type { WebhookEventType } from '@/lib/webhooks/types'

// ─── helpers ──────────────────────────────────────────────────────────────────

function header(text: string) {
  return { type: 'header', text: { type: 'plain_text', text, emoji: true } }
}

function section(text: string) {
  return { type: 'section', text: { type: 'mrkdwn', text } }
}

function divider() {
  return { type: 'divider' }
}

function context(text: string) {
  return {
    type: 'context',
    elements: [{ type: 'mrkdwn', text }],
  }
}

function fieldsSection(fields: Array<{ label: string; value: string }>) {
  return {
    type: 'section',
    fields: fields.map(f => ({
      type: 'mrkdwn',
      text: `*${f.label}*\n${f.value}`,
    })),
  }
}

// ─── event renderers ──────────────────────────────────────────────────────────

export interface SlackPayload {
  text: string
  blocks: unknown[]
}

export function renderSlackMessage(
  eventType: WebhookEventType,
  data: Record<string, unknown>
): SlackPayload {
  switch (eventType) {
    case 'client.new': {
      const name = [data.first_name, data.last_name].filter(Boolean).join(' ') ||
        String(data.company_name || data.email || 'Unknown')
      return {
        text: `:tada: New client: ${name}`,
        blocks: [
          header(':tada: New Client'),
          section(`A new client has been created in *${data.instance_name}*.`),
          fieldsSection([
            { label: 'Name', value: name },
            { label: 'Email', value: String(data.email || '—') },
            { label: 'Company', value: String(data.company_name || '—') },
            { label: 'Instance', value: String(data.instance_name || '—') },
          ]),
          divider(),
          context(`MRRlytics · ${new Date().toUTCString()}`),
        ],
      }
    }

    case 'client.churned': {
      const name = [data.first_name, data.last_name].filter(Boolean).join(' ') ||
        String(data.company_name || data.email || 'Unknown')
      return {
        text: `:warning: Client churned: ${name}`,
        blocks: [
          header(':warning: Client Churned'),
          section(`A client has transitioned to *${data.status}* status in *${data.instance_name}*.`),
          fieldsSection([
            { label: 'Name', value: name },
            { label: 'Email', value: String(data.email || '—') },
            { label: 'Status', value: String(data.status || '—') },
            { label: 'Previous Status', value: String(data.previous_status || '—') },
          ]),
          divider(),
          context(`MRRlytics · ${new Date().toUTCString()}`),
        ],
      }
    }

    case 'subscription.cancelled': {
      const amount = Number(data.amount) || 0
      return {
        text: `:x: Subscription cancelled: ${data.product_name}`,
        blocks: [
          header(':x: Subscription Cancelled'),
          section(
            `A subscription has been cancelled in *${data.instance_name}*.\n` +
            `MRR impact: *$${amount.toFixed(2)}/mo*`
          ),
          fieldsSection([
            { label: 'Product', value: String(data.product_name || '—') },
            { label: 'Domain', value: String(data.domain || '—') },
            { label: 'Amount', value: `$${amount.toFixed(2)}` },
            { label: 'Billing Cycle', value: String(data.billing_cycle || '—') },
          ]),
          divider(),
          context(`MRRlytics · ${new Date().toUTCString()}`),
        ],
      }
    }

    case 'sync.completed': {
      const records = data.records_synced as Record<string, number> | undefined
      const total = records ? Object.values(records).reduce((a, b) => a + b, 0) : 0
      const durationSec = ((Number(data.duration_ms) || 0) / 1000).toFixed(1)
      return {
        text: `:white_check_mark: Sync completed: ${data.instance_name}`,
        blocks: [
          header(':white_check_mark: Sync Completed'),
          section(`Data sync completed for *${data.instance_name}*.`),
          fieldsSection([
            { label: 'Records Synced', value: String(total) },
            { label: 'Duration', value: `${durationSec}s` },
            { label: 'Instance', value: String(data.instance_name || '—') },
          ]),
          divider(),
          context(`MRRlytics · ${new Date().toUTCString()}`),
        ],
      }
    }

    case 'sync.failed': {
      return {
        text: `:red_circle: Sync failed: ${data.instance_name}`,
        blocks: [
          header(':red_circle: Sync Failed'),
          section(`Data sync failed for *${data.instance_name}*.`),
          section(`*Error:*\n\`\`\`${data.error}\`\`\``),
          divider(),
          context(`MRRlytics · ${new Date().toUTCString()}`),
        ],
      }
    }

    default:
      return {
        text: `MRRlytics event: ${eventType}`,
        blocks: [
          header('MRRlytics Event'),
          section(`Event type: \`${eventType}\``),
          section('```' + JSON.stringify(data, null, 2) + '```'),
        ],
      }
  }
}
