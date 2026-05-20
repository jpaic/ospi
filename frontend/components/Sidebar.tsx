'use client'

import { useState } from 'react'
import type { Country } from '@/lib/mockData'
import { deltaStr, confLabel, confColor, globalStats } from '@/lib/estimator'
import { useCountries } from '@/lib/useCountries'
import { useDataSource } from '@/lib/dataSource'

interface Props {
  countries: Country[]
  selected: Country | null
  onSelect: (c: Country) => void
  query: string
  onSearch: (q: string) => void
}

function ConfDot({ conf }: { conf: Country['conf'] }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full inline-block shrink-0 mt-0.5"
      style={{ background: confColor(conf) }}
    />
  )
}

export default function Sidebar({ countries, selected, onSelect, query, onSearch }: Props) {
  const [expandedRegions, setExpandedRegions] = useState<string | null>(null)
  const allCountries = useCountries()
  const { noSignals } = useDataSource()
  const stats = globalStats(allCountries)

  const toggleRegions = (name: string) =>
    setExpandedRegions(prev => (prev === name ? null : name))

  return (
    <aside className="w-72 flex flex-col border-r border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 shrink-0 overflow-hidden">
      <style>{`
        .sb-scroll::-webkit-scrollbar { width: 3px; }
        .sb-scroll::-webkit-scrollbar-track { background: transparent; }
        .sb-scroll::-webkit-scrollbar-thumb { background: rgba(113,113,122,0.2); border-radius: 99px; }
        .sb-scroll::-webkit-scrollbar-thumb:hover { background: rgba(113,113,122,0.4); }
      `}</style>

      {/* ── Global stats block ── */}
      <div className="px-3 pt-3 pb-2.5 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        <p className="text-[9px] font-medium tracking-widest uppercase text-zinc-400 mb-2">Global overview</p>
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          {[
            { label: 'Official total', value: `${(stats.totalOfficial / 1000).toFixed(1)}B` },
            { label: 'OSPI total',     value: `${(stats.totalOspi / 1000).toFixed(1)}B`     },
            { label: 'Avg divergence', value: `±${stats.avgDivergence}%`                    },
            { label: 'Countries',      value: String(allCountries.length)                   },
          ].map(s => (
            <div key={s.label} className="bg-zinc-50 dark:bg-zinc-900 rounded px-2 py-1.5">
              <p className="text-[9px] text-zinc-400 uppercase tracking-wider">{s.label}</p>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Confidence breakdown bar */}
        <div className="mb-2">
          <div className="flex justify-between text-[9px] text-zinc-400 mb-1">
            <span>Confidence breakdown</span>
            <span>{allCountries.length} countries</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
            <div className="h-full bg-emerald-500" style={{ width: `${(stats.highConf / allCountries.length) * 100}%` }} />
            <div className="h-full bg-amber-400"   style={{ width: `${((allCountries.length - stats.highConf - stats.lowConf) / allCountries.length) * 100}%` }} />
            <div className="h-full bg-red-500"     style={{ width: `${(stats.lowConf / allCountries.length) * 100}%` }} />
          </div>
          <div className="flex gap-3 mt-1">
            {[
              { label: `High ${stats.highConf}`,                                        col: 'text-emerald-500' },
              { label: `Med ${allCountries.length - stats.highConf - stats.lowConf}`,   col: 'text-amber-500'  },
              { label: `Low ${stats.lowConf}`,                                          col: 'text-red-500'    },
            ].map(b => (
              <span key={b.label} className={`text-[9px] font-medium ${b.col}`}>{b.label}</span>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => onSearch(e.target.value)}
            placeholder="Filter countries…"
            className="w-full text-xs pl-6 pr-2 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* ── Sort hint ── */}
      <div className="px-3 py-1 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
        <p className="text-[9px] text-zinc-300 dark:text-zinc-700 uppercase tracking-wider">Sorted by divergence</p>
        <p className="text-[9px] text-zinc-300 dark:text-zinc-700">{countries.length} results</p>
      </div>

      {/* ── Country list ── */}
      <ul
        className="sb-scroll overflow-y-auto flex-1"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(113,113,122,0.2) transparent' }}
      >
        {countries.map(c => {
          const delta    = deltaStr(c)
          const isPos    = c.ospi >= c.official
          const isActive = selected?.name === c.name
          const hasReg   = c.regions.length > 0
          const regOpen  = expandedRegions === c.name
          const divAbs   = Math.abs(c.ospi - c.official)
          const avgSig   = Math.round(Object.values(c.signals).reduce((a, b) => a + b, 0) / 5)

          return (
            <li key={c.name} className="border-b border-zinc-50 dark:border-zinc-900">
              {/* Country row */}
              <div
                className={`flex items-start gap-2 px-3 py-2 transition-colors cursor-pointer
                  ${isActive
                    ? 'bg-zinc-50 dark:bg-zinc-900/80 border-l-2 border-l-emerald-500 pl-2.5'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50 border-l-2 border-l-transparent'
                  }`}
                onClick={() => onSelect(c)}
              >
                <ConfDot conf={c.conf} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{c.name}</span>
                    <span
                      className="text-[10px] font-mono font-semibold ml-1 shrink-0"
                      style={{ color: isPos ? '#1D9E75' : '#E24B4A' }}
                    >{delta}</span>
                  </div>

                  {/* Mini signal bar — grayed out when no signals */}
                  <div className={`flex items-center gap-1.5 mt-0.5 ${noSignals ? 'opacity-40' : ''}`}>
                    <div className="flex-1 h-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: noSignals ? '0%' : `${avgSig}%`,
                          background: avgSig >= 75 ? '#1D9E75' : avgSig >= 50 ? '#EF9F27' : '#E24B4A',
                        }}
                      />
                    </div>
                    <span className="text-[9px] text-zinc-300 dark:text-zinc-600 font-mono w-12 shrink-0">
                      {divAbs}M gap
                    </span>
                  </div>

                  {/* Meta row */}
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[9px] text-zinc-300 dark:text-zinc-600">{c.region}</span>
                    <span className="text-[9px] text-zinc-300 dark:text-zinc-600">·</span>
                    <span className="text-[9px] text-zinc-300 dark:text-zinc-600">{c.growthRate > 0 ? '+' : ''}{c.growthRate}%/yr</span>
                  </div>
                </div>

                {/* Region toggle */}
                {hasReg && (
                  <button
                    className="text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors shrink-0 mt-0.5"
                    onClick={e => { e.stopPropagation(); toggleRegions(c.name) }}
                    title="Toggle regions"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d={regOpen ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
                    </svg>
                  </button>
                )}
              </div>

              {/* ── Region sub-list ── */}
              {regOpen && (
                <ul className="bg-zinc-50 dark:bg-zinc-900/60 border-t border-zinc-100 dark:border-zinc-800">
                  {c.regions.map(r => {
                    const rDelta = Math.round((r.ospi - r.pop) / r.pop * 100)
                    const rPos   = r.ospi >= r.pop
                    return (
                      <li
                        key={r.name}
                        className="flex items-center gap-2 px-4 py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                      >
                        <ConfDot conf={r.conf} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate">{r.name}</span>
                            <span
                              className="text-[10px] font-mono shrink-0 ml-1"
                              style={{ color: rPos ? '#1D9E75' : '#E24B4A' }}
                            >
                              {rPos ? '+' : ''}{rDelta}%
                            </span>
                          </div>
                          <div className="flex gap-2 text-[9px] text-zinc-300 dark:text-zinc-600 mt-0.5">
                            <span>Off: {r.pop}M</span>
                            <span>·</span>
                            <span>OSPI: {r.ospi}M</span>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </aside>
  )
}