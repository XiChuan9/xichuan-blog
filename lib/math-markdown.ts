import katex from 'katex'
import MarkdownIt from 'markdown-it'
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs'
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs'
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs'
import type Token from 'markdown-it/lib/token.mjs'

type MarkdownItInstance = ReturnType<typeof MarkdownIt>
type MarkdownItOptions = ConstructorParameters<typeof MarkdownIt>[0]

const COMMAND_ESCAPE = /\\\\([a-zA-Z]+)/g
const BRACKET_ESCAPE = /\\([\[\]])/g

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isEscaped(src: string, pos: number) {
  let count = 0
  for (let index = pos - 1; index >= 0 && src[index] === '\\'; index -= 1) {
    count += 1
  }
  return count % 2 === 1
}

function findClosingDelimiter(src: string, start: number, delimiter: string) {
  for (let index = start; index < src.length; index += 1) {
    if (src.startsWith(delimiter, index) && !isEscaped(src, index)) {
      return index
    }
  }
  return -1
}

function findBalancedParen(src: string, start: number) {
  let depth = 0
  for (let index = start; index < src.length; index += 1) {
    const char = src[index]
    if (char === '\n') return -1
    if (isEscaped(src, index)) continue
    if (char === '(') depth += 1
    if (char === ')') {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

function findBalancedSquareBracket(src: string, start: number) {
  let depth = 0
  for (let index = start; index < src.length; index += 1) {
    const char = src[index]
    if (char === '\n') return -1
    if (isEscaped(src, index)) continue
    if (char === '[') depth += 1
    if (char === ']') {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

function stripPair(value: string, open: string, close: string) {
  return value.startsWith(open) && value.endsWith(close)
    ? value.slice(open.length, value.length - close.length).trim()
    : value
}

export function normalizeLatexInput(value: string) {
  let normalized = value.trim()

  normalized = stripPair(normalized, '$$', '$$')
  normalized = stripPair(normalized, '\\[', '\\]')
  normalized = stripPair(normalized, '\\\\[', '\\\\]')
  normalized = stripPair(normalized, '\\(', '\\)')
  normalized = stripPair(normalized, '\\\\(', '\\\\)')
  normalized = stripPair(normalized, '$', '$')

  return normalized
    .replace(COMMAND_ESCAPE, '\\$1')
    .replace(BRACKET_ESCAPE, '$1')
    .trim()
}

function isFormulaLike(value: string) {
  const normalized = normalizeLatexInput(value)
  if (normalized.length < 2 || normalized.length > 160) return false

  return (
    /\\[a-zA-Z]+/.test(normalized) ||
    /[_^]/.test(normalized) ||
    /(?:^|[^\w])(?:sum|cdot|frac|sqrt|alpha|beta|gamma|theta|lambda)(?:$|[^\w])/.test(normalized)
  )
}

function splitFormulaLikeText(value: string) {
  const parts: Array<{ type: 'text' | 'math'; content: string }> = []
  let cursor = 0

  while (cursor < value.length) {
    let dollarOpen = -1
    for (let index = cursor; index < value.length; index += 1) {
      if (value[index] === '$' && value[index + 1] !== '$' && !isEscaped(value, index)) {
        dollarOpen = index
        break
      }
    }

    if (dollarOpen === -1) break

    const close = findClosingDelimiter(value, dollarOpen + 1, '$')
    if (close === -1) break

    const content = value.slice(dollarOpen + 1, close)
    if (!content.trim() || /^\s|\s$/.test(content)) {
      cursor = dollarOpen + 1
      continue
    }

    if (dollarOpen > cursor) {
      parts.push({ type: 'text', content: value.slice(cursor, dollarOpen) })
    }
    parts.push({ type: 'math', content: normalizeLatexInput(content) })
    cursor = close + 1
  }

  if (cursor === 0) return null
  if (cursor < value.length) {
    parts.push({ type: 'text', content: value.slice(cursor) })
  }

  return parts
}

function hasSquareBracketMath(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '[' || isEscaped(value, index)) continue

    const close = findBalancedSquareBracket(value, index)
    if (close === -1) return false

    if (isFormulaLike(value.slice(index + 1, close))) return true
  }
  return false
}

function escapeDollarDelimiter(value: string) {
  return value.replace(/\$/g, '\\$')
}

function hasSingleDollarMath(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '$' || value[index + 1] === '$' || isEscaped(value, index)) continue
    const close = findClosingDelimiter(value, index + 1, '$')
    if (close !== -1 && !value.slice(index + 1, close).includes('\n')) return true
  }
  return false
}

function wrapFormulaLikeParens(value: string) {
  let result = ''
  let cursor = 0
  let changed = false

  while (cursor < value.length) {
    const open = value.indexOf('(', cursor)
    if (open === -1) break

    const close = findBalancedParen(value, open)
    if (close === -1) break

    const content = value.slice(open + 1, close)
    if (!isFormulaLike(content)) {
      result += value.slice(cursor, open + 1)
      cursor = open + 1
      continue
    }

    result += value.slice(cursor, open)
    result += `($${escapeDollarDelimiter(normalizeLatexInput(content))}$)`
    cursor = close + 1
    changed = true
  }

  if (!changed) return value
  return result + value.slice(cursor)
}

function wrapFormulaLikeParensOutsideBlocks(value: string) {
  const lines = value.split('\n')
  let inFence: string | null = null
  let mathClose: string | null = null

  return lines.map((line) => {
    const trimmed = line.trim()

    if (inFence) {
      if (trimmed.startsWith(inFence)) inFence = null
      return line
    }

    if (mathClose) {
      if (trimmed.includes(mathClose)) mathClose = null
      return line
    }

    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/)
    if (fenceMatch) {
      inFence = fenceMatch[1][0].repeat(fenceMatch[1].length)
      return line
    }

    const mathMarker = trimmed.startsWith('$$')
      ? { open: '$$', close: '$$' }
      : trimmed.startsWith('\\[')
        ? { open: '\\[', close: '\\]' }
        : trimmed.startsWith('\\\\[')
          ? { open: '\\\\[', close: '\\\\]' }
          : null

    if (mathMarker) {
      const rest = trimmed.slice(mathMarker.open.length)
      if (!rest.includes(mathMarker.close)) {
        mathClose = mathMarker.close
      }
      return line
    }

    return wrapFormulaLikeParens(line)
  }).join('\n')
}

function replaceFormulaLikeTextTokens(tokens: Token[], TokenConstructor: typeof Token) {
  const nextTokens: Token[] = []

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token.type !== 'text') {
      nextTokens.push(token)
      continue
    }

    let combined = token.content
    let lastTextIndex = index
    while (lastTextIndex + 1 < tokens.length && tokens[lastTextIndex + 1].type === 'text') {
      lastTextIndex += 1
      combined += tokens[lastTextIndex].content
    }
    index = lastTextIndex

    const parts = splitFormulaLikeText(combined)
    if (!parts) {
      const nextToken = new TokenConstructor('text', '', 0)
      nextToken.content = combined
      nextTokens.push(nextToken)
      continue
    }

    for (const part of parts) {
      const nextToken = new TokenConstructor(part.type === 'math' ? 'math_inline' : 'text', part.type === 'math' ? 'math' : '', 0)
      nextToken.content = part.content
      nextTokens.push(nextToken)
    }
  }

  return nextTokens
}

