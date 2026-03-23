import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const startedAt = Date.now()

export async function GET() {
  const checks: Record<string, { status: string; latency_ms?: number }> = {}

  // Check database connectivity
  try {
    const start = Date.now()
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { error } = await supabase.from('tenants').select('id').limit(1)
    checks.database = {
      status: error ? 'degraded' : 'healthy',
      latency_ms: Date.now() - start,
    }
  } catch {
    checks.database = { status: 'unhealthy' }
  }

  const overallStatus = Object.values(checks).every(c => c.status === 'healthy')
    ? 'healthy'
    : Object.values(checks).some(c => c.status === 'unhealthy')
      ? 'unhealthy'
      : 'degraded'

  return NextResponse.json({
    success: overallStatus !== 'unhealthy',
    data: {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
      version: '1.0.0',
      checks,
    },
  }, { status: overallStatus === 'unhealthy' ? 503 : 200 })
}
