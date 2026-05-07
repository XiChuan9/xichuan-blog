import { describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/lib/cloudflare', () => ({
  getAppCloudflareEnv: vi.fn(async () => ({
    ADMIN_PASSWORD: 'admin-password',
    ADMIN_TOKEN_SALT: 'unit-test-salt',
  })),
}))

import { authenticateCookieRequest, verifyApiToken } from '@/lib/admin-auth'

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

  it('accepts legacy plaintext API tokens once and upgrades them to hashes', async () => {
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

    await expect(verifyApiToken(db, 'xc_legacy_token')).resolves.toBe(true)

    expect(updates).toHaveLength(1)
    expect(updates[0].sql).toContain('SET token = ?')
    expect(updates[0].args[0]).not.toBe('xc_legacy_token')
    expect(updates[0].args[1]).toBe('xc_legacy_...')
    expect(updates[0].args[2]).toBe(9)
  })
})
