import { describe, expect, it } from 'vitest'
import {
  normalizeSafeProviderBaseUrl,
  normalizeSafeRemoteFetchUrl,
} from '@/lib/server/url-security'
import { normalizeWechatBridgeBaseUrl } from '@/lib/wechat-bridge-config'

describe('url security helpers', () => {
  it('normalizes public HTTPS provider base URLs', () => {
    expect(normalizeSafeProviderBaseUrl('https://api.example.com/v1/?token=leak#frag')).toEqual({
      ok: true,
      url: 'https://api.example.com/v1',
    })
    expect(normalizeSafeProviderBaseUrl('https://fda.gov/openai')).toEqual({
      ok: true,
      url: 'https://fda.gov/openai',
    })
  })

  it('rejects provider URLs that can reach local or credentialed targets', () => {
    for (const input of [
      'http://api.example.com/v1',
      'https://user:pass@api.example.com/v1',
      'https://localhost/v1',
      'https://127.0.0.1/v1',
      'https://10.0.0.7/v1',
      'https://172.20.0.7/v1',
      'https://192.168.1.7/v1',
      'https://[::1]/v1',
      'https://[fd00::1]/v1',
      'https://metadata.google.internal.local/v1',
    ]) {
      expect(normalizeSafeProviderBaseUrl(input).ok, input).toBe(false)
    }
  })

  it('allows same-origin reference assets but blocks unsafe remote fetches', () => {
    expect(normalizeSafeRemoteFetchUrl('/api/images/image/a.webp#preview', 'https://blog.example.com')).toEqual({
      ok: true,
      url: 'https://blog.example.com/api/images/image/a.webp',
    })
    expect(normalizeSafeRemoteFetchUrl('https://assets.example.com/a.webp#frag', 'https://blog.example.com')).toEqual({
      ok: true,
      url: 'https://assets.example.com/a.webp',
    })

    expect(normalizeSafeRemoteFetchUrl('http://assets.example.com/a.webp', 'https://blog.example.com').ok).toBe(false)
    expect(normalizeSafeRemoteFetchUrl('https://user:pass@assets.example.com/a.webp', 'https://blog.example.com').ok).toBe(false)
    expect(normalizeSafeRemoteFetchUrl('https://169.254.169.254/latest/meta-data', 'https://blog.example.com').ok).toBe(false)
  })

  it('applies public HTTPS URL rules to WeChat bridge base URLs', () => {
    expect(normalizeWechatBridgeBaseUrl('https://bridge.example.com/api/')).toEqual({
      ok: true,
      url: 'https://bridge.example.com/api',
    })

    expect(normalizeWechatBridgeBaseUrl('http://bridge.example.com')).toEqual({
      ok: false,
      error: 'Bridge Base URL 必须使用 https',
    })
    expect(normalizeWechatBridgeBaseUrl('https://127.0.0.1:8788').ok).toBe(false)
  })
})
