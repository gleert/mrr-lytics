/**
 * Salesforce payload builders
 *
 * Constructs API payloads for Salesforce CRM operations.
 */

/**
 * Build Salesforce Contact fields from event data
 */
export function buildContactFields(data: Record<string, unknown>): Record<string, string> {
  const fields: Record<string, string> = {}

  if (data.email) fields.Email = String(data.email)
  if (data.first_name) fields.FirstName = String(data.first_name)
  if (data.last_name) fields.LastName = String(data.last_name)
  if (data.company_name) fields.Department = String(data.company_name)

  // Salesforce requires LastName
  if (!fields.LastName) {
    fields.LastName = fields.Email || 'Unknown'
  }

  return fields
}

/**
 * Build a human-readable task description for Salesforce
 */
export function buildTaskDescription(
  eventType: string,
  data: Record<string, unknown>
): string {
  const name = [data.first_name, data.last_name].filter(Boolean).join(' ') ||
    String(data.company_name || data.email || 'Unknown')
  const now = new Date().toISOString()

  switch (eventType) {
    case 'client.new':
      return `[MRRlytics] New client detected: ${name} (${data.email || 'no email'}) from instance "${data.instance_name}" on ${now}`

    case 'client.churned':
      return `[MRRlytics] Client churned: ${name} — status changed to "${data.status}" (was "${data.previous_status}") in instance "${data.instance_name}" on ${now}`

    case 'subscription.cancelled': {
      const amount = Number(data.amount) || 0
      return `[MRRlytics] Subscription cancelled: ${data.product_name || 'Unknown product'} (${data.domain || 'no domain'}) — $${amount.toFixed(2)}/${data.billing_cycle || 'mo'} MRR impact. Instance "${data.instance_name}" on ${now}`
    }

    default:
      return `[MRRlytics] Event ${eventType} on ${now}`
  }
}

/**
 * Build task subject line
 */
export function buildTaskSubject(eventType: string): string {
  switch (eventType) {
    case 'client.new':
      return 'MRRlytics: New Client Detected'
    case 'client.churned':
      return 'MRRlytics: Client Churned'
    case 'subscription.cancelled':
      return 'MRRlytics: Subscription Cancelled'
    default:
      return `MRRlytics: ${eventType}`
  }
}
