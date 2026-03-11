/**
 * Webhook Sender
 * 
 * Handles sending webhook payloads to configured endpoints with:
 * - HMAC-SHA256 signatures
 * - Configurable timeouts
 * - Automatic retry scheduling with exponential backoff
 * - Event logging
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { generateWebhookHeaders, generateEventId } from './signature'
import {
  type Connector,
  type WebhookConfig,
  type WebhookPayload,
  type WebhookEventType,
  type ConnectorEventStatus,
  RETRY_DELAYS_SECONDS,
  MAX_RETRY_ATTEMPTS,
  WEBHOOK_TIMEOUT_MS,
  MAX_RESPONSE_BODY_LENGTH,
} from './types'

/**
 * Result of a webhook send attempt
 */
export interface SendResult {
  success: boolean
  status: ConnectorEventStatus
  responseCode?: number
  responseBody?: string
  errorMessage?: string
}

/**
 * Send a webhook to a connector endpoint
 * 
 * @param connector - The connector configuration
 * @param eventType - The event type being sent
 * @param payload - The full webhook payload
 * @returns Result of the send attempt
 */
export async function sendWebhook(
  connector: Connector,
  eventType: WebhookEventType,
  payload: WebhookPayload
): Promise<SendResult> {
  const config = connector.config as WebhookConfig
  
  if (!config.url) {
    return {
      success: false,
      status: 'failed',
      errorMessage: 'Webhook URL not configured',
    }
  }
  
  const payloadString = JSON.stringify(payload)
  const headers = generateWebhookHeaders(payloadString, config.secret, eventType)
  
  // Add custom headers if configured
  if (config.headers) {
    Object.assign(headers, config.headers)
  }
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
    
    const response = await fetch(config.url, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)
    
    // Read response body (truncated)
    let responseBody = ''
    try {
      const text = await response.text()
      responseBody = text.substring(0, MAX_RESPONSE_BODY_LENGTH)
      if (text.length > MAX_RESPONSE_BODY_LENGTH) {
        responseBody += '... (truncated)'
      }
    } catch {
      // Ignore body read errors
    }
    
    // Consider 2xx responses as successful
    const success = response.status >= 200 && response.status < 300
    
    return {
      success,
      status: success ? 'sent' : 'pending', // pending = will retry
      responseCode: response.status,
      responseBody,
      errorMessage: success ? undefined : `HTTP ${response.status}`,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Check if it was a timeout
    const isTimeout = errorMessage.includes('abort') || errorMessage.includes('timeout')
    
    return {
      success: false,
      status: 'pending', // Will retry
      errorMessage: isTimeout ? 'Request timeout' : errorMessage,
    }
  }
}

/**
 * Calculate the next retry timestamp based on attempt number
 * 
 * @param attemptNumber - Current attempt number (1-based)
 * @returns ISO timestamp for next retry, or null if max attempts exceeded
 */
function calculateNextRetry(attemptNumber: number): string | null {
  if (attemptNumber >= MAX_RETRY_ATTEMPTS) {
    return null
  }
  
  const delaySeconds = RETRY_DELAYS_SECONDS[attemptNumber] || RETRY_DELAYS_SECONDS[RETRY_DELAYS_SECONDS.length - 1]
  const nextRetry = new Date(Date.now() + delaySeconds * 1000)
  return nextRetry.toISOString()
}

/**
 * Send a webhook and log the event
 * 
 * This is the main entry point for sending webhooks. It:
 * 1. Sends the webhook
 * 2. Logs the event in connector_events
 * 3. Schedules retry if needed
 * 
 * @param connector - The connector configuration
 * @param eventType - The event type
 * @param data - The event data
 * @returns The created event record ID
 */
