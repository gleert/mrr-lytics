/**
 * Salesforce sender — pushes CRM data via Salesforce REST API
 */

import { buildContactFields, buildTaskDescription, buildTaskSubject } from './templates'
import type { SalesforceConnector, SendSalesforceResult } from './types'
import type { WebhookEventType } from '@/lib/webhooks/types'

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function salesforceFetch(
  instanceUrl: string,
  accessToken: string,
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const baseUrl = instanceUrl.replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/services/data/v59.0${path}`, {
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
  instanceUrl: string,
  accessToken: string,
  email: string
): Promise<string | null> {
  const query = encodeURIComponent(`SELECT Id FROM Contact WHERE Email = '${email.replace(/'/g, "\\'")}' LIMIT 1`)
  const res = await salesforceFetch(instanceUrl, accessToken, 'GET', `/query?q=${query}`)
  if (!res.ok) return null

  const records = (res.data.records as Array<{ Id: string }>) || []
  return records.length > 0 ? records[0].Id : null
}

async function createOrUpdateContact(
  instanceUrl: string,
  accessToken: string,
  data: Record<string, unknown>
): Promise<SendSalesforceResult> {
  const email = String(data.email || '')
  if (!email) return { success: false, error: 'No email in event data' }

  const fields = buildContactFields(data)
  const contactId = await findContactByEmail(instanceUrl, accessToken, email)

  if (contactId) {
    const res = await salesforceFetch(instanceUrl, accessToken, 'PATCH', `/sobjects/Contact/${contactId}`, fields)
    if (!res.ok) return { success: false, error: `Failed to update contact: HTTP ${res.status}` }
  } else {
    const res = await salesforceFetch(instanceUrl, accessToken, 'POST', '/sobjects/Contact', fields)
    if (!res.ok) {
      // DUPLICATES_DETECTED — not a failure
      if (res.status === 400 && String(res.data.errorCode || '').includes('DUPLICATE')) {
        return { success: true }
      }
      return { success: false, error: `Failed to create contact: HTTP ${res.status}` }
    }
  }

  return { success: true }
}

async function updateContactLeadStatus(
  instanceUrl: string,
  accessToken: string,
  data: Record<string, unknown>
): Promise<SendSalesforceResult> {
  const email = String(data.email || '')
  if (!email) return { success: false, error: 'No email in event data' }

  const contactId = await findContactByEmail(instanceUrl, accessToken, email)
  if (!contactId) return { success: true } // Contact doesn't exist, skip

  const res = await salesforceFetch(instanceUrl, accessToken, 'PATCH', `/sobjects/Contact/${contactId}`, {
    Description: `[MRRlytics] Status changed to "${data.status}" (was "${data.previous_status}") on ${new Date().toISOString()}`,
  })

  if (!res.ok) return { success: false, error: `Failed to update contact: HTTP ${res.status}` }
  return { success: true }
}

async function createTask(
  instanceUrl: string,
  accessToken: string,
  eventType: string,
  data: Record<string, unknown>
): Promise<SendSalesforceResult> {
  const email = String(data.email || '')
  if (!email) return { success: false, error: 'No email in event data' }

  const contactId = await findContactByEmail(instanceUrl, accessToken, email)
  if (!contactId) return { success: true } // Contact doesn't exist, skip

  const res = await salesforceFetch(instanceUrl, accessToken, 'POST', '/sobjects/Task', {
    Subject: buildTaskSubject(eventType),
    Description: buildTaskDescription(eventType, data),
    WhoId: contactId,
    Status: 'Completed',
    Priority: eventType === 'client.churned' ? 'High' : 'Normal',
    ActivityDate: new Date().toISOString().split('T')[0],
  })

  if (!res.ok) return { success: false, error: `Failed to create task: HTTP ${res.status}` }
  return { success: true }
}

// ─── Main sender ──────────────────────────────────────────────────────────────

export async function sendSalesforceNotification(
  connector: SalesforceConnector,
  eventType: WebhookEventType,
  eventData: Record<string, unknown>
): Promise<SendSalesforceResult> {
  const { access_token, instance_url, actions } = connector.config

  try {
    switch (eventType) {
      case 'client.new': {
        if (actions.create_contacts) {
          return await createOrUpdateContact(instance_url, access_token, eventData)
        }
        return { success: true }
      }

      case 'client.churned': {
        const results: SendSalesforceResult[] = []
        if (actions.update_lead_status) {
          results.push(await updateContactLeadStatus(instance_url, access_token, eventData))
        }
        if (actions.log_tasks) {
          results.push(await createTask(instance_url, access_token, eventType, eventData))
        }
        const failed = results.find(r => !r.success)
        return failed || { success: true }
      }

      case 'subscription.cancelled': {
        if (actions.log_tasks) {
          return await createTask(instance_url, access_token, eventType, eventData)
        }
        return { success: true }
      }

      // sync.completed / sync.failed — not relevant for CRM
      default:
        return { success: true }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[Salesforce] Failed to send ${eventType} to connector ${connector.id}:`, message)
    return { success: false, error: message }
  }
}

/**
 * Test the Salesforce connection by querying limits endpoint
 */
export async function sendTestSalesforce(connector: SalesforceConnector): Promise<SendSalesforceResult> {
  try {
    const baseUrl = connector.config.instance_url.replace(/\/$/, '')
    const response = await fetch(`${baseUrl}/services/data/v59.0/limits`, {
      headers: {
        'Authorization': `Bearer ${connector.config.access_token}`,
      },
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      if (response.status === 401) return { success: false, error: 'Invalid access token' }
      if (response.status === 403) return { success: false, error: 'Insufficient permissions' }
      return { success: false, error: `Salesforce API returned HTTP ${response.status}` }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed'
    return { success: false, error: message }
  }
}
