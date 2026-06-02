'use client'

import { useEffect } from 'react'

interface Props {
  visible: boolean
}

/**
 * Dismisses the #ospi-boot-overlay that layout.tsx injects into the DOM
 * before any JS runs. When `visible` flips to false we add the fade-out
 * class so the overlay fades away.
 *
 * IMPORTANT: we NEVER remove the element from the DOM. The overlay is a
 * React-managed sibling of {children} in the layout. Removing it via
 * el.remove() corrupts React's fiber → DOM reference, causing
 * "insertBefore on removed sibling" crashes during commitPlacement
 * when navigating between pages with <Link>.
 *
 * This component renders nothing itself — the overlay is pure HTML/CSS
 * in layout.tsx so it's visible from the very first paint with zero flicker.
 */
export default function LoadingOverlay({ visible }: Props) {
  useEffect(() => {
    if (visible) return

    const el = document.getElementById('ospi-boot-overlay')
    if (!el) return

    // Small delay so there's always a visible fade even on cache-warm loads
    const timer = setTimeout(() => {
      el.classList.add('ospi-hidden')
    }, 300)

    return () => clearTimeout(timer)
  }, [visible])

  return null
}