import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { __resetRateLimitsForTests } from '@/lib/rate-limit'

const rateLimitState = vi.hoisted(() => ({
  counts: new Map<string, number>(),
}))

const mocks = vi.hoisted(() => ({
  createAdminSession: vi.fn(),
  getAdminAuthConfigError: vi.fn(),
  getRouteEnvWithDb: vi.fn(),
  verifyPassword: vi.fn(),
}))

vi.mock('@/lib/admin-auth', () => ({
  COOKIE_MAX_AGE: 60,
  COOKIE_NAME: 'xichuan-blog_admin',
  createAdminSession: mocks.createAdminSession,
  getAdminAuthConfigError: mocks.getAdminAuthConfigError,
  verifyPassword: mocks.verifyPassword,
}))

vi.mock('@/lib/server/route-helpers', () => ({
  getRouteEnvWithDb: mocks.getRouteEnvWithDb,
  jsonRateLimitError: (retryAfterSeconds: number, message = '请求过于频繁，请稍后再试') => {
    const response = Response.json({ error: message }, { status: 429 })
    response.headers.set('Retry-After', String(retryAfterSeconds))
    return response
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  __resetRateLimitsForTests: () => rateLimitState.counts.clear(),
  getRequestIp: (headers: Headers) => headers.get('cf-connecting-ip') || 'unknown',
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

import { POST } from '@/app/api/admin/login/route'

function createLoginRequest(password: string, ip = '203.0.113.9') {
  return new NextRequest('https://blog.example.com/api/admin/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': ip,
    },
    body: JSON.stringify({ password }),
  })
}

describe('/api/admin/login route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetRateLimitsForTests()
    mocks.getAdminAuthConfigError.mockResolvedValue(null)
    mocks.getRouteEnvWithDb.mockResolvedValue({
      ok: true,
      db: { kind: 'db' },
      env: {},
    })
    mocks.createAdminSession.mockResolvedValue('session-token')
  })

  it('sets an HttpOnly admin cookie after a valid password', async () => {
    mocks.verifyPassword.mockResolvedValue(true)

    const response = await POST(createLoginRequest('admin-password'))

    expect(response.status).toBe(200)
    expect(mocks.createAdminSession).toHaveBeenCalledWith(
      { kind: 'db' },
      expect.objectContaining({ userAgent: '' }),
    )
    const setCookie = response.headers.get('set-cookie') || ''
    expect(setCookie).toContain('xichuan-blog_admin=session-token')
    expect(setCookie).toContain('HttpOnly')
  })

  it('rate limits repeated invalid password attempts', async () => {
    mocks.verifyPassword.mockResolvedValue(false)
    let response: Response | null = null

    for (let i = 0; i < 8; i += 1) {
      response = await POST(createLoginRequest('wrong-password'))
    }

    expect(response).not.toBeNull()
    expect(response!.status).toBe(429)
    expect(response!.headers.get('retry-after')).toBeTruthy()
    await expect(response!.json()).resolves.toEqual({ error: '请求过于频繁，请稍后再试' })
  })
})
