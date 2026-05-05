import { NextRequest, NextResponse } from 'next/server'
import {
  verifyPassword,
  createAdminSession,
  COOKIE_NAME,
  COOKIE_MAX_AGE,
  getAdminAuthConfigError,
} from '@/lib/admin-auth'
import { getRouteEnvWithDb } from '@/lib/server/route-helpers'

export async function POST(req: NextRequest) {
  try {
    const configError = await getAdminAuthConfigError()
    if (configError) {
      return NextResponse.json({ error: configError }, { status: 503 })
    }

    const { password } = (await req.json()) as { password?: string }

    if (!password || !(await verifyPassword(password))) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 })
    }

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
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }
}
