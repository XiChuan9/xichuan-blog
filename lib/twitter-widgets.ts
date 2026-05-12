type TweetStatusUrl = {
  href: string
  tweetId: string
}

const TWITTER_STATUS_HOSTS = new Set([
  'twitter.com',
  'www.twitter.com',
  'mobile.twitter.com',
  'x.com',
  'www.x.com',
])

function parseTweetStatusUrl(url: string | null | undefined): TweetStatusUrl | null {
  if (!url) return null

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const hostname = parsed.hostname.toLowerCase()
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    !TWITTER_STATUS_HOSTS.has(hostname)
  ) {
    return null
  }

  const segments = parsed.pathname.split('/').filter(Boolean)
  const statusIndex = segments.findIndex((segment) => segment.toLowerCase() === 'status')
  const tweetId = statusIndex >= 0 ? segments[statusIndex + 1] : undefined
  if (!tweetId || !/^\d+$/.test(tweetId)) return null

  return {
    href: parsed.href,
    tweetId,
  }
}

export function extractTweetId(url: string | null | undefined): string | null {
  return parseTweetStatusUrl(url)?.tweetId ?? null
}

declare global {
  interface Window {
    twttr?: {
      widgets: {
        createTweet: (
          tweetId: string,
          element: HTMLElement,
          options?: {
            align?: 'left' | 'center' | 'right'
            conversation?: 'all' | 'none'
            dnt?: boolean
          }
        ) => Promise<HTMLElement>
      }
    }
  }
}

let widgetScriptPromise: Promise<void> | null = null

export function loadTwitterWidgets(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.twttr?.widgets) return Promise.resolve()
  if (widgetScriptPromise) return widgetScriptPromise

  widgetScriptPromise = new Promise((resolve) => {
    const existing = document.getElementById('twitter-widgets-js')
    if (existing) {
      const check = () => {
        if (window.twttr?.widgets) resolve()
        else window.setTimeout(check, 100)
      }
      check()
      return
    }

    const script = document.createElement('script')
    script.id = 'twitter-widgets-js'
    script.src = 'https://platform.twitter.com/widgets.js'
    script.async = true
    script.onload = () => {
      const check = () => {
        if (window.twttr?.widgets) resolve()
        else window.setTimeout(check, 100)
      }
      check()
    }
    document.head.appendChild(script)
  })

  return widgetScriptPromise
}

export async function renderTweetEmbed(container: HTMLElement, src: string) {
  const tweet = parseTweetStatusUrl(src)
  if (!tweet) return false

  container.textContent = ''
  await loadTwitterWidgets()

  try {
    await window.twttr?.widgets.createTweet(tweet.tweetId, container, {
      align: 'center',
      conversation: 'none',
      dnt: true,
    })
  } catch {
    const link = document.createElement('a')
    link.href = tweet.href
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.style.color = '#1da1f2'
    link.textContent = tweet.href
    container.textContent = ''
    container.appendChild(link)
  }

  return true
}

export async function enhanceTwitterEmbeds(root: Document | Element) {
  const embeds = Array.from(root.querySelectorAll<HTMLElement>('div[data-twitter-src]'))
  await Promise.all(embeds.map(async (container) => {
    const src = container.getAttribute('data-twitter-src')
    if (!src) return
    await renderTweetEmbed(container, src)
  }))
}
