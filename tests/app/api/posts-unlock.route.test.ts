import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const rateLimitState = vi.hoisted(() => ({
  counts: new Map<string, number>(),
}))

const mocks = vi.hoisted(() => ({
  getAppCloudflareEnv: vi.fn(),
  getPostBySlug: vi.fn(),
  isPubliclyAccessiblePost: vi.fn(),
}))

vi.mock('@/lib/cloudflare', () => ({
  getAppCloudflareEnv: mocks.getAppCloudflareEnv,
}))

vi.mock('@/lib/db', () => ({
  getPostBySlug: mocks.getPostBySlug,
  isPubliclyAccessiblePost: mocks.isPubliclyAccessiblePost,
}))

vi.mock('@/lib/rate-limit', () => ({
  __resetRateLimitsForTests: () => rateLimitState.counts.clear(),
  getRequestIp: () => '203.0.113.9',
  checkPersistentRateLimit: async (_db: D1Database, key: string, options: { limit: number }) => {
    const count = rateLimitState.counts.get(key) || 0
    return count >= options.limit
      ? { allowed: false, remaining: 0, retryAfterSeconds: 60 }
      : { allowed: true, remaining: options.limit - count, retryAfterSeconds: 0 }
  },
  recordPersistentRateLimitFailure: async (_db: D1Database, key: string, options: { limit: number }) => {
    const count = (rateLimitState.counts.get(key) || 0) + 1
    rateLimitState.counts.set(key, count)
    return count >= options.limit
      ? { allowed: false, remaining: 0, retryAfterSeconds: 60 }
      : { allowed: true, remaining: options.limit - count, retryAfterSeconds: 0 }
  },
  clearPersistentRateLimit: async (_db: D1Database, key: string) => {
    rateLimitState.counts.delete(key)
  },
}))

import { POST } from '@/app/api/posts/[slug]/unlock/route'
import { __resetRateLimitsForTests } from '@/lib/rate-limit'
import { hashPassword } from '@/lib/password'

function createUnlockRequest(password: string) {
  return new NextRequest('https://blog.example.com/api/posts/secret-post/unlock', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  })
}

describe('/api/posts/[slug]/unlock route', () => {
  let storedPassword = ''

  beforeAll(async () => {
    storedPassword = await hashPassword('stored-password')
  })

  beforeEach(() => {
    vi.clearAllMocks()
    __resetRateLimitsForTests()
    mocks.getAppCloudflareEnv.mockResolvedValue({ DB: { kind: 'db' } })
    mocks.getPostBySlug.mockResolvedValue({
      slug: 'secret-post',
      password: storedPassword,
      status: 'published',
      is_hidden: 0,
    })
    mocks.isPubliclyAccessiblePost.mockReturnValue(true)
  })

  it('sets a scoped HttpOnly cookie after a correct password', async () => {
    const response = await POST(createUnlockRequest('stored-password'), {
      params: Promise.resolve({ slug: 'secret-post' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    const setCookie = response.headers.get('set-cookie') || ''
    expect(setCookie).toContain('xichuan-blog_post_secret-post=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Path=/secret-post')
    expect(setCookie.toLowerCase()).toContain('samesite=lax')
  })

  it('rejects incorrect passwords without setting access cookies', async () => {
    const response = await POST(createUnlockRequest('wrong-password'), {
      params: Promise.resolve({ slug: 'secret-post' }),
    })

    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toBeNull()
    await expect(response.json()).resolves.toEqual({ error: '密码错误，请重试' })
  })

  it('rate limits repeated incorrect unlock attempts', async () => {
    let response: Response | null = null

    for (let i = 0; i < 8; i += 1) {
      response = await POST(createUnlockRequest('wrong-password'), {
        params: Promise.resolve({ slug: 'secret-post' }),
      })
    }

    expect(response).not.toBeNull()
    expect(response!.status).toBe(429)
    expect(response!.headers.get('retry-after')).toBeTruthy()
    await expect(response!.json()).resolves.toEqual({ error: '请求过于频繁，请稍后再试' })
  })
})
