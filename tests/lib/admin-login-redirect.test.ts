import { describe, expect, it } from 'vitest'
import { resolveAdminLoginRedirectPath } from '@/lib/admin-login-redirect'

describe('admin login redirect', () => {
  const origin = 'https://blog.example.com'

  it('keeps same-origin admin and editor paths', () => {
    expect(resolveAdminLoginRedirectPath('/admin', origin)).toBe('/admin')
    expect(resolveAdminLoginRedirectPath('/editor?edit=post-slug#meta', origin))
      .toBe('/editor?edit=post-slug#meta')
  })

  it('rejects external and protocol-relative redirects', () => {
    expect(resolveAdminLoginRedirectPath('https://evil.example/phish', origin)).toBe('/admin')
    expect(resolveAdminLoginRedirectPath('//evil.example/phish', origin)).toBe('/admin')
    expect(resolveAdminLoginRedirectPath('\\evil.example\\phish', origin)).toBe('/admin')
    expect(resolveAdminLoginRedirectPath('/\\evil.example\\phish', origin)).toBe('/admin')
  })

  it('rejects non-path values', () => {
    expect(resolveAdminLoginRedirectPath('editor', origin)).toBe('/admin')
    expect(resolveAdminLoginRedirectPath('', origin)).toBe('/admin')
    expect(resolveAdminLoginRedirectPath(null, origin)).toBe('/admin')
  })
})
