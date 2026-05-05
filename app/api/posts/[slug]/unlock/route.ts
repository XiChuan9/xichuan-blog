import { NextRequest, NextResponse } from 'next/server'
import { getPostBySlug, isPubliclyAccessiblePost } from '@/lib/db'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import {
  createPostAccessToken,
  getPostAccessCookieName,
  POST_ACCESS_COOKIE_MAX_AGE,
  verifyPassword,
} from '@/lib/password'

type Ctx = { params: Promise<{ slug: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const { slug } = await params
  const env = await getAppCloudflareEnv().catch(() => null)
  if (!env?.DB) {
    return NextResponse.json({ error: '数据库未配置' }, { status: 500 })
  }

  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求体不是有效 JSON' }, { status: 400 })
  }

  const post = await getPostBySlug(env.DB, slug)
  if (!post || !isPubliclyAccessiblePost(post)) {
    return NextResponse.json({ error: '文章不存在' }, { status: 404 })
  }
  if (!post.password) {
    return NextResponse.json({ success: true })
  }

  const password = (body.password || '').trim()
  if (!password || !(await verifyPassword(password, post.password))) {
    return NextResponse.json({ error: '密码错误，请重试' }, { status: 401 })
  }

  const token = await createPostAccessToken(post.slug, post.password)
  const response = NextResponse.json({ success: true })
  response.cookies.set(getPostAccessCookieName(post.slug), token, {
    httpOnly: true,
    path: `/${post.slug}`,
    maxAge: POST_ACCESS_COOKIE_MAX_AGE,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  return response
}
