/**
 * HubSpot payload builders
 *
 * Constructs API payloads for HubSpot CRM operations.
 */

/**
 * Build HubSpot contact properties from event data
 */
export function buildContactProperties(data: Record<string, unknown>): Record<string, string> {
  const props: Record<string, string> = {}

  if (data.email) props.email = String(data.email)
  if (data.first_name) props.firstname = String(data.first_name)
  if (data.last_name) props.lastname = String(data.last_name)
  if (data.company_name) props.company = String(data.company_name)

  return props
}

/**
 * Build a human-readable note body for HubSpot engagements
 */
export function buildNoteBody(
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
 * Build HubSpot search filter to find a contact by email
 */
export function buildSearchFilter(email: string) {
  return {
    filterGroups: [
      {
        filters: [
          {
            propertyName: 'email',
            operator: 'EQ',
            value: email,
          },
        ],
      },
    ],
    properties: ['email', 'firstname', 'lastname', 'company', 'hs_object_id'],
    limit: 1,
  }
}
