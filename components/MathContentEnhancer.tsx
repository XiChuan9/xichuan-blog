'use client'

import { useEffect } from 'react'
import { enhanceMathInElement } from '@/lib/math-dom'

export function MathContentEnhancer({
  containerId,
  html,
}: {
  containerId: string
  html: string
}) {
  useEffect(() => {
    const root = document.getElementById(containerId)
    if (!root) return

    enhanceMathInElement(root)
  }, [containerId, html])

  return null
}
