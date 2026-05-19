import { NextResponse } from 'next/server'
import { LATEST_MODULE_RELEASE } from '@/lib/module/latest-version'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(LATEST_MODULE_RELEASE)
}
