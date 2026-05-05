import { describe, expect, it } from 'vitest'
import {
  createPostAccessToken,
  generatePassword,
  verifyPostAccessToken,
} from '@/lib/password'

describe('password helpers', () => {
  it('generates 16-character access codes with required entropy classes', () => {
    const password = generatePassword()

    expect(password).toMatch(/^[A-HJ-NP-Za-km-z2-9]{16}$/)
    expect((password.match(/[A-HJ-NP-Z]/g) || []).length).toBeGreaterThanOrEqual(2)
    expect((password.match(/[2-9]/g) || []).length).toBeGreaterThanOrEqual(2)
  })

  it('scopes post access tokens to the slug and stored password', async () => {
    const token = await createPostAccessToken('secret-post', 'stored-password')

    await expect(verifyPostAccessToken('secret-post', 'stored-password', token)).resolves.toBe(true)
    await expect(verifyPostAccessToken('other-post', 'stored-password', token)).resolves.toBe(false)
    await expect(verifyPostAccessToken('secret-post', 'different-password', token)).resolves.toBe(false)
  })
})
