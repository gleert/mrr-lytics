import { processPendingRetries } from '@/lib/webhooks/sender'
import { success, error } from '@/utils/api-response'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/webhooks - Process pending webhook retries
 *
 * Called by Vercel Cron or similar scheduler.
 * Authentication is handled by middleware using CRON_SECRET.
 *
 * Retries failed webhook deliveries with exponential backoff.
 */
export async function GET() {
  try {
    const processed = await processPendingRetries(100)

    return success({
      processed,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Error in /api/cron/webhooks:', err)
    return error(err instanceof Error ? err : new Error('Failed to process webhook retries'))
  }
}
