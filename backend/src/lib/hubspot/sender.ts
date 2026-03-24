/**
 * HubSpot sender — pushes CRM data via HubSpot REST API v3
 */

import { buildContactProperties, buildNoteBody, buildSearchFilter } from './templates'
import type { HubspotConnector, SendHubspotResult } from './types'
import type { WebhookEventType } from '@/lib/webhooks/types'

const HUBSPOT_API = 'https://api.hubapi.com'

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function hubspotFetch(
  accessToken: string,
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const response = await fetch(`${HUBSPOT_API}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  })

  const data = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, data: data as Record<string, unknown> }
}

// ─── Contact operations ───────────────────────────────────────────────────────

async function findContactByEmail(
  accessToken: string,
  email: string
): Promise<string | null> {
  const res = await hubspotFetch(accessToken, 'POST', '/crm/v3/objects/contacts/search', buildSearchFilter(email))
  if (!res.ok) return null

  const results = (res.data.results as Array<{ id: string }>) || []
  return results.length > 0 ? results[0].id : null
}

async function createOrUpdateContact(
  accessToken: string,
  data: Record<string, unknown>
): Promise<SendHubspotResult> {
  const email = String(data.email || '')
  if (!email) return { success: false, error: 'No email in event data' }

  const properties = buildContactProperties(data)
  const contactId = await findContactByEmail(accessToken, email)

  if (contactId) {
    // Update existing contact
    const res = await hubspotFetch(accessToken, 'PATCH', `/crm/v3/objects/contacts/${contactId}`, { properties })
    if (!res.ok) return { success: false, error: `Failed to update contact: HTTP ${res.status}` }
  } else {
    // Create new contact
    const res = await hubspotFetch(accessToken, 'POST', '/crm/v3/objects/contacts', { properties })
    if (!res.ok) {
      // 409 = contact already exists (race condition) — not a failure
      if (res.status === 409) return { success: true }
      return { success: false, error: `Failed to create contact: HTTP ${res.status}` }
    }
  }

  return { success: true }
}

async function updateContactLifecycle(
  accessToken: string,
  data: Record<string, unknown>
): Promise<SendHubspotResult> {
  const email = String(data.email || '')
  if (!email) return { success: false, error: 'No email in event data' }

  const contactId = await findContactByEmail(accessToken, email)
  if (!contactId) return { success: true } // Contact doesn't exist in HubSpot, skip

  const res = await hubspotFetch(accessToken, 'PATCH', `/crm/v3/objects/contacts/${contactId}`, {
    properties: { lifecyclestage: 'other' },
  })

  if (!res.ok) return { success: false, error: `Failed to update lifecycle: HTTP ${res.status}` }
  return { success: true }
}

async function createNote(
  accessToken: string,
  eventType: string,
  data: Record<string, unknown>
): Promise<SendHubspotResult> {
  const email = String(data.email || '')
  if (!email) return { success: false, error: 'No email in event data' }

  const contactId = await findContactByEmail(accessToken, email)
  if (!contactId) return { success: true } // Contact doesn't exist in HubSpot, skip

  const noteBody = buildNoteBody(eventType, data)

  // Create note
  const noteRes = await hubspotFetch(accessToken, 'POST', '/crm/v3/objects/notes', {
    properties: { hs_note_body: noteBody, hs_timestamp: new Date().toISOString() },
    associations: [
      {
        to: { id: contactId },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }],
      },
    ],
  })

  if (!noteRes.ok) return { success: false, error: `Failed to create note: HTTP ${noteRes.status}` }
  return { success: true }
}

// ─── Main sender ──────────────────────────────────────────────────────────────

export async function sendHubspotNotification(
  connector: HubspotConnector,
  eventType: WebhookEventType,
  eventData: Record<string, unknown>
): Promise<SendHubspotResult> {
  const { access_token, actions } = connector.config

  try {
    switch (eventType) {
      case 'client.new': {
        if (actions.create_contacts) {
          return await createOrUpdateContact(access_token, eventData)
        }
        return { success: true }
      }

      case 'client.churned': {
        const results: SendHubspotResult[] = []
        if (actions.update_lifecycle) {
          results.push(await updateContactLifecycle(access_token, eventData))
        }
        if (actions.log_notes) {
          results.push(await createNote(access_token, eventType, eventData))
        }
        const failed = results.find(r => !r.success)
        return failed || { success: true }
      }

      case 'subscription.cancelled': {
        if (actions.log_notes) {
          return await createNote(access_token, eventType, eventData)
        }
        return { success: true }
      }

      // sync.completed / sync.failed — not relevant for CRM
      default:
        return { success: true }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[HubSpot] Failed to send ${eventType} to connector ${connector.id}:`, message)
    return { success: false, error: message }
  }
}

/**
 * Test the HubSpot connection by making a simple API call
 */
export async function sendTestHubspot(connector: HubspotConnector): Promise<SendHubspotResult> {
  try {
    const res = await hubspotFetch(
      connector.config.access_token,
      'GET',
      '/crm/v3/objects/contacts?limit=1'
    )

    if (!res.ok) {
      if (res.status === 401) return { success: false, error: 'Invalid access token' }
      if (res.status === 403) return { success: false, error: 'Insufficient scopes — ensure crm.objects.contacts.read is enabled' }
      return { success: false, error: `HubSpot API returned HTTP ${res.status}` }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed'
    return { success: false, error: message }
  }
}
