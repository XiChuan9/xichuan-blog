import { afterEach, describe, expect, it } from 'vitest'
import { resolveAiConfigSecret } from '@/lib/ai-provider-profiles'

describe('AI provider profile secrets', () => {
  const originalSecret = process.env.AI_CONFIG_ENCRYPTION_SECRET

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.AI_CONFIG_ENCRYPTION_SECRET
    } else {
      process.env.AI_CONFIG_ENCRYPTION_SECRET = originalSecret
    }
  })

  it('requires an explicit encryption secret', () => {
    delete process.env.AI_CONFIG_ENCRYPTION_SECRET

    expect(() => resolveAiConfigSecret({ ADMIN_TOKEN_SALT: 'salt-only' })).toThrow(
      'AI_CONFIG_ENCRYPTION_SECRET is required',
    )
  })

  it('prefers the runtime encryption secret over process env', () => {
    process.env.AI_CONFIG_ENCRYPTION_SECRET = 'process-secret'

    expect(resolveAiConfigSecret({ AI_CONFIG_ENCRYPTION_SECRET: ' runtime-secret ' })).toBe('runtime-secret')
  })
})
