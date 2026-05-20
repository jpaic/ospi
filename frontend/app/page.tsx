'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { countries } from '@/lib/mockData'
import { sortByDivergence } from '@/lib/estimator'
import type { Country } from '@/lib/mockData'
import Sidebar from '@/components/Sidebar'
import CountryDetail from '@/components/CountryDetail'
import DefaultDashboard from '@/components/DefaultDashboard'

const WorldMap = dynamic(() => import('@/components/WorldMap'), { ssr: false })

export default function OSPIPage() {
  const [selected, setSelected] = useState<Country | null>(null)
  const [query,    setQuery]    = useState('')

  const sorted   = useMemo(() => sortByDivergence(countries), [])
  const filtered = useMemo(
    () => sorted.filter(c => c.name.toLowerCase().includes(query.toLowerCase())),
    [sorted, query],
  )

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-zinc-950 overflow-hidden">

      {/* ── Top bar ── */}
      <header className="flex items-center gap-3 px-4 h-9 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[11px] font-bold tracking-widest uppercase text-zinc-700 dark:text-zinc-300">OSPI</span>
        <span className="text-[11px] text-zinc-300 dark:text-zinc-600">Open Signal Population Index</span>
        <div className="ml-auto flex items-center gap-4 text-[9px] text-zinc-300 dark:text-zinc-600 uppercase tracking-wider">
          <span>{countries.length} countries · 5 signals · mock data</span>
          {selected && (
            <button
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
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

          {/* ── Left of main: detail / dashboard (fills most space) ── */}
          <div className="flex-1 overflow-hidden border-r border-zinc-100 dark:border-zinc-800">
            {selected
              ? <CountryDetail country={selected} />
              : <DefaultDashboard />
            }
          </div>

          {/* ── Right of main: square map ── */}
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

            {/* Square map — 320×320 */}
            <div style={{ width: 320, height: 320 }} className="shrink-0 overflow-hidden">
              <WorldMap
                countries={countries}
                selected={selected}
                onSelect={setSelected}
              />
            </div>

            {/* Below map: quick stats or selected country mini-info */}
            <div className="flex-1 overflow-y-auto border-t border-zinc-100 dark:border-zinc-800 p-3"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(113,113,122,0.2) transparent' }}
            >
              {selected ? (
                <div className="space-y-2">
                  <p className="text-[9px] uppercase tracking-widest text-zinc-400 font-medium">Quick stats</p>
                  {[
                    { label: 'Official',   value: `${selected.official}M` },
                    { label: 'OSPI est.',  value: `${selected.ospi}M`     },
                    { label: 'Urban',      value: `${selected.urbanPct}%` },
                    { label: 'Density',    value: `${selected.densityKm2}/km²` },
                    { label: 'Growth',     value: `${selected.growthRate > 0 ? '+' : ''}${selected.growthRate}%/yr` },
                    { label: 'GDP/cap',    value: `$${selected.gdpPerCapita.toLocaleString()}` },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-400">{r.label}</span>
                      <span className="text-[10px] font-mono font-medium text-zinc-700 dark:text-zinc-300">{r.value}</span>
                    </div>
                  ))}

                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <p className="text-[9px] uppercase tracking-widest text-zinc-400 font-medium mb-1.5">Signals</p>
                    {Object.entries(selected.signals).map(([k, v]) => (
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
              ) : (
                <div className="space-y-2">
                  <p className="text-[9px] uppercase tracking-widest text-zinc-400 font-medium">Top anomalies</p>
                  {sortByDivergence(countries).slice(0, 15).map(c => {
                    const d   = Math.round((c.ospi - c.official) / c.official * 100)
                    const isP = d >= 0
                    return (
                      <button
                        key={c.name}
                        className="w-full flex items-center justify-between text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded px-1.5 py-1 transition-colors"
                        onClick={() => setSelected(c)}
                      >
                        <span className="text-[10px] text-zinc-600 dark:text-zinc-400 truncate">{c.name}</span>
                        <span className="text-[10px] font-mono font-semibold ml-1 shrink-0" style={{ color: isP ? '#1D9E75' : '#E24B4A' }}>
                          {isP ? '+' : ''}{d}%
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

        </main>
      </div>
    </div>
  )
}