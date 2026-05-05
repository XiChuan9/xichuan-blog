import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME, revokeAdminSession } from '@/lib/admin-auth'
import { getAppCloudflareEnv } from '@/lib/cloudflare'

export async function POST(req: NextRequest) {
  try {
    const env = await getAppCloudflareEnv()
    const cookieValue = req.cookies.get(COOKIE_NAME)?.value
    if (env?.DB) {
      await revokeAdminSession(env.DB, cookieValue)
    }
  } catch {
    // Logout should still clear the browser cookie if session revocation fails.
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(COOKIE_NAME, '', {
    maxAge: 0,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
  return response
}
