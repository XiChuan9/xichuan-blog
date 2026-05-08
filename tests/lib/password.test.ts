import { describe, expect, it } from 'vitest'
import {
  createPostAccessToken,
  generatePassword,
  hashPassword,
  isPasswordHash,
  preparePostPasswordForStorage,
  verifyPassword,
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

  it('hashes post passwords with a per-password salt and verifies only hashed values', async () => {
    const stored = await hashPassword('secret')
    const sameSecretAgain = await hashPassword('secret')

    expect(isPasswordHash(stored)).toBe(true)
    expect(sameSecretAgain).not.toBe(stored)
    await expect(verifyPassword('secret', stored)).resolves.toBe(true)
    await expect(verifyPassword('secret', 'secret')).resolves.toBe(false)
  })

  it('prepares post passwords for database storage without plaintext fallback', async () => {
    const prepared = await preparePostPasswordForStorage(' secret ')

    expect(typeof prepared).toBe('string')
    expect(prepared).not.toBe('secret')
    expect(isPasswordHash(prepared)).toBe(true)
    await expect(preparePostPasswordForStorage('   ')).resolves.toBeNull()
    await expect(preparePostPasswordForStorage(undefined)).resolves.toBeUndefined()
    await expect(preparePostPasswordForStorage(prepared)).resolves.toBe(prepared)
  })
})
