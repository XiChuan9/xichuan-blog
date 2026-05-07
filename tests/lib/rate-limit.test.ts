import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  __resetRateLimitsForTests,
  checkRateLimit,
  clearRateLimit,
  getRequestIp,
  recordRateLimitFailure,
} from '@/lib/rate-limit'

describe('rate limit helpers', () => {
  afterEach(() => {
    vi.useRealTimers()
    __resetRateLimitsForTests()
  })

  it('blocks a key after the configured number of failures', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T00:00:00Z'))
    const options = { limit: 2, windowMs: 60_000, blockMs: 120_000 }

    expect(checkRateLimit('login:1', options).allowed).toBe(true)
    expect(recordRateLimitFailure('login:1', options).allowed).toBe(true)

    const blocked = recordRateLimitFailure('login:1', options)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBe(120)
    expect(checkRateLimit('login:1', options).allowed).toBe(false)
  })

  it('clears a key after a successful authentication', () => {
    const options = { limit: 2, windowMs: 60_000 }

    recordRateLimitFailure('unlock:1', options)
    clearRateLimit('unlock:1')

    expect(checkRateLimit('unlock:1', options)).toEqual({
      allowed: true,
      remaining: 2,
      retryAfterSeconds: 0,
    })
  })

  it('extracts the connecting IP from trusted forwarding headers', () => {
    expect(getRequestIp(new Headers({ 'cf-connecting-ip': '203.0.113.7' }))).toBe('203.0.113.7')
    expect(getRequestIp(new Headers({ 'x-forwarded-for': '198.51.100.3, 10.0.0.1' }))).toBe('198.51.100.3')
    expect(getRequestIp(new Headers())).toBe('unknown')
  })
})
