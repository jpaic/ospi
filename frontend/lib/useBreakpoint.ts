'use client'

import { useEffect, useState } from 'react'

const QUERIES = {
  sm: '(min-width: 640px)',
  md: '(min-width: 768px)',
  lg: '(min-width: 1024px)',
  xl: '(min-width: 1280px)',
} as const

export function useBreakpointChange() {
  const [key, setKey] = useState(0)

  useEffect(() => {
    const handlers: Array<() => void> = []

    for (const q of Object.values(QUERIES)) {
      const mql = window.matchMedia(q)
      const handler = () => setKey(k => k + 1)
      mql.addEventListener('change', handler)
      handlers.push(() => mql.removeEventListener('change', handler))
    }

    return () => handlers.forEach(fn => fn())
  }, [])

  return key
}
