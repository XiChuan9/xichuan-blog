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

interface PersistentRateLimitRow {
  count: number
  reset_at: number
  blocked_until: number
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

async function ensureRateLimitTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      reset_at INTEGER NOT NULL,
      blocked_until INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    )
  `).run()
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(reset_at, blocked_until)').run()
}

async function readPersistentEntry(db: D1Database, key: string): Promise<RateLimitEntry | undefined> {
  const row = await db
    .prepare('SELECT count, reset_at, blocked_until FROM rate_limits WHERE key = ?')
    .bind(key)
    .first<PersistentRateLimitRow>()

  if (!row) return undefined
  return {
    count: row.count,
    resetAt: row.reset_at,
    blockedUntil: row.blocked_until,
  }
}

async function writePersistentEntry(db: D1Database, key: string, entry: RateLimitEntry, currentTime: number) {
  await db.prepare(`
    INSERT INTO rate_limits (key, count, reset_at, blocked_until, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      count = excluded.count,
      reset_at = excluded.reset_at,
      blocked_until = excluded.blocked_until,
      updated_at = excluded.updated_at
  `).bind(key, entry.count, entry.resetAt, entry.blockedUntil, currentTime).run()
}

async function cleanupPersistentExpired(db: D1Database, currentTime: number) {
  operationCount += 1
  if (operationCount % 256 !== 0) return

  await db
    .prepare('DELETE FROM rate_limits WHERE reset_at <= ? AND blocked_until <= ?')
    .bind(currentTime, currentTime)
    .run()
}

function evaluateRateLimitEntry(entry: RateLimitEntry | undefined, options: RateLimitOptions, currentTime: number) {
  if (!entry) return createAllowedResult(undefined, options)

  if (entry.blockedUntil > currentTime) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: toRetryAfterSeconds(entry.blockedUntil, currentTime),
    }
  }

  if (entry.resetAt <= currentTime) {
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

export async function checkPersistentRateLimit(
  db: D1Database,
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const currentTime = now()
  await ensureRateLimitTable(db)
  await cleanupPersistentExpired(db, currentTime)
  const entry = await readPersistentEntry(db, key)
  return evaluateRateLimitEntry(entry, options, currentTime)
}

export async function recordPersistentRateLimitFailure(
  db: D1Database,
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const currentTime = now()
  await ensureRateLimitTable(db)
  await cleanupPersistentExpired(db, currentTime)

  const existing = await readPersistentEntry(db, key)
  const entry: RateLimitEntry = !existing || existing.resetAt <= currentTime
    ? {
        count: 1,
        resetAt: currentTime + options.windowMs,
        blockedUntil: 0,
      }
    : {
        ...existing,
        count: existing.count + 1,
      }

  if (entry.count >= options.limit) {
    entry.blockedUntil = currentTime + (options.blockMs ?? options.windowMs)
  }

  await writePersistentEntry(db, key, entry, currentTime)
  return evaluateRateLimitEntry(entry, options, currentTime)
}

export async function consumePersistentRateLimit(
  db: D1Database,
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const currentTime = now()
  await ensureRateLimitTable(db)
  await cleanupPersistentExpired(db, currentTime)

  const existing = await readPersistentEntry(db, key)
  const checked = evaluateRateLimitEntry(existing, options, currentTime)
  if (!checked.allowed) return checked

  const entry: RateLimitEntry = !existing || existing.resetAt <= currentTime
    ? {
        count: 1,
        resetAt: currentTime + options.windowMs,
        blockedUntil: 0,
      }
    : {
        ...existing,
        count: existing.count + 1,
      }

  await writePersistentEntry(db, key, entry, currentTime)
  return evaluateRateLimitEntry(entry, options, currentTime)
}

export async function clearPersistentRateLimit(db: D1Database, key: string) {
  await ensureRateLimitTable(db)
  await db.prepare('DELETE FROM rate_limits WHERE key = ?').bind(key).run()
}

export function __resetRateLimitsForTests() {
  attempts.clear()
  operationCount = 0
}
