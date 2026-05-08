import { hashSecret, verifySecret, isPasswordHash } from '@/lib/secure-password'
export { isPasswordHash } from '@/lib/secure-password'

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const SYMBOLS = 'abcdefghijkmnopqrstuvwxyz'
const TOKEN_CHARS = `${LETTERS}${SYMBOLS}${DIGITS}`

function randomIndex(max: number): number {
  const buffer = new Uint32Array(1)
  const limit = Math.floor(0x100000000 / max) * max

  do {
    crypto.getRandomValues(buffer)
  } while (buffer[0] >= limit)

  return buffer[0] % max
}

function randomChar(source: string): string {
  return source.charAt(randomIndex(source.length))
}

function shuffle(chars: string[]): string[] {
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars
}

// 生成 16 位字母数字混合访问码（至少包含 2 个字母和 2 个数字）
export function generatePassword(): string {
  const chars = [
    randomChar(LETTERS),
    randomChar(LETTERS),
    randomChar(DIGITS),
    randomChar(DIGITS),
    ...Array.from({ length: 12 }, () => randomChar(TOKEN_CHARS)),
  ]
  return shuffle(chars).join('')
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(password: string): Promise<string> {
  return hashSecret(password)
}

export async function verifyPassword(input: string, stored: string): Promise<boolean> {
  return verifySecret(input, stored)
}

export async function preparePostPasswordForStorage(
  password: string | null | undefined,
): Promise<string | null | undefined> {
  if (password === undefined) return undefined
  if (password === null) return null

  const trimmed = password.trim()
  if (!trimmed) return null
  if (isPasswordHash(trimmed)) return trimmed

  return hashPassword(trimmed)
}

export function getPostAccessCookieName(slug: string): string {
  const safeSlug = slug.trim().replace(/[^a-z0-9_-]+/gi, '_').slice(0, 80) || 'post'
  return `xichuan-blog_post_${safeSlug}`
}

export const POST_ACCESS_COOKIE_MAX_AGE = 60 * 60 * 12 // 12 小时

export async function createPostAccessToken(slug: string, storedPassword: string): Promise<string> {
  return sha256Hex(`post-access:${slug}:${storedPassword}`)
}

export async function verifyPostAccessToken(
  slug: string,
  storedPassword: string,
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false
  return token === await createPostAccessToken(slug, storedPassword)
}
