import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    version: '1.2.0',
    release_notes: 'Client closure date tracking from activity log',
    download_url: 'https://app.mrrlytics.com/module/download',
    released_at: '2026-03-31',
  })
}
