import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    version: '1.3.2',
    release_notes: 'New: one-click auto-update button in WHMCS admin panel',
    download_url: 'https://imcxbwcdfmtjeothypcg.supabase.co/storage/v1/object/public/module-downloads/mrrlytics-module-v1.3.2.zip',
    released_at: '2026-03-31',
  })
}
