import { describe, expect, it } from 'vitest'
import { buildTocItems, createTocSlug, normalizeTocText } from '@/lib/article-toc'

describe('article toc helpers', () => {
  it('collects only h2 and h3 headings', () => {
    const items = buildTocItems([
      { level: 1, text: '文章标题' },
      { level: 2, text: '第一节' },
      { level: 3, text: '第一小节' },
      { level: 4, text: '忽略的小节' },
    ])

    expect(items).toEqual([
      { id: '第一节', text: '第一节', level: 2 },
      { id: '第一小节', text: '第一小节', level: 3 },
    ])
  })

  it('normalizes whitespace and skips empty headings', () => {
    const items = buildTocItems([
      { level: 2, text: '  多行\n标题\t内容  ' },
      { level: 3, text: '   ' },
      { level: 2, text: null },
    ])

    expect(items).toEqual([
      { id: '多行-标题-内容', text: '多行 标题 内容', level: 2 },
    ])
    expect(normalizeTocText(' A\n B\tC ')).toBe('A B C')
  })

  it('uses safe slugs for latin text and falls back for punctuation-only headings', () => {
    expect(createTocSlug('Hello, Next.js & React!')).toBe('hello-next-js-and-react')
    expect(createTocSlug('!!!')).toBe('section')
  })

  it('keeps Chinese headings readable in generated ids', () => {
    expect(createTocSlug('第一部分：背景与动机')).toBe('第一部分-背景与动机')
  })

  it('suffixes duplicate heading ids while preserving levels', () => {
    const items = buildTocItems([
      { level: 2, text: '重复标题' },
      { level: 3, text: '重复标题' },
      { level: 2, text: '重复标题' },
    ])

    expect(items).toEqual([
      { id: '重复标题', text: '重复标题', level: 2 },
      { id: '重复标题-2', text: '重复标题', level: 3 },
      { id: '重复标题-3', text: '重复标题', level: 2 },
    ])
  })
})
