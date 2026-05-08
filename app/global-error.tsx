'use client'

import Link from 'next/link'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body>
        <main style={{ maxWidth: 640, margin: '0 auto', padding: '20vh 24px', fontFamily: 'system-ui, sans-serif' }}>
          <p style={{ margin: 0, color: '#666', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Error</p>
          <h1 style={{ margin: '12px 0 0', fontSize: 32 }}>Something went wrong</h1>
          <p style={{ margin: '16px 0 0', color: '#666', lineHeight: 1.6 }}>
            The application failed to render. Try again, or return to the homepage.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
            <button type="button" onClick={reset} style={{ padding: '10px 14px', fontWeight: 600 }}>
              Try again
            </button>
            <Link href="/" style={{ padding: '10px 14px', fontWeight: 600 }}>
              Home
            </Link>
          </div>
        </main>
      </body>
    </html>
  )
}
