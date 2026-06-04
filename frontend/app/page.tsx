'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchBackendCountries } from '@/lib/useCountries'
import { fetchVersion } from '@/lib/version'
import { showNavOverlay } from '@/lib/navigation'

if (typeof window !== 'undefined') {
  fetchBackendCountries().catch(() => {})
  fetchVersion()
}

const barDelays = ['0.15s', '0.45s', '0.75s', '1.05s', '1.35s']

export default function LandingPage() {
  const [ver, setVer] = useState<{
    etl_year: number
    model_run: string | null
    r_squared: number | null
    n_countries: number | null
    n_signals: number
  } | null>(null)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    const el = document.getElementById('ospi-boot-overlay')
    if (el) el.classList.add('ospi-hidden')
    fetchVersion().then(setVer)
    requestAnimationFrame(() => setAnimate(true))
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col">
      <style>{`
        .lp-bar {
          transform: scaleY(0);
          opacity: 0;
          transition: transform 0.7s ease-out, opacity 0.7s ease-out;
          transform-origin: bottom;
        }
        .lp-bar.animate {
          transform: scaleY(1);
          opacity: 1;
        }
        .lp-fade  { animation: lp-fade 0.6s ease-out both; }
        .lp-fade:nth-child(1) { animation-delay: 1.8s; }
        .lp-fade:nth-child(2) { animation-delay: 2.3s; }
        @keyframes lp-fade {
          0%   { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .lp-slide { animation: lp-slide 0.6s ease-out both; }
        .lp-slide:nth-child(1) { animation-delay: 3.8s; }
        .lp-slide:nth-child(2) { animation-delay: 4.2s; }
        @keyframes lp-slide {
          0%   { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <main className="flex-1 flex flex-col items-center justify-center px-4">

        {/* ── Signal bars + wordmark ── */}
        <div className="flex items-end gap-[3px] h-12 md:h-16 mb-5">
          {[
            { h: 18, col: '#1D9E75' },
            { h: 30, col: '#1D9E75' },
            { h: 42, col: '#1D9E75' },
            { h: 54, col: '#1D9E75' },
            { h: 66, col: '#10b981' },
          ].map((b, i) => (
            <div key={i} className={`lp-bar${animate ? ' animate' : ''}`} style={{
              height: b.h, width: 5, borderRadius: 99,
              background: b.col, transitionDelay: barDelays[i] as string,
            }} />
          ))}
        </div>

        <h1 className="text-sm font-bold tracking-[0.28em] uppercase text-zinc-800 dark:text-zinc-200 mb-0.5">
          OSPI
        </h1>
        <p className="text-[10px] tracking-[0.18em] uppercase text-zinc-400 mb-7">
          Open Signal Population Index
        </p>

        {/* ── Stats line ── */}
        <div className="lp-fade flex items-center justify-center flex-wrap gap-x-3 gap-y-1 mb-6">
          {[
            { label: 'Countries', value: ver?.n_countries ?? '—' },
            { label: 'Signals', value: ver?.n_signals ?? '—' },
            { label: 'R²', value: ver?.r_squared?.toFixed(4) ?? '—' },
            { label: 'Run', value: ver?.model_run ?? '—' },
          ].map((s, i) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className="text-[9px] uppercase tracking-wider text-zinc-400">{s.label}</span>
              <span className="text-xs font-semibold font-mono text-zinc-700 dark:text-zinc-300">{s.value}</span>
              {i < 3 && <span className="text-zinc-200 dark:text-zinc-800 text-[9px]">·</span>}
            </div>
          ))}
        </div>

        {/* ── Description ── */}
        <p className="lp-fade text-[9px] text-zinc-300 dark:text-zinc-700 leading-relaxed text-center max-w-xs sm:max-w-sm mb-8">
          Estimates population where traditional data is sparse, using satellite-derived mobile coverage, electricity, building, mobility, and internet signals.
        </p>

        {/* ── Nav buttons ── */}
        <div className="lp-slide flex gap-3">
          <Link href="/dashboard" onClick={() => showNavOverlay('Dashboard', 'Loading country data…')}
            className="group relative px-5 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition-all duration-300">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              Dashboard <span className="inline-block transition-transform duration-300 group-hover:translate-x-0.5">→</span>
            </span>
            <span className="text-[9px] text-zinc-400 block mt-0.5 group-hover:text-zinc-500 dark:group-hover:text-zinc-400 transition-colors">
              Explore country data
            </span>
          </Link>
          <Link href="/model" onClick={() => showNavOverlay('Model', 'Loading model diagnostics…')}
            className="group relative px-5 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition-all duration-300">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              Model <span className="inline-block transition-transform duration-300 group-hover:translate-x-0.5">→</span>
            </span>
            <span className="text-[9px] text-zinc-400 block mt-0.5 group-hover:text-zinc-500 dark:group-hover:text-zinc-400 transition-colors">
              Regression diagnostics
            </span>
          </Link>
        </div>

      </main>

      <footer className="text-center text-[8px] text-zinc-300 dark:text-zinc-700 pb-4">
        v2.0 · Ridge regression · UN WPP {ver?.etl_year ?? '—'} · 5 signals
      </footer>
    </div>
  )
}
