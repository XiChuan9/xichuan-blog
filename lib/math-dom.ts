import { renderTextWithMathHtml } from '@/lib/math-markdown'

const SKIP_TAGS = new Set(['CODE', 'KBD', 'MATH', 'PRE', 'SCRIPT', 'STYLE', 'TEXTAREA'])

function shouldSkipTextNode(node: Text) {
  const parent = node.parentElement
  if (!parent) return true

  return Boolean(parent.closest('[data-math-latex], .katex, code, kbd, math, pre, script, style, textarea'))
}

export function enhanceMathInElement(root: HTMLElement) {
  const doc = root.ownerDocument
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const textNode = node as Text
      if (!textNode.nodeValue?.trim()) return NodeFilter.FILTER_REJECT
      if (shouldSkipTextNode(textNode)) return NodeFilter.FILTER_REJECT
      if (SKIP_TAGS.has(textNode.parentElement?.tagName || '')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  const textNodes: Text[] = []

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text)
  }

  for (const textNode of textNodes) {
    const html = renderTextWithMathHtml(textNode.nodeValue || '')
    if (!html) continue

    const template = doc.createElement('template')
    template.innerHTML = html
    textNode.replaceWith(template.content)
  }
}

export function normalizeMathHtmlForEditor(html: string) {
  if (typeof document === 'undefined' || !html) return html

  const wrapper = document.createElement('div')
  wrapper.innerHTML = html
  enhanceMathInElement(wrapper)
  return wrapper.innerHTML
}
