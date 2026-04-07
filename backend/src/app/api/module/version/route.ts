import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    version: '1.3.3',
    release_notes: 'Fix: increase rate limit from 60 to 300 requests/minute to reduce 429 errors',
    download_url: 'https://imcxbwcdfmtjeothypcg.supabase.co/storage/v1/object/public/module-downloads/mrrlytics-module-v1.3.3.zip',
    released_at: '2026-04-01',
  })
}
