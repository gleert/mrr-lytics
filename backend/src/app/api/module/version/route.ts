import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    version: '1.3.4',
    release_notes: 'Track billable item cancellation history from WHMCS activity log so churn metrics reflect real cancellation dates',
    download_url: 'https://imcxbwcdfmtjeothypcg.supabase.co/storage/v1/object/public/module-downloads/mrrlytics-module-v1.3.4.zip',
    released_at: '2026-05-19',
  })
}
