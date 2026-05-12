import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_CUSTOM_SCRIPT_HOSTS } from '@/lib/custom-js'

function createNonce() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function getConfiguredCustomScriptHosts() {
  return (process.env.NEXT_PUBLIC_CUSTOM_SCRIPT_HOSTS || '')
    .split(',')
    .map((host) => host.trim().replace(/^https?:\/\//, '').split('/')[0])
    .filter((host) => /^[a-z0-9.-]+$/i.test(host))
}

function buildContentSecurityPolicy(nonce: string) {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : '',
    ...DEFAULT_CUSTOM_SCRIPT_HOSTS.map((host) => `https://${host}`),
    ...getConfiguredCustomScriptHosts().map((host) => `https://${host}`),
  ].filter(Boolean)

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "media-src 'self' blob: https:",
    'frame-src https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://player.vimeo.com',
    "worker-src 'self' blob:",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ')
}

// Next 16 proxy files run on the Node runtime; OpenNext Cloudflare currently
// requires edge middleware for this header path.
export function middleware(request: NextRequest) {
  const nonce = createNonce()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  response.headers.set('Content-Security-Policy', buildContentSecurityPolicy(nonce))
  return response
}

export const config = {
  matcher: [
    '/((?!api/images|_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png|apple-touch-icon.png|manifest.json|.*\\..*).*)',
  ],
}
