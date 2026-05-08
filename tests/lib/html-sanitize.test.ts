import { describe, expect, it } from 'vitest'
import { sanitizeArticleHtml } from '@/lib/html-sanitize'

describe('sanitizeArticleHtml', () => {
  it('removes scriptable content and unsafe URLs while preserving article markup', () => {
    const html = sanitizeArticleHtml(`
      <h2 onclick="alert(1)">标题</h2>
      <p><a href="javascript:alert(1)" target="_blank">bad</a></p>
      <img src="/api/images/image/a.webp" onerror="alert(1)" alt="cover">
      <script>alert(1)</script>
      <iframe src="https://www.youtube.com/embed/demo" allow="camera *; fullscreen; microphone *; autoplay" allowfullscreen></iframe>
    `)

    expect(html).toContain('<h2>标题</h2>')
    expect(html).toContain('src="/api/images/image/a.webp"')
    expect(html).toContain('https://www.youtube.com/embed/demo')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('<script')
    expect(html).toContain('allow="fullscreen; autoplay"')
    expect(html).not.toContain('camera')
    expect(html).not.toContain('microphone')
  })
})
