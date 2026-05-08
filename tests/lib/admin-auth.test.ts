import { describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/lib/cloudflare', () => ({
  getAppCloudflareEnv: vi.fn(async () => ({
    ADMIN_PASSWORD_HASH: 'pbkdf2-sha256$310000$x3kzgjFiK5lyBqJzWcRiBw$2RlfH7EdM17S3HpDz5g_9hi8l6tuxuZ8Y97tFEEGskQ',
    ADMIN_TOKEN_SALT: 'unit-test-salt',
  })),
}))

import { authenticateCookieRequest, authenticateRequest, verifyApiToken, verifyPassword } from '@/lib/admin-auth'

describe('admin cookie authentication request checks', () => {
  it('rejects cross-origin cookie mutations before reading the admin cookie', async () => {
    const cookieGet = vi.fn()
    const request = {
      method: 'POST',
      url: 'https://blog.example.com/api/admin/settings',
      nextUrl: new URL('https://blog.example.com/api/admin/settings'),
      headers: new Headers({ Origin: 'https://evil.example' }),
      cookies: { get: cookieGet },
    } as unknown as NextRequest

    await expect(authenticateCookieRequest(request, {} as D1Database)).resolves.toBe(false)
    expect(cookieGet).not.toHaveBeenCalled()
  })

  it('verifies admin passwords against the configured hash', async () => {
    await expect(verifyPassword('admin-password')).resolves.toBe(true)
    await expect(verifyPassword('wrong-password')).resolves.toBe(false)
  })

  it('rejects legacy plaintext API tokens instead of upgrading them', async () => {
    const updates: Array<{ sql: string; args: unknown[] }> = []
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: vi.fn(async () => {
            if (sql.includes('SELECT id, is_active FROM api_tokens WHERE token = ?') && args[0] === 'xc_legacy_token') {
              return { id: 9, is_active: 1 }
            }
            return null
          }),
          run: vi.fn(async () => {
            updates.push({ sql, args })
          }),
        }),
      })),
    } as unknown as D1Database

    await expect(verifyApiToken(db, 'xc_legacy_token')).resolves.toBe(false)

    expect(updates).toHaveLength(0)
  })

  it('rejects bearer token mutations from untrusted browser origins', async () => {
    const request = {
      method: 'POST',
      url: 'https://blog.example.com/api/posts',
      nextUrl: new URL('https://blog.example.com/api/posts'),
      headers: new Headers({
        Authorization: 'Bearer xc_token',
        Origin: 'https://evil.example',
      }),
      cookies: { get: vi.fn() },
    } as unknown as NextRequest

    const db = {
      prepare: vi.fn(),
    } as unknown as D1Database

    await expect(authenticateRequest(request, db)).resolves.toBe(false)
    expect(db.prepare).not.toHaveBeenCalled()
  })
})
