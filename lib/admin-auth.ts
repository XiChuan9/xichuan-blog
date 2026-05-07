// 管理后台鉴权工具
// 密码存储在服务端，不暴露给客户端

import { nanoid } from 'nanoid'
import { NextRequest } from 'next/server'
import { getAppCloudflareEnv } from '@/lib/cloudflare'

interface AdminAuthConfig {
  password: string
  salt: string
}

async function getAdminAuthConfig(): Promise<AdminAuthConfig> {
  let envPassword = ''
  let envSalt = ''

  try {
    const env = await getAppCloudflareEnv()
    envPassword = env?.ADMIN_PASSWORD?.trim() || ''
    envSalt = env?.ADMIN_TOKEN_SALT?.trim() || ''
  } catch {}

  return {
    password: envPassword || process.env.ADMIN_PASSWORD?.trim() || '',
    salt: envSalt || process.env.ADMIN_TOKEN_SALT?.trim() || '',
  }
}

export async function getAdminAuthConfigError(): Promise<string | null> {
  const { password, salt } = await getAdminAuthConfig()
  const missing: string[] = []

  if (!password) missing.push('ADMIN_PASSWORD')
  if (!salt) missing.push('ADMIN_TOKEN_SALT')

  if (missing.length === 0) return null
  return `管理员鉴权未配置完成：缺少 ${missing.join('、')}`
}

export async function isAdminAuthConfigured(): Promise<boolean> {
  return (await getAdminAuthConfigError()) === null
}

export const COOKIE_NAME = 'xichuan-blog_admin'
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 天
const SESSION_TOKEN_PREFIX = 'qms_'

interface AdminSessionRow {
  expires_at: number
  revoked_at: number | null
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function hashSessionToken(token: string): Promise<string> {
  const { salt } = await getAdminAuthConfig()
  return sha256Hex(`session:${salt}:${token}`)
}

export async function hashApiToken(token: string): Promise<string> {
  const { salt } = await getAdminAuthConfig()
  return sha256Hex(`api:${salt}:${token}`)
}

async function ensureAdminSessionsTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT UNIQUE NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER,
      user_agent TEXT NOT NULL DEFAULT ''
    )
  `).run()
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions(token_hash)').run()
}

export async function createAdminSession(
  db: D1Database,
  options: { userAgent?: string } = {},
): Promise<string> {
  await ensureAdminSessionsTable(db)

  const token = `${SESSION_TOKEN_PREFIX}${nanoid(48)}`
  const tokenHash = await hashSessionToken(token)
  const expiresAt = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE

  await db.prepare(`
    INSERT INTO admin_sessions (token_hash, expires_at, user_agent)
    VALUES (?, ?, ?)
  `).bind(tokenHash, expiresAt, (options.userAgent || '').slice(0, 300)).run()

  return token
}

export async function revokeAdminSession(db: D1Database, cookieValue: string | undefined) {
  if (!cookieValue?.startsWith(SESSION_TOKEN_PREFIX)) return

  await ensureAdminSessionsTable(db)
  const tokenHash = await hashSessionToken(cookieValue)
  await db.prepare(`
    UPDATE admin_sessions
    SET revoked_at = strftime('%s', 'now')
    WHERE token_hash = ?
  `).bind(tokenHash).run()
}

/**
 * 生成会话 token（SHA-256 of password+salt）
 * 同一实例永远返回相同值，可安全用于 cookie 比对
 */
export async function getSessionToken(): Promise<string> {
  const { password, salt } = await getAdminAuthConfig()
  if (!password || !salt) return ''

  const encoder = new TextEncoder()
  const data = encoder.encode(`${password}:${salt}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 校验密码是否正确 */
export async function verifyPassword(password: string): Promise<boolean> {
  const config = await getAdminAuthConfig()
  return Boolean(config.password) && password === config.password
}

