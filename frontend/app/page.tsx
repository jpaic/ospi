'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { DataSourceProvider } from '@/lib/dataSource'
import { useCountries } from '@/lib/useCountries'
import { useDataSource } from '@/lib/dataSource'
import { sortByDivergence } from '@/lib/estimator'
import type { Country } from '@/lib/mockData'
import Sidebar from '@/components/Sidebar'
import CountryDetail from '@/components/CountryDetail'
import DefaultDashboard from '@/components/DefaultDashboard'
import DataSourceToggle from '@/components/DataSourceToggle'
const WorldMap = dynamic(() => import('@/components/WorldMap'), { ssr: false })

// Inner component so it can consume context
function OSPIInner() {
  const [selected, setSelected] = useState<Country | null>(null)
  const [query,    setQuery]    = useState('')
  const { source } = useDataSource()
  const countries  = useCountries()

  const sorted   = useMemo(() => sortByDivergence(countries), [countries])
  const filtered = useMemo(
    () => sorted.filter(c => c.name.toLowerCase().includes(query.toLowerCase())),
    [sorted, query],
  )

  // Clear selection when source changes to avoid stale country reference
  useMemo(() => { setSelected(null) }, [source])

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-zinc-950 overflow-hidden">

      {/* ── Top bar ── */}
      <header className="flex items-center gap-3 px-4 h-9 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[11px] font-bold tracking-widest uppercase text-zinc-700 dark:text-zinc-300">OSPI</span>
        <span className="text-[11px] text-zinc-300 dark:text-zinc-600">Open Signal Population Index</span>

        <div className="ml-auto flex items-center gap-4">
          {/* Meta label */}
          <span className="text-[9px] text-zinc-300 dark:text-zinc-600 uppercase tracking-wider">
            {countries.length} countries · 5 signals · {source === 'mock' ? 'mock data' : 'UN WPP'}
          </span>

          {/* Data source toggle */}
          <DataSourceToggle />

          {/* Back to overview */}
          {selected && (
            <button
              className="text-[9px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 uppercase tracking-wider transition-colors"
              onClick={() => setSelected(null)}
              title="Back to overview"
            >
              ← overview
            </button>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <Sidebar
          countries={filtered}
          selected={selected}
          onSelect={setSelected}
          query={query}
          onSearch={setQuery}
        />

        {/* Main content */}
        <main className="flex flex-1 overflow-hidden">

          {/* Left: detail / dashboard */}
          <div className="flex-1 overflow-hidden border-r border-zinc-100 dark:border-zinc-800">
            {selected
              ? <CountryDetail country={selected} />
              : <DefaultDashboard />
            }
          </div>

          {/* Right: map panel */}
          <div
            className="shrink-0 flex flex-col border-l border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
            style={{ width: 320 }}
          >
            {/* Map header */}
            <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 shrink-0 flex items-center justify-between">
              <p className="text-[9px] uppercase tracking-widest text-zinc-400 font-medium">World map</p>
              {selected && (
                <span className="text-[9px] text-zinc-400 truncate max-w-[140px]">{selected.name}</span>
              )}
            </div>

            {/* Map */}
            <div style={{ width: 320, height: 320 }} className="shrink-0 overflow-hidden">
              <WorldMap
                countries={countries}
                selected={selected}
                onSelect={setSelected}
              />
            </div>

            {/* Below map: quick stats or anomaly list */}
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

// ── Quick stats (below map when a country is selected) ───────────────────────

function QuickStats({ country: c }: { country: Country }) {
  const { noSignals } = useDataSource()

  return (
    <div className="space-y-2">
      <p className="text-[9px] uppercase tracking-widest text-zinc-400 font-medium">Quick stats</p>
      {[
        { label: 'Official',  value: `${c.official}M`   },
        { label: 'OSPI est.', value: `${c.ospi}M`        },
        { label: 'Urban',     value: c.urbanPct ? `${c.urbanPct}%` : '—' },
        { label: 'Density',   value: c.densityKm2 ? `${c.densityKm2}/km²` : '—' },
        { label: 'Growth',    value: `${c.growthRate > 0 ? '+' : ''}${c.growthRate}%/yr` },
        { label: 'GDP/cap',   value: c.gdpPerCapita ? `$${c.gdpPerCapita.toLocaleString()}` : '—' },
      ].map(r => (
        <div key={r.label} className="flex justify-between items-center">
          <span className="text-[10px] text-zinc-400">{r.label}</span>
          <span className="text-[10px] font-mono font-medium text-zinc-700 dark:text-zinc-300">{r.value}</span>
        </div>
      ))}

      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <p className="text-[9px] uppercase tracking-widest text-zinc-400 font-medium mb-1.5">Signals</p>
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
        {noSignals && (
          <p className="text-[9px] text-zinc-300 dark:text-zinc-600 mt-1">
            Signals not yet available for UN source
          </p>
        )}
      </div>
    </div>
  )
}

// ── Anomaly list (below map when no country is selected) ─────────────────────

function AnomalyList({ countries, onSelect }: { countries: Country[]; onSelect: (c: Country) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-[9px] uppercase tracking-widest text-zinc-400 font-medium">Top anomalies</p>
      {sortByDivergence(countries).slice(0, 15).map(c => {
        const d   = Math.round((c.ospi - c.official) / c.official * 100)
        const isP = d >= 0
        return (
          <button
            key={c.name}
            className="w-full flex items-center justify-between text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded px-1.5 py-1 transition-colors"
            onClick={() => onSelect(c)}
          >
            <span className="text-[10px] text-zinc-600 dark:text-zinc-400 truncate">{c.name}</span>
            <span
              className="text-[10px] font-mono font-semibold ml-1 shrink-0"
              style={{ color: isP ? '#1D9E75' : '#E24B4A' }}
            >
              {isP ? '+' : ''}{d}%
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Root export — wraps everything in the provider ───────────────────────────

export default function OSPIPage() {
  return (
    <DataSourceProvider>
      <OSPIInner />
    </DataSourceProvider>
  )
}