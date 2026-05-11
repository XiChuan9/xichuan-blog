'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

function isAdminSessionCookiePresent() {
  return document.cookie.includes('xichuan-blog_admin=')
}

export function GlobalShortcuts() {
  const router = useRouter()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd + K → 新建文章（Mac 标准快捷键）
      if (e.metaKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        // 检查是否已登录
        if (isAdminSessionCookiePresent()) {
          router.push('/editor')
        }
        return
      }

      // Ctrl + Cmd + N → 新建文章（备用快捷键）
      if (e.ctrlKey && e.metaKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        if (isAdminSessionCookiePresent()) {
          router.push('/editor')
        }
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router])

  return null
}
