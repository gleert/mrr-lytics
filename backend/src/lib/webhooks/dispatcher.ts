/**
 * Webhook Event Dispatcher
 * 
 * Dispatches events to all connectors subscribed to that event type.
 * This is the main entry point for triggering webhook events from the application.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendAndLogWebhook } from './sender'
import type { 
  Connector, 
  WebhookEventType,
  ClientNewEventData,
  ClientChurnedEventData,
  SubscriptionCancelledEventData,
  SyncCompletedEventData,
  SyncFailedEventData,
} from './types'

/**
 * Event data type mapping
 */
type EventDataMap = {
  'client.new': ClientNewEventData
  'client.churned': ClientChurnedEventData
  'subscription.cancelled': SubscriptionCancelledEventData
  'sync.completed': SyncCompletedEventData
  'sync.failed': SyncFailedEventData
}

/**
 * Dispatch an event to all subscribed connectors for a tenant
 * 
 * This function:
 * 1. Finds all enabled connectors subscribed to the event type
 * 2. Sends the webhook to each connector
 * 3. Logs all send attempts
 * 
 * @param tenantId - The tenant ID
 * @param eventType - The event type to dispatch
 * @param data - The event data
 * @returns Array of event IDs created
 */
export async function dispatchEvent<T extends WebhookEventType>(
  tenantId: string,
  eventType: T,
  data: EventDataMap[T]
): Promise<string[]> {
  const supabase = createAdminClient()
  
  // Find all enabled connectors subscribed to this event
  const { data: connectors, error } = await supabase
    .from('connectors')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('enabled', true)
    .contains('events', [eventType])
  
  if (error) {
    console.error(`Failed to fetch connectors for event ${eventType}:`, error)
    return []
  }
  
  if (!connectors || connectors.length === 0) {
    // No connectors subscribed to this event
    return []
  }
  
  // Send to all subscribed connectors in parallel
  const eventIds = await Promise.all(
    connectors.map(async (connector) => {
      try {
        return await sendAndLogWebhook(
          connector as Connector,
          eventType,
          data as unknown as Record<string, unknown>
        )
      } catch (err) {
        console.error(`Failed to send ${eventType} to connector ${connector.id}:`, err)
        return null
      }
    })
  )
  
  // Filter out nulls (failed sends)
  return eventIds.filter((id): id is string => id !== null)
}

/**
 * Dispatch client.new event
 */
export async function dispatchClientNew(
  tenantId: string,
  data: ClientNewEventData
): Promise<string[]> {
  return dispatchEvent(tenantId, 'client.new', data)
}

/**
 * Dispatch client.churned event
 */
export async function dispatchClientChurned(
  tenantId: string,
  data: ClientChurnedEventData
): Promise<string[]> {
  return dispatchEvent(tenantId, 'client.churned', data)
}

/**
 * Dispatch subscription.cancelled event
 */
export async function dispatchSubscriptionCancelled(
  tenantId: string,
  data: SubscriptionCancelledEventData
): Promise<string[]> {
  return dispatchEvent(tenantId, 'subscription.cancelled', data)
}

/**
 * Dispatch sync.completed event
 */
export async function dispatchSyncCompleted(
  tenantId: string,
  data: SyncCompletedEventData
): Promise<string[]> {
  return dispatchEvent(tenantId, 'sync.completed', data)
}

/**
 * Dispatch sync.failed event
 */
export async function dispatchSyncFailed(
  tenantId: string,
  data: SyncFailedEventData
): Promise<string[]> {
  return dispatchEvent(tenantId, 'sync.failed', data)
}

/**
 * Send a test event to a specific connector
 * 
 * Used to verify webhook configuration is working.
 * 
 * @param connector - The connector to test
 * @returns The event ID if successful
 */
export async function sendTestEvent(connector: Connector): Promise<string> {
  const testData = {
    message: 'This is a test event from MRRlytics',
    connector_id: connector.id,
    connector_name: connector.name,
    timestamp: new Date().toISOString(),
  }
  
  // Use sync.completed as the test event type (it's the most generic)
  return await sendAndLogWebhook(
    connector,
    'sync.completed',
    testData
  )
}