export function containsMathMarkdown(value: string) {
  return (
    /(^|\n)\s*(\$\$|\\\[|\\\\\[)/.test(value) ||
    /\\\(|\\\\\(/.test(value) ||
    hasSingleDollarMath(value) ||
    hasSquareBracketMath(value) ||
    /\([^()\n]*(?:\\[a-zA-Z]+|\\\\[a-zA-Z]+|[_^])[^()\n]*(?:\([^()\n]*\)[^()\n]*)?\)/.test(value)
  )
}

export function renderMathHtml(latex: string, displayMode: boolean) {
  const normalized = normalizeLatexInput(latex)
  const tagName = displayMode ? 'div' : 'span'
  const className = displayMode ? 'math-block-wrapper' : 'math-inline-wrapper'
  let rendered: string

  try {
    rendered = katex.renderToString(normalized, {
      displayMode,
      throwOnError: false,
      output: 'html',
    })
  } catch {
    rendered = `<code>${escapeAttribute(normalized)}</code>`
  }

  return `<${tagName} data-math-latex="${escapeAttribute(normalized)}" data-display-mode="${String(displayMode)}" class="${className}">${rendered}</${tagName}>`
}

export function renderTextWithMathHtml(value: string) {
  const source = wrapFormulaLikeParens(value)
  let html = ''
  let cursor = 0
  let changed = false

  const appendText = (end: number) => {
    if (end > cursor) {
      html += escapeHtml(source.slice(cursor, end))
    }
  }

  while (cursor < source.length) {
    let matchStart = -1
    let open = ''
    let close = ''

    for (let index = cursor; index < source.length; index += 1) {
      if ((source.startsWith('\\(', index) || source.startsWith('\\\\(', index)) && !isEscaped(source, index)) {
        matchStart = index
        open = source.startsWith('\\\\(', index) ? '\\\\(' : '\\('
        close = open === '\\\\(' ? '\\\\)' : '\\)'
        break
      }

      if (source[index] === '$' && source[index + 1] !== '$' && !isEscaped(source, index)) {
        matchStart = index
        open = '$'
        close = '$'
        break
      }

      if (source[index] === '[' && !isEscaped(source, index)) {
        const bracketEnd = findBalancedSquareBracket(source, index)
        if (bracketEnd === -1) continue

        const content = source.slice(index + 1, bracketEnd)
        if (!isFormulaLike(content)) continue

        matchStart = index
        open = '['
        close = ']'
        break
      }
    }

    if (matchStart === -1) break

    const mathStart = matchStart + open.length
    const matchEnd = open === '['
      ? findBalancedSquareBracket(source, matchStart)
      : findClosingDelimiter(source, mathStart, close)
    if (matchEnd === -1) break

    const latex = source.slice(mathStart, matchEnd)
    if (!latex.trim() || (open === '$' && /^\s|\s$/.test(latex)) || (open === '[' && !isFormulaLike(latex))) {
      html += escapeHtml(source.slice(cursor, matchStart + open.length))
      cursor = matchStart + open.length
      continue
    }

    appendText(matchStart)
    html += renderMathHtml(latex, false)
    cursor = matchEnd + close.length
    changed = true
  }

  if (!changed) return null
  html += escapeHtml(source.slice(cursor))
  return html
}

function mathInlineRule(state: StateInline, silent: boolean) {
  const { src, pos } = state

  if (src.startsWith('\\(', pos) || src.startsWith('\\\\(', pos)) {
    const open = src.startsWith('\\\\(', pos) ? '\\\\(' : '\\('
    const close = open === '\\\\(' ? '\\\\)' : '\\)'
    const end = findClosingDelimiter(src, pos + open.length, close)
    if (end === -1) return false

    const content = src.slice(pos + open.length, end)
    if (!content.trim()) return false
    if (!silent) {
      const token = state.push('math_inline', 'math', 0)
      token.content = normalizeLatexInput(content)
    }
    state.pos = end + close.length
    return true
  }

  if (src[pos] === '$' && src[pos + 1] !== '$' && !isEscaped(src, pos)) {
    const end = findClosingDelimiter(src, pos + 1, '$')
    if (end === -1) return false

    const content = src.slice(pos + 1, end)
    if (!content.trim() || /^\s|\s$/.test(content)) return false
    if (!silent) {
      const token = state.push('math_inline', 'math', 0)
      token.content = normalizeLatexInput(content)
    }
    state.pos = end + 1
    return true
  }

  if (src[pos] === '[' && !isEscaped(src, pos)) {
    const end = findBalancedSquareBracket(src, pos)
    if (end === -1) return false

    const content = src.slice(pos + 1, end)
    if (!isFormulaLike(content)) return false
    if (!silent) {
      const token = state.push('math_inline', 'math', 0)
      token.content = normalizeLatexInput(content)
    }
    state.pos = end + 1
    return true
  }

  return false
}

function getLine(state: StateBlock, line: number) {
  return state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line])
}

function mathBlockRule(state: StateBlock, startLine: number, endLine: number, silent: boolean) {
  const firstLine = getLine(state, startLine)
  const trimmed = firstLine.trim()
  const marker = trimmed.startsWith('$$')
    ? { open: '$$', close: '$$' }
    : trimmed.startsWith('\\[')
      ? { open: '\\[', close: '\\]' }
      : trimmed.startsWith('\\\\[')
        ? { open: '\\\\[', close: '\\\\]' }
        : null

  if (!marker) return false

  const firstContent = trimmed.slice(marker.open.length)
  const sameLineEnd = firstContent.indexOf(marker.close)
  if (sameLineEnd >= 0) {
    const content = firstContent.slice(0, sameLineEnd)
    if (!content.trim()) return false
    if (!silent) {
      const token = state.push('math_block', 'math', 0)
      token.block = true
      token.content = normalizeLatexInput(content)
      token.map = [startLine, startLine + 1]
    }
    state.line = startLine + 1
    return true
  }

  const lines: string[] = []
  if (firstContent.trim()) lines.push(firstContent)

  for (let line = startLine + 1; line < endLine; line += 1) {
    const current = getLine(state, line)
    const closeIndex = current.indexOf(marker.close)

    if (closeIndex >= 0) {
      lines.push(current.slice(0, closeIndex))
      const content = lines.join('\n')
      if (!content.trim()) return false
      if (!silent) {
        const token = state.push('math_block', 'math', 0)
        token.block = true
        token.content = normalizeLatexInput(content)
        token.map = [startLine, line + 1]
      }
      state.line = line + 1
      return true
    }

    lines.push(current)
  }

  return false
}

function mathTextCoreRule(state: StateCore) {
  for (const token of state.tokens) {
    if (!token.children) continue
    token.children = replaceFormulaLikeTextTokens(token.children, state.Token)
  }
}

function mathSourceCoreRule(state: StateCore) {
  state.src = wrapFormulaLikeParensOutsideBlocks(state.src)
}

export function mathMarkdownPlugin(md: MarkdownItInstance) {
  md.core.ruler.before('block', 'math_source', mathSourceCoreRule)
  md.inline.ruler.before('escape', 'math_inline', mathInlineRule)
  md.block.ruler.before('fence', 'math_block', mathBlockRule, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  })
  md.core.ruler.after('inline', 'math_text', mathTextCoreRule)

  md.renderer.rules.math_inline = (tokens, index) => renderMathHtml(tokens[index].content, false)
  md.renderer.rules.math_block = (tokens, index) => renderMathHtml(tokens[index].content, true)
}

export function createMathMarkdownParser(options: MarkdownItOptions = {}) {
  return MarkdownIt(options).use(mathMarkdownPlugin)
}
