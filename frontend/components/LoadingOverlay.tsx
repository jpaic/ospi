'use client'

import { useEffect } from 'react'

interface Props {
  visible: boolean
}

/**
 * Dismisses the #ospi-boot-overlay that layout.tsx injects into the DOM
 * before any JS runs. When `visible` flips to false we add the fade-out
 * class, wait for the CSS transition, then remove the element entirely.
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
    const fadeTimer = setTimeout(() => {
      el.classList.add('ospi-hidden')

      // Remove from DOM after transition completes so it never blocks clicks
      const removeTimer = setTimeout(() => el.remove(), 750)
      return () => clearTimeout(removeTimer)
    }, 300)

    return () => clearTimeout(fadeTimer)
  }, [visible])

  return null
}