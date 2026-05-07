export interface RateLimitOptions {
  limit: number
  windowMs: number
  blockMs?: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

interface RateLimitEntry {
  count: number
  resetAt: number
  blockedUntil: number
}

const attempts = new Map<string, RateLimitEntry>()
let operationCount = 0

function now() {
  return Date.now()
}

function toRetryAfterSeconds(targetTime: number, currentTime: number) {
  return Math.max(1, Math.ceil((targetTime - currentTime) / 1000))
}

function cleanupExpired(currentTime: number) {
  operationCount += 1
  if (operationCount % 256 !== 0) return

  for (const [key, entry] of attempts) {
    if (entry.resetAt <= currentTime && entry.blockedUntil <= currentTime) {
      attempts.delete(key)
    }
  }
}

function createAllowedResult(entry: RateLimitEntry | undefined, options: RateLimitOptions): RateLimitResult {
  const remaining = Math.max(0, options.limit - (entry?.count ?? 0))
  return { allowed: true, remaining, retryAfterSeconds: 0 }
}

export function getRequestIp(headers: Headers) {
  const forwardedFor = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const candidate =
    headers.get('cf-connecting-ip')
    || headers.get('true-client-ip')
    || headers.get('x-real-ip')
    || forwardedFor
    || 'unknown'

  return candidate.trim().slice(0, 128) || 'unknown'
}

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const currentTime = now()
  cleanupExpired(currentTime)

  const entry = attempts.get(key)
  if (!entry) return createAllowedResult(undefined, options)

  if (entry.blockedUntil > currentTime) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: toRetryAfterSeconds(entry.blockedUntil, currentTime),
    }
  }

  if (entry.resetAt <= currentTime) {
    attempts.delete(key)
    return createAllowedResult(undefined, options)
  }

  if (entry.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: toRetryAfterSeconds(entry.resetAt, currentTime),
    }
  }

  return createAllowedResult(entry, options)
}

export function recordRateLimitFailure(key: string, options: RateLimitOptions): RateLimitResult {
  const currentTime = now()
  cleanupExpired(currentTime)

  let entry = attempts.get(key)
  if (!entry || entry.resetAt <= currentTime) {
    entry = {
      count: 0,
      resetAt: currentTime + options.windowMs,
      blockedUntil: 0,
    }
  }

  entry.count += 1

  if (entry.count >= options.limit) {
    entry.blockedUntil = currentTime + (options.blockMs ?? options.windowMs)
  }

  attempts.set(key, entry)
  return checkRateLimit(key, options)
}

export function clearRateLimit(key: string) {
  attempts.delete(key)
}

export function __resetRateLimitsForTests() {
  attempts.clear()
  operationCount = 0
}
