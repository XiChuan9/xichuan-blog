import { describe, expect, it } from 'vitest'
import { getSafeCustomScriptSources } from '@/lib/custom-js'

describe('custom JS sanitizer', () => {
  it('keeps only trusted HTTPS external script sources', () => {
    const sources = getSafeCustomScriptSources(`
      <script>alert(1)</script>
      <script src="https://www.googletagmanager.com/gtag/js?id=G-TEST"></script>
      <script src="http://www.google-analytics.com/analytics.js"></script>
      <script src="https://evil.example/x.js"></script>
      https://static.cloudflareinsights.com/beacon.min.js
    `)

    expect(sources).toEqual([
      'https://www.googletagmanager.com/gtag/js?id=G-TEST',
      'https://static.cloudflareinsights.com/beacon.min.js',
    ])
  })
})
