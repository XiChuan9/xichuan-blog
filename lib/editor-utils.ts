export function createDefaultTableContent(rows = 3, cols = 3) {
  return {
    type: 'table',
    content: Array.from({ length: rows }, (_, rowIndex) => ({
      type: 'tableRow',
      content: Array.from({ length: cols }, () => ({
        type: rowIndex === 0 ? 'tableHeader' : 'tableCell',
        content: [{ type: 'paragraph' }],
      })),
    })),
  }
}

export function hasMarkdownTable(text: string): boolean {
  const lines = text.split('\n')
  let pipeLines = 0
  let hasSeparator = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      pipeLines += 1
      if (/^\|[\s:]*-{2,}[\s:]*\|/.test(trimmed)) {
        hasSeparator = true
      }
    }
  }

  return pipeLines >= 3 && hasSeparator
}

export function isValidHttpUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

export function normalizeUrl(value: string) {
  return isValidHttpUrl(value) ? value : `https://${value}`
}

const BLOCKED_PASTE_TAGS = new Set([
  'base',
  'button',
  'embed',
  'form',
  'iframe',
  'input',
  'link',
  'meta',
  'object',
  'script',
  'select',
  'style',
  'textarea',
])

const PASTED_URL_ATTRIBUTES = new Set(['href', 'src', 'poster'])

function isSafePastedUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed || trimmed.startsWith('/') || trimmed.startsWith('#')) return true

  try {
    const url = new URL(trimmed)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)
  } catch {
    return false
  }
}

export function sanitizePastedHtml(root: HTMLElement) {
  root.querySelectorAll('*').forEach((el) => {
    if (BLOCKED_PASTE_TAGS.has(el.tagName.toLowerCase())) {
      el.remove()
      return
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      if (
        name === 'style' ||
        name === 'class' ||
        name === 'id' ||
        name === 'srcdoc' ||
        name === 'formaction' ||
        name.startsWith('on') ||
        name.startsWith('data-') ||
        name.startsWith('aria-') ||
        name.includes(':')
      ) {
        el.removeAttribute(attr.name)
        continue
      }

      if (PASTED_URL_ATTRIBUTES.has(name) && !isSafePastedUrl(attr.value)) {
        el.removeAttribute(attr.name)
      }
    }
  })

  return root
}
