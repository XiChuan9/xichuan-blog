export const PASSWORD_HASH_ALGORITHM = 'pbkdf2-sha256'
export const PASSWORD_HASH_PREFIX = `${PASSWORD_HASH_ALGORITHM}$`
export const DEFAULT_PASSWORD_HASH_ITERATIONS = 310000
const SALT_BYTES = 16
const HASH_BYTES = 32

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlToBytes(value: string): Uint8Array | null {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
    const binary = atob(padded)
    return Uint8Array.from(binary, (char) => char.charCodeAt(0))
  } catch {
    return null
  }
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  const maxLength = Math.max(a.length, b.length)
  let diff = a.length ^ b.length

  for (let i = 0; i < maxLength; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  }

  return diff === 0
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: toArrayBuffer(salt),
      iterations,
    },
    key,
    HASH_BYTES * 8,
  )
  return new Uint8Array(bits)
}

export function isPasswordHash(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith(PASSWORD_HASH_PREFIX)
}

export async function hashSecret(
  password: string,
  options: { iterations?: number } = {},
): Promise<string> {
  const iterations = options.iterations ?? DEFAULT_PASSWORD_HASH_ITERATIONS
  const salt = new Uint8Array(SALT_BYTES)
  crypto.getRandomValues(salt)
  const hash = await pbkdf2(password, salt, iterations)
  return [
    PASSWORD_HASH_ALGORITHM,
    String(iterations),
    bytesToBase64Url(salt),
    bytesToBase64Url(hash),
  ].join('$')
}

export async function verifySecret(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$')
  if (parts.length !== 4 || parts[0] !== PASSWORD_HASH_ALGORITHM) return false

  const iterations = Number.parseInt(parts[1], 10)
  if (!Number.isSafeInteger(iterations) || iterations < 100000) return false

  const salt = base64UrlToBytes(parts[2])
  const expected = base64UrlToBytes(parts[3])
  if (!salt || !expected || salt.length < SALT_BYTES || expected.length !== HASH_BYTES) return false

  const actual = await pbkdf2(password, salt, iterations)
  return constantTimeEqual(actual, expected)
}
