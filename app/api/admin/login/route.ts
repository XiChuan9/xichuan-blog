import { NextRequest, NextResponse } from 'next/server'
import {
  verifyPassword,
  createAdminSession,
  COOKIE_NAME,
  COOKIE_MAX_AGE,
  getAdminAuthConfigError,
} from '@/lib/admin-auth'
import { getRouteEnvWithDb, jsonRateLimitError } from '@/lib/server/route-helpers'
import {
  checkRateLimit,
  clearRateLimit,
  getRequestIp,
  recordRateLimitFailure,
} from '@/lib/rate-limit'

const ADMIN_LOGIN_LIMIT = {
  limit: 8,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
}

export async function POST(req: NextRequest) {
  try {
    const configError = await getAdminAuthConfigError()
    if (configError) {
      return NextResponse.json({ error: configError }, { status: 503 })
    }

    const rateLimitKey = `admin-login:${getRequestIp(req.headers)}`
    const rateLimit = checkRateLimit(rateLimitKey, ADMIN_LOGIN_LIMIT)
    if (!rateLimit.allowed) {
      return jsonRateLimitError(rateLimit.retryAfterSeconds)
    }

    let body: { password?: string }
    try {
      body = (await req.json()) as { password?: string }
    } catch {
      return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
    }
    const { password } = body

    if (!password || !(await verifyPassword(password))) {
      const failureLimit = recordRateLimitFailure(rateLimitKey, ADMIN_LOGIN_LIMIT)
      if (!failureLimit.allowed) {
        return jsonRateLimitError(failureLimit.retryAfterSeconds)
      }
      return NextResponse.json({ error: '密码错误' }, { status: 401 })
    }

    clearRateLimit(rateLimitKey)

    const route = await getRouteEnvWithDb('数据库未配置，无法创建管理员会话')
    if (!route.ok) return route.response

    const token = await createAdminSession(route.db, {
      userAgent: req.headers.get('user-agent') || '',
    })
    if (!token) {
      return NextResponse.json({ error: '管理员鉴权初始化失败，请检查环境变量配置' }, { status: 503 })
    }
    const response = NextResponse.json({ success: true })

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      path: '/',
      maxAge: COOKIE_MAX_AGE,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })

    return response
  } catch (error) {
    console.error('Admin login failed:', error)
    return NextResponse.json({ error: '登录失败，请稍后重试' }, { status: 500 })
  }
}
