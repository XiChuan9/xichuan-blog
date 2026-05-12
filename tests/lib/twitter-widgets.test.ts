import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractTweetId, renderTweetEmbed } from '@/lib/twitter-widgets'

describe('twitter-widgets', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('extracts tweet id from x.com urls', () => {
    expect(extractTweetId('https://x.com/vista8/status/1914648153460199766')).toBe('1914648153460199766')
  })

  it('extracts tweet id from twitter.com urls', () => {
    expect(extractTweetId('https://twitter.com/vista8/status/1914648153460199766')).toBe('1914648153460199766')
  })

  it('returns null for non-status urls', () => {
    expect(extractTweetId('https://x.com/vista8')).toBeNull()
  })

  it('rejects injected status path values', () => {
    expect(
      extractTweetId('https://x.com/vista8/status/123"><img src=x onerror=alert(1)>'),
    ).toBeNull()
  })

  it('renders failed widget fallbacks without interpolating HTML', async () => {
    const createTweet = vi.fn().mockRejectedValue(new Error('widget unavailable'))
    const anchor = {
      href: '',
      rel: '',
      style: {} as CSSStyleDeclaration,
      target: '',
      textContent: '',
    } as HTMLAnchorElement
    const container = {
      appendChild: vi.fn((child: Node) => child),
      textContent: 'old content',
    } as unknown as HTMLElement

    vi.stubGlobal('window', {
      twttr: {
        widgets: {
          createTweet,
        },
      },
    })
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
    })

    const source = 'https://x.com/vista8/status/123?ref="><img src=x onerror=alert(1)>'
    await expect(renderTweetEmbed(container, source)).resolves.toBe(true)

    expect(createTweet).toHaveBeenCalledWith('123', container, {
      align: 'center',
      conversation: 'none',
      dnt: true,
    })
    expect(document.createElement).toHaveBeenCalledWith('a')
    expect(anchor.textContent).not.toContain('<img')
    expect(anchor.href).not.toContain('<img')
    expect(container.appendChild).toHaveBeenCalledWith(anchor)
  })
})
