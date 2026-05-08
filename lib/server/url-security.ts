const PRIVATE_IPV4_RANGES = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
]

const REBINDING_TEST_DOMAINS = [
  'nip.io',
  'sslip.io',
  'xip.io',
  'localtest.me',
  'localhost.direct',
  'lvh.me',
]

function parseIPv4Address(hostname: string): string | null {
  if (/^\d+$/.test(hostname)) {
    const value = Number(hostname)
    if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) return null
    return [
      (value >>> 24) & 255,
      (value >>> 16) & 255,
      (value >>> 8) & 255,
      value & 255,
    ].join('.')
  }

  const parts = hostname.split('.')
  if (parts.length > 4 || parts.some((part) => part === '')) return null

  const parsed = parts.map((part) => {
    const value = Number(part)
    return Number.isInteger(value) && value >= 0 && value <= 255 ? value : null
  })
  if (parsed.some((part) => part === null)) return null

  while (parsed.length < 4) parsed.splice(parsed.length - 1, 0, 0)
  return parsed.join('.')
}

function parseIPv4MappedIPv6(value: string): string | null {
  const match = value.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (!match) return null

  const high = Number.parseInt(match[1], 16)
  const low = Number.parseInt(match[2], 16)
  if (!Number.isFinite(high) || !Number.isFinite(low)) return null

  return [
    (high >>> 8) & 255,
    high & 255,
    (low >>> 8) & 255,
    low & 255,
  ].join('.')
}

function isPrivateHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase()
  if (!normalized) return true
  if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.endsWith('.local')) {
    return true
  }
  if (REBINDING_TEST_DOMAINS.some((domain) => normalized === domain || normalized.endsWith(`.${domain}`))) {
    return true
  }
  const ipv6Literal = normalized.replace(/^\[/, '').replace(/\]$/, '')
  const ipv4Mapped = parseIPv4MappedIPv6(ipv6Literal)
  if (ipv4Mapped && PRIVATE_IPV4_RANGES.some((pattern) => pattern.test(ipv4Mapped))) {
    return true
  }
  if (ipv6Literal.includes(':') && (
    ipv6Literal === '::1'
    || ipv6Literal.startsWith('::ffff:127.')
    || ipv6Literal.startsWith('::ffff:10.')
    || ipv6Literal.startsWith('::ffff:192.168.')
    || /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(ipv6Literal)
    || ipv6Literal.startsWith('fc')
    || ipv6Literal.startsWith('fd')
    || ipv6Literal.startsWith('fe80:')
  )) {
    return true
  }
  const ipv4 = parseIPv4Address(normalized)
  return Boolean(ipv4 && PRIVATE_IPV4_RANGES.some((pattern) => pattern.test(ipv4)))
}

export function normalizeSafeProviderBaseUrl(input: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = input.trim()
  if (!trimmed) return { ok: false, error: 'Base URL 不能为空' }

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return { ok: false, error: 'Base URL 必须是有效 URL' }
  }

  if (url.protocol !== 'https:') {
    return { ok: false, error: 'Base URL 必须使用 https' }
  }
  if (url.username || url.password) {
    return { ok: false, error: 'Base URL 不能包含用户名或密码' }
  }
  if (isPrivateHostname(url.hostname)) {
    return { ok: false, error: 'Base URL 不能指向 localhost、内网或链路本地地址' }
  }

  url.hash = ''
  url.search = ''
  return { ok: true, url: url.toString().replace(/\/+$/, '') }
}

export function normalizeSafeRemoteFetchUrl(
  input: string,
  baseOrigin: string,
): { ok: true; url: string } | { ok: false; error: string } {
  let url: URL
  try {
    url = new URL(input, baseOrigin)
  } catch {
    return { ok: false, error: 'URL 无效' }
  }

  if (url.origin === baseOrigin) {
    url.hash = ''
    return { ok: true, url: url.toString() }
  }

  if (url.protocol !== 'https:') {
    return { ok: false, error: '远程 URL 必须使用 https' }
  }
  if (url.username || url.password || isPrivateHostname(url.hostname)) {
    return { ok: false, error: '远程 URL 不能指向内网或包含凭据' }
  }

  url.hash = ''
  return { ok: true, url: url.toString() }
}
