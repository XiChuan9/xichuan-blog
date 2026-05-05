const PRIVATE_IPV4_RANGES = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
]

function isPrivateHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase()
  if (!normalized) return true
  if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.endsWith('.local')) {
    return true
  }
  const ipv6Literal = normalized.replace(/^\[/, '').replace(/\]$/, '')
  if (ipv6Literal.includes(':') && (
    ipv6Literal === '::1'
    || ipv6Literal.startsWith('fc')
    || ipv6Literal.startsWith('fd')
    || ipv6Literal.startsWith('fe80:')
  )) {
    return true
  }
  return PRIVATE_IPV4_RANGES.some((pattern) => pattern.test(normalized))
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
