import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateDemoState } from '@/lib/demo/generator'

export const dynamic = 'force-dynamic'

/**
 * GET /api/demo/whmcs
 *
 * Mimics the SHAPE of the WHMCS MRRlytics PHP module so that any tenant can
 * connect a "demo" instance pointed at this URL and receive deterministic but
 * evolving sample data. Auth is via the X-MRRlytics-Key header, looked up in
 * the demo_instances table.
 */
export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-mrrlytics-key')
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: { code: 401, message: 'Missing X-MRRlytics-Key header' } },
      { status: 401 },
    )
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: instance, error: lookupError } = await supabase
    .from('demo_instances')
    .select('seed, start_date')
    .eq('api_key', apiKey)
    .single()

  if (lookupError || !instance) {
    return NextResponse.json(
      { success: false, error: { code: 403, message: 'Invalid demo API key' } },
      { status: 403 },
    )
  }

  const url = new URL(req.url)
  const limitRaw = parseInt(url.searchParams.get('limit') ?? '1000', 10)
  const offsetRaw = parseInt(url.searchParams.get('offset') ?? '0', 10)
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 1000, 1), 5000)
  const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0)
  const since = url.searchParams.get('since') ?? undefined

  const payload = generateDemoState({
    seed: Number(instance.seed),
    startDate: new Date(`${instance.start_date}T00:00:00Z`),
    today: new Date(),
    since,
    limit,
    offset,
  })

  return NextResponse.json(payload, { status: 200 })
}
