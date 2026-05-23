'use client'

import { useState, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { DataSourceProvider } from '@/lib/dataSource'
import { useCountries, fetchBackendCountries } from '@/lib/useCountries'
import { useDataSource } from '@/lib/dataSource'
import { sortByDivergence } from '@/lib/estimator'
import { fmt, fmtPct } from '@/lib/fmt'
import type { Country } from '@/lib/types'
import Sidebar from '@/components/Sidebar'
import CountryDetail from '@/components/CountryDetail'
import DefaultDashboard from '@/components/DefaultDashboard'

const WorldMap = dynamic(() => import('@/components/WorldMap'), { ssr: false })

function OSPIInner() {
  const [selected, setSelected] = useState<Country | null>(null)
  const [query, setQuery] = useState('')
  const [mapResetKey, setMapResetKey] = useState(0)

  const countries = useCountries()

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_BACKEND_URL) {
      fetchBackendCountries().catch(() => {})
    }
  }, [])

  const sorted = useMemo(() => sortByDivergence(countries), [countries])

  const filtered = useMemo(
    () => sorted.filter(c => c.name.toLowerCase().includes(query.toLowerCase())),
    [sorted, query],
  )

  useEffect(() => {
    setSelected(null)
    setMapResetKey(k => k + 1)
  }, [])

  const handleOverviewReset = () => {
    setSelected(null)
    setMapResetKey(k => k + 1)
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-zinc-950 overflow-hidden">

      {/* ── Top bar ── */}
      <header className="flex items-center gap-3 px-4 h-9 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[11px] font-bold tracking-widest uppercase text-zinc-700 dark:text-zinc-300">
          OSPI
        </span>
        <span className="text-[11px] text-zinc-300 dark:text-zinc-600">
          Open Signal Population Index
        </span>

        <div className="ml-auto flex items-center gap-4">
          <span className="text-[9px] text-zinc-300 dark:text-zinc-600 uppercase tracking-wider">
            {countries.length} countries · 5 signals · UN WPP
          </span>

          {selected && (
            <button
              className="text-[9px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 uppercase tracking-wider transition-colors"
              onClick={handleOverviewReset}
              title="Back to overview"
            >
              ← overview
            </button>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        <Sidebar
          countries={filtered}
          selected={selected}
          onSelect={setSelected}
          query={query}
          onSearch={setQuery}
        />

        <main className="flex flex-1 overflow-hidden">

          {/* Left panel */}
          <div className="flex-1 overflow-hidden border-r border-zinc-100 dark:border-zinc-800">
            {selected
              ? <CountryDetail country={selected} />
              : <DefaultDashboard />
            }
          </div>

          {/* Right map panel */}
          <div
            className="shrink-0 flex flex-col border-l border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
            style={{ width: 320 }}
          >
            <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <p className="text-[9px] uppercase tracking-widest text-zinc-400 font-medium">
                World map
              </p>
              {selected && (
                <span className="text-[9px] text-zinc-400 truncate max-w-[140px]">
                  {selected.name}
                </span>
              )}
            </div>

            <div style={{ width: 320, height: 320 }} className="shrink-0 overflow-hidden">
              <WorldMap
                countries={countries}
                selected={selected}
                onSelect={setSelected}
                resetKey={mapResetKey}
              />
            </div>

            <div
              className="flex-1 overflow-y-auto border-t border-zinc-100 dark:border-zinc-800 p-3"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(113,113,122,0.2) transparent' }}
            >
              {selected ? (
                <QuickStats country={selected} />
              ) : (
                <AnomalyList countries={countries} onSelect={setSelected} />
              )}
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
        { label: 'Urban',    value: c.urbanPct   ? `${c.urbanPct}%`      : '—' },
        { label: 'Density',  value: c.densityKm2 ? `${c.densityKm2}/km²` : '—' },
        { label: 'Growth',   value: `${fmtPct(c.growthRate, true)}/yr` },
        { label: 'GDP/cap',  value: c.gdpPerCapita ? `$${fmt(c.gdpPerCapita)}` : '—' },
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