/** 从请求 cookie 中校验 admin 会话 */
export async function isAdminAuthenticated(
  cookieValue: string | undefined,
  db?: D1Database,
): Promise<boolean> {
  if (!cookieValue) return false

  if (cookieValue.startsWith(SESSION_TOKEN_PREFIX)) {
    if (!db) return false

    try {
      await ensureAdminSessionsTable(db)
      const tokenHash = await hashSessionToken(cookieValue)
      const row = await db
        .prepare('SELECT expires_at, revoked_at FROM admin_sessions WHERE token_hash = ?')
        .bind(tokenHash)
        .first<AdminSessionRow>()

      const now = Math.floor(Date.now() / 1000)
      return Boolean(row && !row.revoked_at && row.expires_at > now)
    } catch {
      return false
    }
  }

  // Legacy sessions were deterministic SHA-256(password:salt). They remain
  // readable for local migration only when a DB-backed session table is absent.
  if (db) return false
  const expected = await getSessionToken()
  return Boolean(expected) && cookieValue === expected
}

// ── API Token 认证 ──

/** 生成 API Token（xc_ 前缀 + 32 位 nanoid） */
export function generateApiToken(): string {
  return `xc_${nanoid(32)}`
}

interface ApiTokenRow {
  id: number
  is_active: number
}

async function markApiTokenUsed(db: D1Database, id: number) {
  await db.prepare("UPDATE api_tokens SET last_used_at = strftime('%s', 'now') WHERE id = ?")
    .bind(id)
    .run()
}

/** 验证 API Token（查询数据库，更新 last_used_at） */
export async function verifyApiToken(db: D1Database, token: string): Promise<boolean> {
  if (!token || !token.startsWith('xc_')) return false
  try {
    const tokenHash = await hashApiToken(token)
    const row = await db
      .prepare('SELECT id, is_active FROM api_tokens WHERE token = ?')
      .bind(tokenHash)
      .first<ApiTokenRow>()
    if (row?.is_active) {
      markApiTokenUsed(db, row.id).catch(() => {})
      return true
    }

    const legacyRow = await db
      .prepare('SELECT id, is_active FROM api_tokens WHERE token = ?')
      .bind(token)
      .first<ApiTokenRow>()
    if (!legacyRow?.is_active) return false

    const tokenPreview = `${token.slice(0, 10)}...`
    db.prepare(`
      UPDATE api_tokens
      SET token = ?,
          token_preview = COALESCE(NULLIF(token_preview, ''), ?),
          last_used_at = strftime('%s', 'now')
      WHERE id = ?
    `).bind(tokenHash, tokenPreview, legacyRow.id).run().catch(() => {
      markApiTokenUsed(db, legacyRow.id).catch(() => {})
    })
    return true
  } catch {
    return false
  }
}

/**
 * 统一认证：Cookie OR Bearer Token
 * 优先检查 Bearer Token，降级到 Cookie
 */
export async function authenticateRequest(
  req: NextRequest,
  db?: D1Database
): Promise<boolean> {
  // 1. 先检查 Bearer Token
  const authHeader = req.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ') && db) {
    const token = authHeader.slice(7)
    return await verifyApiToken(db, token)
  }
  // 2. 降级到 Cookie
  return authenticateCookieRequest(req, db)
}

/**
 * Cookie-only admin authentication.
 * Use this for admin-management routes where Bearer API tokens must not be
 * able to create more credentials or mutate dashboard-only settings.
 */
export async function authenticateCookieRequest(
  req: NextRequest,
  db?: D1Database,
): Promise<boolean> {
  if (!isSafeCookieMutationRequest(req)) return false
  const cookieValue = req.cookies?.get(COOKIE_NAME)?.value
  return await isAdminAuthenticated(cookieValue, db)
}

function isUnsafeMethod(method: string) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())
}

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return ''
  try {
    return new URL(value).origin
  } catch {
    return ''
  }
}

function getAllowedOrigins(req: NextRequest) {
  const origins = new Set<string>()
  const requestOrigin = normalizeOrigin(req.nextUrl?.origin || req.url)
  if (requestOrigin) origins.add(requestOrigin)
  const configured = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL)
  if (configured) origins.add(configured)
  return origins
}

function isSafeCookieMutationRequest(req: NextRequest) {
  if (!isUnsafeMethod(req.method)) return true

  const allowed = getAllowedOrigins(req)
  const origin = normalizeOrigin(req.headers.get('Origin'))
  if (origin) return allowed.has(origin)

  const referer = normalizeOrigin(req.headers.get('Referer'))
  if (referer) return allowed.has(referer)

  // Some server-to-server and test clients omit both headers. SameSite=Lax
  // still protects ordinary browser form posts; explicit cross-origin headers
  // are rejected above.
  return true
}
