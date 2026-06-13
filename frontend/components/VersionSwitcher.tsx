'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'ospi:modelVersion'

export default function VersionSwitcher() {
  const [version, setVersion] = useState('v3')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'v2' || stored === 'v3') setVersion(stored)
    } catch {
      // noop
    }
  }, [])

  const handleChange = (v: string) => {
    setVersion(v)
    try { localStorage.setItem(STORAGE_KEY, v) } catch { /* noop */ }
    window.location.reload()
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[8px] uppercase tracking-widest text-zinc-400">Model</span>
      <div className="flex rounded border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        {['v2', 'v3'].map(v => (
          <button
            key={v}
            onClick={() => handleChange(v)}
            className={`text-[9px] px-1.5 py-0.5 font-medium transition-colors ${
              version === v
                ? 'bg-emerald-500 text-white'
                : 'bg-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}
