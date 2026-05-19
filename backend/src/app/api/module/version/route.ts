import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    version: '1.3.5',
    release_notes: 'Fix module version reporting (broken in 1.3.3/1.3.4) so the dashboard can detect outdated installs',
    download_url: 'https://imcxbwcdfmtjeothypcg.supabase.co/storage/v1/object/public/module-downloads/mrrlytics-module-v1.3.5.zip',
    released_at: '2026-05-19',
  })
}
