'use client'

import { useState } from 'react'

interface PasswordPromptProps {
  slug: string
  error?: string
}

export function PasswordPrompt({ slug, error }: PasswordPromptProps) {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState(error || '')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = password.trim()
    if (!trimmed || loading) return

    setLoading(true)
    setMessage('')
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(slug)}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: trimmed }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string }
        setMessage(body.error || '密码错误，请重试')
        setPassword('')
        return
      }
      window.location.href = window.location.pathname
    } catch {
      setMessage('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-[var(--editor-panel)] rounded-xl border border-[var(--editor-line)] p-8 shadow-lg">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--editor-accent)]/10 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--editor-accent)]">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[var(--editor-ink)] mb-2">
              此文章已加密
            </h2>
            <p className="text-sm text-[var(--editor-muted)]">
              请输入密码查看内容
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                autoFocus
                className="w-full px-4 py-3 rounded-lg border border-[var(--editor-line)] bg-[var(--background)] text-[var(--editor-ink)] placeholder:text-[var(--editor-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--editor-accent)] focus:border-transparent transition"
              />
              {message && (
                <p className="mt-2 text-sm text-rose-600">{message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!password.trim() || loading}
              className="w-full px-4 py-3 rounded-lg bg-[var(--editor-accent)] text-white font-medium hover:brightness-105 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '验证中...' : '解锁文章'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
