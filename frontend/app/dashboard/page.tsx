'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { DataSourceProvider } from '@/lib/dataSource'
import { useCountries, useCountriesLoading, fetchBackendCountries } from '@/lib/useCountries'
import { useDataSource } from '@/lib/dataSource'
import { sortByDivergence } from '@/lib/estimator'
import { fmt, fmtPct, fmtUsd, fmtDensity } from '@/lib/fmt'
import type { Country } from '@/lib/types'
import { TERRITORY_ISO2 } from '@/lib/territories'
import Sidebar from '@/components/Sidebar'
import CountryDetail from '@/components/CountryDetail'
import DefaultDashboard from '@/components/DefaultDashboard'
import NavHeader from '@/components/NavHeader'
import { hideNavOverlay } from '@/lib/navigation'

const WorldMap = dynamic(() => import('@/components/WorldMap'), { ssr: false })

function OSPIInner() {
  const [selected, setSelected] = useState<Country | null>(null)
  const [query, setQuery] = useState('')
  const [mapResetKey, setMapResetKey] = useState(0)
  const [hideTerritories, setHideTerritories] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const countries = useCountries()
  const isLoading = useCountriesLoading()

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_BACKEND_URL) {
      fetchBackendCountries().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!isLoading) hideNavOverlay()
  }, [isLoading])

  const visibleCountries = useMemo(
    () => hideTerritories ? countries.filter(c => !TERRITORY_ISO2.has(c.iso)) : countries,
    [countries, hideTerritories],
  )

  const sorted = useMemo(() => sortByDivergence(visibleCountries), [visibleCountries])

  const filtered = useMemo(
    () => sorted.filter(c => c.name.toLowerCase().includes(query.toLowerCase())),
    [sorted, query],
  )

  const mountDone = useRef(false)
  useEffect(() => {
    if (mountDone.current) return
    mountDone.current = true
    setSelected(null)
    setMapResetKey(k => k + 1)
  }, [])

  const handleBackFromDetail = useCallback(() => {
    setSelected(null)
    setMapResetKey(k => k + 1)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center gap-0">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '28px' }}>
          {([
            { h: 8,  delay: '0s',    col: '#1D9E75' },
            { h: 14, delay: '0.15s', col: '#1D9E75' },
            { h: 20, delay: '0.3s',  col: '#1D9E75' },
            { h: 26, delay: '0.45s', col: '#1D9E75' },
            { h: 28, delay: '0.6s',  col: '#d1d5db' },
          ]).map((b, i) => (
            <div
              key={i}
              className="ospi-boot-bar"
              style={{ height: b.h, background: b.col, animationDelay: b.delay }}
            />
          ))}
        </div>
        <p className="ospi-boot-wordmark">OSPI</p>
        <p className="ospi-boot-sub">Fetching population signals…</p>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-zinc-950 overflow-hidden">
      <NavHeader active="dashboard" onMenuClick={() => setSidebarOpen(true)} />

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 xl:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex flex-1 min-h-0">
        {/* Sidebar — inline on xl+, drawer on mobile */}
        <div className={`${sidebarOpen ? 'fixed inset-y-0 left-0 z-50 shadow-xl' : 'hidden'} xl:relative xl:flex xl:shadow-none transition-transform duration-300 ease-in-out`}>
          <Sidebar
            countries={filtered}
            selected={selected}
            onSelect={(c) => { setSelected(c); setSidebarOpen(false) }}
            query={query}
            onSearch={setQuery}
            hideTerritories={hideTerritories}
            onToggleTerritories={setHideTerritories}
            onClose={() => setSidebarOpen(false)}
          />
        </div>

        <main className="flex flex-1 min-h-0 min-w-0 flex-col xl:flex-row">
          {/* Main content wrapper (no overflow on flex child — avoids Chrome reflow bug) */}
          <div className="flex-1 min-w-0 relative z-0 border-r border-zinc-100 dark:border-zinc-800">
            {/* Absolutely-positioned scroll container — not a direct flex child */}
            <div className="absolute inset-0 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(113,113,122,0.2) transparent' }}>
              {selected
                ? <CountryDetail country={selected} onBack={handleBackFromDetail} />
                : <DefaultDashboard selected={selected} onSelect={setSelected} countries={visibleCountries} />
              }
              {/* Right panel embedded on <xl — scrolls with content */}
              <div className="xl:hidden border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 min-w-0">
                <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
                  <p className="text-[9px] uppercase tracking-widest text-zinc-400 font-medium">World map</p>
                  {selected && <span className="text-[9px] text-zinc-400 truncate max-w-[140px]">{selected.name}</span>}
                </div>
                <div className="w-full max-w-[320px] mx-auto aspect-square">
                  <WorldMap countries={visibleCountries} selected={selected} onSelect={setSelected} resetKey={mapResetKey} />
                </div>
                <div className="p-3 border-t border-zinc-100 dark:border-zinc-800">
                  {selected ? <QuickStats country={selected} /> : <AnomalyList countries={visibleCountries} onSelect={setSelected} />}
                </div>
              </div>
            </div>
          </div>

          {/* Right panel — inline on xl+ */}
          <div className="hidden xl:flex shrink-0 flex-col border-l border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900" style={{ width: 320 }}>
            <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
              <p className="text-[9px] uppercase tracking-widest text-zinc-400 font-medium">World map</p>
              {selected && <span className="text-[9px] text-zinc-400 truncate max-w-[140px]">{selected.name}</span>}
            </div>
            <div className="shrink-0 overflow-hidden" style={{ width: 320, height: 320 }}>
              <WorldMap countries={visibleCountries} selected={selected} onSelect={setSelected} resetKey={mapResetKey} />
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 border-t border-zinc-100 dark:border-zinc-800 p-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(113,113,122,0.2) transparent' }}>
              {selected ? <QuickStats country={selected} /> : <AnomalyList countries={visibleCountries} onSelect={setSelected} />}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

/* ──────────────────────────────── */
/* QUICK STATS                      */
/* ──────────────────────────────── */

function QuickStats({ country: c }: { country: Country }) {
  const { noSignals } = useDataSource()

  return (
    <div className="space-y-2">
      <p className="text-[9px] uppercase tracking-widest text-zinc-400 font-medium">
        Quick stats
      </p>

      {[
        { label: 'Official', value: fmt(c.official) },
        { label: 'OSPI est.', value: fmt(c.ospi) },
        { label: 'Urban', value: c.urbanPct ? `${c.urbanPct.toFixed(2)}%` : '—' },
        { label: 'Density', value: c.densityKm2 ? fmtDensity(c.densityKm2) : '—' },
        { label: 'Growth', value: `${fmtPct(c.growthRate, true)}/yr` },
        { label: 'GDP/cap', value: c.gdpPerCapita ? fmtUsd(c.gdpPerCapita) : '—' },
      ].map(r => (
        <div key={r.label} className="flex justify-between">
          <span className="text-[10px] text-zinc-400">{r.label}</span>
          <span className="text-[10px] font-mono text-zinc-700 dark:text-zinc-300">
            {r.value}
          </span>
        </div>
      ))}

      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <p className="text-[9px] uppercase tracking-widest text-zinc-400 mb-1.5">
          Signals
        </p>

        <div className={noSignals ? 'opacity-40 pointer-events-none' : ''}>
          {Object.entries(c.signals).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] text-zinc-400 w-16 capitalize">{k}</span>

              <div className="flex-1 h-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${v}%`,
                    background: v >= 75 ? '#1D9E75' : v >= 50 ? '#EF9F27' : '#E24B4A',
                  }}
                />
              </div>

              <span className="text-[9px] font-mono text-zinc-400">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────── */
/* ANOMALIES                        */
/* ──────────────────────────────── */

function AnomalyList({ countries, onSelect }: {
  countries: Country[]
  onSelect: (c: Country) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-[9px] uppercase tracking-widest text-zinc-400">
        Top anomalies
      </p>

      {sortByDivergence(countries).slice(0, 15).map(c => {
        const d = (c.ospi - c.official) / c.official * 100

        return (
          <button
            key={c.name}
            onClick={() => onSelect(c)}
            className="w-full flex justify-between text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded px-1.5 py-1"
          >
            <span className="text-[10px] truncate">{c.name}</span>
            <span
              className="text-[10px] font-mono font-semibold"
              style={{ color: d >= 0 ? '#1D9E75' : '#E24B4A' }}
            >
              {fmtPct(d, true)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ──────────────────────────────── */
/* ROOT                             */
/* ──────────────────────────────── */

export default function OSPIPage() {
  return (
    <DataSourceProvider>
      <OSPIInner />
    </DataSourceProvider>
  )
}
