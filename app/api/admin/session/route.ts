import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME, isAdminAuthenticated } from '@/lib/admin-auth'
import { getAppCloudflareEnv } from '@/lib/cloudflare'

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  const env = await getAppCloudflareEnv().catch(() => null)
  const authenticated = await isAdminAuthenticated(token, env?.DB)

  return NextResponse.json(
    { authenticated },
    {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
      },
    },
  )
}
