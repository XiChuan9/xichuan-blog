import { describe, expect, it } from 'vitest'
import {
  containsMathMarkdown,
  createMathMarkdownParser,
  normalizeLatexInput,
  renderMathHtml,
  renderTextWithMathHtml,
} from '@/lib/math-markdown'

describe('math markdown helpers', () => {
  it('normalizes common escaped LaTeX copied from markdown text', () => {
    expect(normalizeLatexInput('E\\[X\\] = \\\\sum x_i \\\\cdot P(x_i)')).toBe(
      'E[X] = \\sum x_i \\cdot P(x_i)',
    )
  })

  it('renders inline and block math with editor-readable attributes', () => {
    const inline = renderMathHtml('E[X] = \\sum x_i', false)
    const block = renderMathHtml('E[X] = \\sum x_i', true)

    expect(inline).toContain('<span data-math-latex="E[X] = \\sum x_i"')
    expect(inline).toContain('class="math-inline-wrapper"')
    expect(block).toContain('<div data-math-latex="E[X] = \\sum x_i"')
    expect(block).toContain('class="math-block-wrapper"')
  })

  it('converts standard and formula-like markdown text into math wrappers', () => {
    const parser = createMathMarkdownParser({ html: false })
    const html = parser.render('标准公式 \\(E = mc^2\\)。\n\n用公式 (E\\[X\\] = \\\\sum x_i \\\\cdot P(x_i))：\n\n$$\nE[X] = \\sum x_i \\cdot P(x_i)\n$$')

    expect(containsMathMarkdown('用公式 (E\\[X\\] = \\\\sum x_i \\\\cdot P(x_i))：')).toBe(true)
    expect(html).toContain('data-display-mode="false"')
    expect(html).toContain('data-display-mode="true"')
    expect(html).toContain('E = mc^2')
    expect(html).toContain('E[X] = \\sum x_i \\cdot P(x_i)')
    expect(html).not.toContain('P($x_i$)')
  })

  it('enhances legacy text formulas without treating normal text as markdown', () => {
    const html = renderTextWithMathHtml('用公式 (E\\[X\\] = \\\\sum x_i \\\\cdot P(x_i))，不要改 **粗体**。')

    expect(html).toContain('data-display-mode="false"')
    expect(html).toContain('E[X] = \\sum x_i \\cdot P(x_i)')
    expect(html).toContain('不要改 **粗体**。')
  })

  it('renders legacy square-bracket formula text only when it is formula-like', () => {
    const html = renderTextWithMathHtml('[ 1-e^{-0.5} \\\\approx 39.3% ]')

    expect(containsMathMarkdown('[ 1-e^{-0.5} \\\\approx 39.3% ]')).toBe(true)
    expect(html).toContain('data-display-mode="false"')
    expect(html).toContain('1-e^{-0.5} \\approx 39.3%')
    expect(renderTextWithMathHtml('[普通说明]')).toBeNull()
  })
})
