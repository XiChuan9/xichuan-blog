import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  authenticateCookieRequest: vi.fn(),
  getRouteEnvWithDb: vi.fn(),
  parseJsonBody: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  getSetting: mocks.getSetting,
  setSetting: mocks.setSetting,
}))

vi.mock('@/lib/admin-auth', () => ({
  authenticateCookieRequest: mocks.authenticateCookieRequest,
}))

vi.mock('@/lib/server/route-helpers', () => ({
  getRouteEnvWithDb: mocks.getRouteEnvWithDb,
  jsonError: (message: string, status = 500) => Response.json({ error: message }, { status }),
  jsonOk: (data: unknown, status = 200) => Response.json(data, { status }),
  parseJsonBody: mocks.parseJsonBody,
}))

import { GET, POST } from '@/app/api/admin/settings/route'

describe('/api/admin/settings route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authenticateCookieRequest.mockResolvedValue(true)
    mocks.getRouteEnvWithDb.mockResolvedValue({
      ok: true,
      db: { kind: 'db' },
      env: {},
    })
  })

  it('returns a setting value for an authorized GET request', async () => {
    mocks.getSetting.mockResolvedValue('serif')

    const request = {
      nextUrl: new URL('http://test.local/api/admin/settings?key=font_mode'),
      method: 'GET',
      headers: new Headers(),
    } as never
    const response = await GET(request)
    const body = await response.json()

    expect(mocks.authenticateCookieRequest).toHaveBeenCalledWith(request, { kind: 'db' })
    expect(mocks.getSetting).toHaveBeenCalledWith({ kind: 'db' }, 'font_mode')
    expect(body).toEqual({ key: 'font_mode', value: 'serif' })
  })

  it('rejects unauthorized requests before reading from the database', async () => {
    mocks.authenticateCookieRequest.mockResolvedValue(false)

    const response = await GET({
      nextUrl: new URL('http://test.local/api/admin/settings?key=font_mode'),
      method: 'GET',
      headers: new Headers(),
    } as never)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.getSetting).not.toHaveBeenCalled()
  })

  it('stores non-string setting values as serialized JSON on POST', async () => {
    mocks.parseJsonBody.mockResolvedValue({
      key: 'appearance',
      value: { theme: 'paper', density: 'comfortable' },
    })
    const request = {
      method: 'POST',
      headers: new Headers({ Origin: 'http://test.local' }),
    } as never

    const response = await POST(request)
    const body = await response.json()

    expect(mocks.authenticateCookieRequest).toHaveBeenCalledWith(request, { kind: 'db' })
    expect(mocks.setSetting).toHaveBeenCalledWith(
      { kind: 'db' },
      'appearance',
      JSON.stringify({ theme: 'paper', density: 'comfortable' }),
    )
    expect(body).toEqual({ success: true })
  })
})
