const DEFAULT_CUSTOM_SCRIPT_HOSTS = [
  'www.googletagmanager.com',
  'www.google-analytics.com',
  'ssl.google-analytics.com',
  'hm.baidu.com',
  'zz.bdstatic.com',
  'hmcdn.baidu.com',
  'plausible.io',
  'cloud.umami.is',
  'analytics.umami.is',
  'cdn.usefathom.com',
  'static.cloudflareinsights.com',
  'static.hotjar.com',
  'script.hotjar.com',
  'js.hs-scripts.com',
  'cdn.segment.com',
]

function getConfiguredCustomScriptHosts() {
  return (process.env.NEXT_PUBLIC_CUSTOM_SCRIPT_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0])
    .filter((host) => /^[a-z0-9.-]+$/i.test(host))
}

function isAllowedHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase()
  return [...DEFAULT_CUSTOM_SCRIPT_HOSTS, ...getConfiguredCustomScriptHosts()].some((allowed) => (
    normalized === allowed || normalized.endsWith(`.${allowed}`)
  ))
}

function extractScriptSrcValues(code: string): string[] {
  const sources: string[] = []
  const scriptTagPattern = /<script\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>\s*<\/script\s*>/gi
  let match: RegExpExecArray | null

  while ((match = scriptTagPattern.exec(code)) !== null) {
    const src = match[1] || match[2] || match[3]
    if (src) sources.push(src)
  }

  for (const line of code.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (/^https:\/\/[^\s"'<>]+$/i.test(trimmed)) {
      sources.push(trimmed)
    }
  }

  return sources
}

export function getSafeCustomScriptSources(code: string): string[] {
  const unique = new Set<string>()

  for (const src of extractScriptSrcValues(code)) {
    try {
      const url = new URL(src)
      if (url.protocol !== 'https:' || url.username || url.password || !isAllowedHostname(url.hostname)) {
        continue
      }
      unique.add(url.toString())
    } catch {
      continue
    }
  }

  return [...unique].slice(0, 10)
}
