'use client'

import { Node as TiptapNode, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import type { DOMOutputSpec } from '@tiptap/pm/model'
import { useState, useEffect, useRef } from 'react'
import katex from 'katex'
import { normalizeLatexInput, renderMathHtml } from './math-markdown'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathBlock: {
      setMathBlock: (options: { latex?: string }) => ReturnType
    }
    mathInline: {
      setMathInline: (options: { latex?: string }) => ReturnType
    }
  }
}

type MathTagName = 'div' | 'span'

function parseDisplayMode(element: HTMLElement, fallback: boolean) {
  const value = element.getAttribute('data-display-mode')
  return value === null ? fallback : value !== 'false'
}

function parseLatex(element: HTMLElement) {
  return normalizeLatexInput(
    element.getAttribute('data-math-latex') ||
    element.getAttribute('latex') ||
    element.textContent ||
    ''
  )
}

function createMathDomSpec(
  tagName: MathTagName,
  latex: string,
  displayMode: boolean,
  HTMLAttributes: Record<string, unknown>,
): DOMOutputSpec {
  const normalized = normalizeLatexInput(latex)
  const className = displayMode ? 'math-block-wrapper' : 'math-inline-wrapper'
  const attrs = mergeAttributes(
    HTMLAttributes,
    {
      'data-math-latex': normalized,
      'data-display-mode': String(displayMode),
      class: className,
    },
  )

  if (typeof document === 'undefined') {
    return [tagName, attrs, normalized]
  }

  const template = document.createElement('template')
  template.innerHTML = renderMathHtml(normalized, displayMode)
  const element = template.content.firstElementChild

  if (!element) {
    return [tagName, attrs, normalized]
  }

  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) {
      element.removeAttribute(key)
      continue
    }
    element.setAttribute(key, String(value))
  }

  return element
}

function MathComponent(props: ReactNodeViewProps) {
  const { node, updateAttributes, selected } = props
  const latex = normalizeLatexInput((node.attrs.latex as string) || '')
  const displayMode = (node.attrs.displayMode as boolean) ?? false
  const [editing, setEditing] = useState(!latex)
  const blockInputRef = useRef<HTMLTextAreaElement>(null)
  const inlineInputRef = useRef<HTMLInputElement>(null)
  const renderRef = useRef<HTMLDivElement | HTMLSpanElement>(null)

  useEffect(() => {
    if (!editing && latex && renderRef.current) {
      try {
        katex.render(latex, renderRef.current, {
          displayMode,
          throwOnError: false,
          output: 'html',
        })
      } catch {
        renderRef.current.textContent = latex
      }
    }
  }, [latex, displayMode, editing])

  useEffect(() => {
    if (!editing) return

    const input = displayMode ? blockInputRef.current : inlineInputRef.current
    input?.focus()
    input?.select()
  }, [displayMode, editing])

  const commit = (value: string) => {
    const nextLatex = normalizeLatexInput(value)
    if (nextLatex) {
      updateAttributes({ latex: nextLatex, displayMode })
    }
    setEditing(false)
  }

  if (editing && displayMode) {
    return (
      <NodeViewWrapper as="div" className="math-node-editing" data-type="math">
        <div className="math-editor-container">
          <label className="math-editor-label">块级公式 (LaTeX)</label>
          <textarea
            ref={blockInputRef}
            defaultValue={latex}
            placeholder="E = mc^2"
            rows={3}
            className="math-editor-input"
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                commit((e.target as HTMLTextAreaElement).value)
              }
              if (e.key === 'Escape') {
                setEditing(false)
              }
            }}
          />
        </div>
      </NodeViewWrapper>
    )
  }

  if (editing) {
    return (
      <NodeViewWrapper as="span" className="math-node-editing math-node-editing-inline" data-type="math">
        <input
          ref={inlineInputRef}
          defaultValue={latex}
          placeholder="E = mc^2"
          className="math-editor-input math-editor-input-inline"
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit((e.target as HTMLInputElement).value)
            }
            if (e.key === 'Escape') {
              setEditing(false)
            }
          }}
        />
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper
      as={displayMode ? 'div' : 'span'}
      className={`math-node-rendered ${displayMode ? 'math-node-rendered-block' : 'math-node-rendered-inline'} ${selected ? 'math-selected' : ''}`}
      data-type="math"
      onClick={() => setEditing(true)}
      title="点击编辑公式"
    >
      {displayMode ? (
        <div ref={renderRef as React.RefObject<HTMLDivElement>} className="math-display" />
      ) : (
        <span ref={renderRef as React.RefObject<HTMLSpanElement>} className="math-inline" />
      )}
    </NodeViewWrapper>
  )
}

export const MathBlockNode = TiptapNode.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: parseLatex,
        renderHTML: () => ({}),
      },
      displayMode: {
        default: true,
        parseHTML: (element: HTMLElement) => parseDisplayMode(element, true),
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'div[data-math-latex]' },
      { tag: 'div.math-block-wrapper' },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return createMathDomSpec('div', String(node.attrs.latex || ''), true, HTMLAttributes)
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathComponent)
  },

  addCommands() {
    return {
      setMathBlock:
        (options: { latex?: string }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { latex: normalizeLatexInput(options.latex ?? ''), displayMode: true },
          })
        },
    }
  },
})

export const MathInlineNode = TiptapNode.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: parseLatex,
        renderHTML: () => ({}),
      },
      displayMode: {
        default: false,
        parseHTML: (element: HTMLElement) => parseDisplayMode(element, false),
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'span[data-math-latex]' },
      { tag: 'span.math-inline-wrapper' },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return createMathDomSpec('span', String(node.attrs.latex || ''), false, HTMLAttributes)
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathComponent)
  },

  addCommands() {
    return {
      setMathInline:
        (options: { latex?: string }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { latex: normalizeLatexInput(options.latex ?? ''), displayMode: false },
          })
        },
    }
  },
})

export const MathNode = [MathBlockNode, MathInlineNode]
