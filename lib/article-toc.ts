export type TocItem = {
  id: string
  text: string
  level: 2 | 3
}

export type TocHeadingInput = {
  level: number
  text: string | null | undefined
}

const SUPPORTED_LEVELS = new Set([2, 3])

export function normalizeTocText(text: string | null | undefined): string {
  return (text || '').replace(/\s+/g, ' ').trim()
}

export function createTocSlug(text: string): string {
  const normalized = normalizeTocText(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\u3400-\u4dbf\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'section'
}

export function createUniqueTocId(text: string, counts: Map<string, number>): string {
  const base = createTocSlug(text)
  const count = counts.get(base) ?? 0
  counts.set(base, count + 1)

  return count === 0 ? base : `${base}-${count + 1}`
}

export function buildTocItems(headings: Iterable<TocHeadingInput>): TocItem[] {
  const counts = new Map<string, number>()
  const items: TocItem[] = []

  for (const heading of headings) {
    if (!SUPPORTED_LEVELS.has(heading.level)) continue

    const text = normalizeTocText(heading.text)
    if (!text) continue

    items.push({
      id: createUniqueTocId(text, counts),
      text,
      level: heading.level as 2 | 3,
    })
  }

  return items
}
