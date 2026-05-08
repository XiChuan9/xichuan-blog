'use client'

import { useEffect } from 'react'
import { getSafeCustomScriptSources } from '@/lib/custom-js'

export function CustomJsInjector({ code }: { code: string }) {
  useEffect(() => {
    if (!code) return
    const scriptSources = getSafeCustomScriptSources(code)
    const mounted: HTMLScriptElement[] = []

    for (const src of scriptSources) {
      const el = document.createElement('script')
      el.src = src
      el.async = true
      el.defer = true
      el.referrerPolicy = 'strict-origin-when-cross-origin'
      document.body.appendChild(el)
      mounted.push(el)
    }

    return () => {
      for (const el of mounted) {
        el.remove()
      }
    }
  }, [code])

  return null
}
