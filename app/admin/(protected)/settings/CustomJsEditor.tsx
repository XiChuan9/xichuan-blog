'use client'

import { useState } from 'react'
import { getSafeCustomScriptSources } from '@/lib/custom-js'

interface Props {
  initialValue: string
  onSave: (value: string) => void
  saving: boolean
}

export function CustomJsEditor({ initialValue, onSave, saving }: Props) {
  const [code, setCode] = useState(initialValue)
  const safeSources = getSafeCustomScriptSources(code)

  return (
    <div className="space-y-3">
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={8}
        className="w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] p-3 font-mono text-sm text-[var(--editor-ink)] placeholder:text-[var(--editor-muted)] outline-none focus:border-[var(--editor-accent)] transition-colors resize-y"
        placeholder={'<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>'}
      />
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
        只会加载受信任统计域名的 HTTPS 外链脚本；内联 JavaScript 和任意 HTML 会被忽略。
        {safeSources.length > 0 && (
          <div className="mt-1 font-mono text-[11px] text-amber-800">
            将加载 {safeSources.length} 个脚本
          </div>
        )}
      </div>
      <button
        onClick={() => onSave(code)}
        disabled={saving}
        className="h-9 px-4 rounded-lg text-sm font-medium bg-[var(--editor-accent)] text-[var(--editor-accent-ink)] hover:brightness-105 disabled:opacity-60 transition-colors"
      >
        {saving ? '保存中…' : '保存代码'}
      </button>
    </div>
  )
}