export async function sendAndLogWebhook(
  connector: Connector,
  eventType: WebhookEventType,
  data: Record<string, unknown>
): Promise<string> {
  const supabase = createAdminClient()
  const eventId = generateEventId()
  
  // Build the full payload
  const payload: WebhookPayload = {
    id: eventId,
    type: eventType,
    created_at: new Date().toISOString(),
    tenant_id: connector.tenant_id,
    data,
  }
  
  // Attempt to send
  const result = await sendWebhook(connector, eventType, payload)
  
  // Determine final status
  let status: ConnectorEventStatus = result.status
  let nextRetryAt: string | null = null
  
  if (!result.success) {
    // First attempt failed, schedule retry
    nextRetryAt = calculateNextRetry(1)
    if (!nextRetryAt) {
      status = 'failed' // Max attempts reached
    }
  }
  
  // Log the event
  const { data: eventRecord, error } = await supabase
    .from('connector_events')
    .insert({
      connector_id: connector.id,
      event_type: eventType,
      event_id: eventId,
      payload,
      status,
      response_code: result.responseCode,
      response_body: result.responseBody,
      error_message: result.errorMessage,
      attempts: 1,
      next_retry_at: nextRetryAt,
      sent_at: result.success ? new Date().toISOString() : null,
    })
    .select('id')
    .single()
  
  if (error) {
    console.error('Failed to log webhook event:', error)
    throw error
  }
  
  return eventRecord.id
}

/**
 * Retry a pending webhook event
 * 
 * @param eventId - The connector_event ID to retry
 * @returns Whether the retry was successful
 */
export async function retryWebhookEvent(eventId: string): Promise<boolean> {
  const supabase = createAdminClient()
  
  // Get the event with connector config
  const { data: event, error: fetchError } = await supabase
    .from('connector_events')
    .select(`
      *,
      connector:connectors (
        id,
        tenant_id,
        type,
        name,
        config,
        events,
        enabled
      )
    `)
    .eq('id', eventId)
    .single()
  
  if (fetchError || !event) {
    console.error('Failed to fetch event for retry:', fetchError)
    return false
  }
  
  // Check if connector is still enabled
  if (!event.connector?.enabled) {
    // Mark as failed since connector is disabled
    await supabase
      .from('connector_events')
      .update({
        status: 'failed',
        error_message: 'Connector disabled',
        next_retry_at: null,
      })
      .eq('id', eventId)
    return false
  }
  
  // Attempt to send
  const result = await sendWebhook(
    event.connector as Connector,
    event.event_type,
    event.payload
  )
  
  const newAttempts = event.attempts + 1
  let status: ConnectorEventStatus = result.status
  let nextRetryAt: string | null = null
  
  if (!result.success) {
    nextRetryAt = calculateNextRetry(newAttempts)
    if (!nextRetryAt) {
      status = 'failed' // Max attempts reached
    }
  }
  
  // Update the event
  const { error: updateError } = await supabase
    .from('connector_events')
    .update({
      status,
      response_code: result.responseCode,
      response_body: result.responseBody,
      error_message: result.errorMessage,
      attempts: newAttempts,
      next_retry_at: nextRetryAt,
      sent_at: result.success ? new Date().toISOString() : null,
    })
    .eq('id', eventId)
  
  if (updateError) {
    console.error('Failed to update event after retry:', updateError)
    return false
  }
  
  return result.success
}

/**
 * Process all pending webhook retries
 * 
 * This should be called periodically (e.g., by a cron job)
 * 
 * @param limit - Maximum number of events to process
 * @returns Number of events processed
 */
export async function processPendingRetries(limit = 100): Promise<number> {
  const supabase = createAdminClient()
  
  // Get pending retries using the helper function
  const { data: pendingEvents, error } = await supabase
    .rpc('get_pending_webhook_retries', { p_limit: limit })
  
  if (error) {
    console.error('Failed to get pending retries:', error)
    return 0
  }
  
  if (!pendingEvents || pendingEvents.length === 0) {
    return 0
  }
  
  // Process each retry
  let processed = 0
  for (const event of pendingEvents) {
    try {
      await retryWebhookEvent(event.event_id)
      processed++
    } catch (err) {
      console.error(`Failed to retry event ${event.event_id}:`, err)
    }
  }
  
  return processed
}
