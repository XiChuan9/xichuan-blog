'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { List, X } from 'lucide-react'
import type { EditorInstance } from 'novel'
import {
  createUniqueTocId,
  normalizeTocText,
  type TocItem,
} from '@/lib/article-toc'

type ArticleTocVariant = 'reader' | 'editor'

interface ArticleTocProps {
  contentContainerId: string
  defaultOpen?: boolean
  syncHash?: boolean
  variant?: ArticleTocVariant
  editor?: EditorInstance | null
  className?: string
}

type TocElement = {
  item: TocItem
  element?: HTMLElement
}

const HEADING_SCROLL_OFFSET = 88
const ACTIVE_HEADING_OFFSET = HEADING_SCROLL_OFFSET + 12

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function getHeadingLevel(element: Element): 2 | 3 | null {
  const tagName = element.tagName.toLowerCase()
  if (tagName === 'h2') return 2
  if (tagName === 'h3') return 3
  return null
}

function getHashId() {
  if (typeof window === 'undefined' || !window.location.hash) return ''

  const raw = window.location.hash.slice(1)
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function encodeHash(id: string) {
  return `#${encodeURIComponent(id)}`
}

function shouldReduceMotion() {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function canScrollElement(element: HTMLElement) {
  const style = window.getComputedStyle(element)
  return /(auto|scroll|overlay)/.test(style.overflowY) &&
    element.scrollHeight > element.clientHeight
}

function getScrollContainer(element: HTMLElement): HTMLElement | Window {
  let current = element.parentElement

  while (current && current !== document.body && current !== document.documentElement) {
    if (canScrollElement(current)) return current
    current = current.parentElement
  }

  return window
}

function scrollElementToHeadingTop(element: HTMLElement, topOffset: number, smooth: boolean) {
  const scrollContainer = getScrollContainer(element)
  const behavior: ScrollBehavior = smooth && !shouldReduceMotion() ? 'smooth' : 'auto'

  if (scrollContainer === window) {
    const top = element.getBoundingClientRect().top + window.scrollY - topOffset
    const nextTop = Math.max(0, top)

    window.scrollTo({ top: nextTop, behavior })

    if (behavior === 'auto') {
      document.documentElement.scrollTop = nextTop
      document.body.scrollTop = nextTop
    }

    return
  }

  const container = scrollContainer as HTMLElement
  const containerRect = container.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  const top = elementRect.top - containerRect.top + container.scrollTop - topOffset

  container.scrollTo({
    top: Math.max(0, top),
    behavior,
  })
}

function getEditorHeadingElement(editor: EditorInstance, position: number): HTMLElement | undefined {
  const nodeDom = editor.view.nodeDOM(position)
  if (nodeDom instanceof HTMLElement) return nodeDom

  const domAtPos = editor.view.domAtPos(position + 1).node
  const element = domAtPos instanceof HTMLElement
    ? domAtPos
    : domAtPos.parentElement

  return element?.closest<HTMLElement>('h2, h3') ?? undefined
}

export function ArticleToc({
  contentContainerId,
  defaultOpen = true,
  syncHash = false,
  variant = 'reader',
  editor = null,
  className,
}: ArticleTocProps) {
  const [items, setItems] = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const elementsRef = useRef<TocElement[]>([])
  const signatureRef = useRef('')
  const initialHashHandledRef = useRef(false)
  const frameRef = useRef<number | null>(null)

  const updateActiveHeading = useCallback(() => {
    const elements = elementsRef.current
    if (elements.length === 0) {
      setActiveId('')
      return
    }

    let nextActiveId = elements[0]?.item.id ?? ''

    for (const current of elements) {
      if (!current.element) continue
      const rect = current.element.getBoundingClientRect()
      if (rect.top <= ACTIVE_HEADING_OFFSET) {
        nextActiveId = current.item.id
      } else {
        break
      }
    }

    setActiveId(nextActiveId)
  }, [])

  const scrollToHeading = useCallback((id: string, updateHash: boolean) => {
    const container = document.getElementById(contentContainerId)
    const current = elementsRef.current.find((element) => element.item.id === id)
    const target = current?.element
      ?? document.getElementById(id)
    if (!target || !container?.contains(target)) return

    scrollElementToHeadingTop(target, HEADING_SCROLL_OFFSET, variant !== 'editor')

    setActiveId(id)
    setMobileOpen(false)

    if (syncHash && updateHash) {
      const nextUrl = `${window.location.pathname}${window.location.search}${encodeHash(id)}`
      window.history.pushState(null, '', nextUrl)
    }
  }, [contentContainerId, syncHash, variant])

  const scanHeadings = useCallback(() => {
    if (variant === 'editor' && editor) {
      const counts = new Map<string, number>()
      const nextElements: TocElement[] = []

      editor.state.doc.descendants((node, position) => {
        if (node.type.name !== 'heading') return true

        const level = node.attrs.level
        if (level !== 2 && level !== 3) return true

        const text = normalizeTocText(node.textContent)
        if (!text) return true

        const id = createUniqueTocId(text, counts)
        nextElements.push({
          item: { id, text, level },
          element: getEditorHeadingElement(editor, position),
        })

        return true
      })

      const nextItems = nextElements.map(({ item }) => item)
      const nextSignature = nextItems.map((item) => `${item.level}:${item.id}:${item.text}`).join('|')
      elementsRef.current = nextElements

      if (nextSignature !== signatureRef.current) {
        signatureRef.current = nextSignature
        setItems(nextItems)
      }

      updateActiveHeading()
      return
    }

    const container = document.getElementById(contentContainerId)
    if (!container) {
      elementsRef.current = []
      if (signatureRef.current) {
        signatureRef.current = ''
        setItems([])
      }
      setActiveId((current) => current ? '' : current)
      return
    }

    const counts = new Map<string, number>()
    const nextElements: TocElement[] = []

    for (const heading of Array.from(container.querySelectorAll('h2, h3'))) {
      const level = getHeadingLevel(heading)
      if (!level) continue

      const text = normalizeTocText(heading.textContent)
      if (!text) {
        heading.removeAttribute('id')
        continue
      }

      const id = createUniqueTocId(text, counts)
      heading.id = id
      nextElements.push({
        item: { id, text, level },
        element: heading as HTMLElement,
      })
    }

    const nextItems = nextElements.map(({ item }) => item)
    const nextSignature = nextItems.map((item) => `${item.level}:${item.id}:${item.text}`).join('|')
    elementsRef.current = nextElements

    if (nextSignature !== signatureRef.current) {
      signatureRef.current = nextSignature
      setItems(nextItems)
    }

    if (syncHash && !initialHashHandledRef.current && nextItems.length > 0) {
      initialHashHandledRef.current = true
      const hashId = getHashId()
      if (hashId && nextItems.some((item) => item.id === hashId)) {
        window.setTimeout(() => scrollToHeading(hashId, false), 0)
        return
      }
    }

    updateActiveHeading()
  }, [contentContainerId, editor, scrollToHeading, syncHash, updateActiveHeading, variant])

  useEffect(() => {
    const scheduleScan = () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null
        scanHeadings()
      })
    }

    scheduleScan()

    const observer = new MutationObserver(scheduleScan)
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    })

    window.addEventListener('resize', updateActiveHeading)
    window.addEventListener('scroll', updateActiveHeading, { passive: true })
    editor?.on('update', scheduleScan)
    editor?.on('transaction', scheduleScan)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateActiveHeading)
      window.removeEventListener('scroll', updateActiveHeading)
      editor?.off('update', scheduleScan)
      editor?.off('transaction', scheduleScan)
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    }
  }, [editor, scanHeadings, updateActiveHeading])

  useEffect(() => {
    if (!syncHash) return

    const handleHashChange = () => {
      const hashId = getHashId()
      if (hashId) scrollToHeading(hashId, false)
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [scrollToHeading, syncHash])

  if (variant === 'reader' && items.length === 0) return null

  const renderItems = (compact = false) => {
    if (items.length === 0) {
      return (
        <p className="mt-3 text-xs leading-relaxed text-[var(--stone-gray)]">
          暂无目录
        </p>
      )
    }

    return (
      <ol className={cx('mt-3 space-y-1', compact && 'mt-4')}>
        {items.map((item) => {
          const active = activeId === item.id

          return (
            <li key={item.id}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => scrollToHeading(item.id, true)}
                className={cx(
                  'block w-full rounded-md py-1.5 pr-2 text-left text-sm leading-snug transition-colors',
                  item.level === 3 ? 'pl-5' : 'pl-2',
                  active
                    ? 'bg-[var(--editor-accent)]/10 text-[var(--editor-accent)]'
                    : 'text-[var(--editor-muted)] hover:bg-[var(--editor-soft)] hover:text-[var(--editor-ink)]',
                )}
                aria-current={active ? 'location' : undefined}
              >
                <span className="line-clamp-2">{item.text}</span>
              </button>
            </li>
          )
        })}
      </ol>
    )
  }

  const desktopToc = (
    <aside
      className={cx(
        'article-toc-desktop hidden shrink-0 lg:block',
        'sticky top-14 h-[calc(100vh-3.5rem)] w-[240px] overflow-y-auto border-r border-[var(--editor-line)] bg-[var(--background)] px-4 py-6',
        !defaultOpen && 'lg:hidden',
        className,
      )}
    >
      <nav
        className="text-sm"
        aria-label="文章目录"
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--stone-gray)]">
          <List className="h-3.5 w-3.5" />
          <span>目录</span>
        </div>
        {renderItems()}
      </nav>
    </aside>
  )

  return (
    <>
      {desktopToc}

      {items.length > 0 && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="fixed bottom-4 left-4 z-40 inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--editor-line)] bg-[var(--editor-panel)] px-3 text-sm font-medium text-[var(--editor-ink)] shadow-lg lg:hidden"
          aria-expanded={mobileOpen}
          aria-controls="mobile-article-toc"
        >
          <List className="h-4 w-4" />
          目录
        </button>
      )}

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" id="mobile-article-toc">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="关闭目录"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(20rem,calc(100vw-2rem))] overflow-y-auto border-r border-[var(--editor-line)] bg-[var(--background)] px-4 py-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--editor-ink)]">
                <List className="h-4 w-4" />
                <span>目录</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--editor-muted)] transition hover:bg-[var(--editor-soft)] hover:text-[var(--editor-ink)]"
                aria-label="关闭目录"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav aria-label="文章目录">
              {renderItems(true)}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
