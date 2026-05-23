'use client'

import { useEffect, useRef } from 'react'
import { useCountries } from '@/lib/useCountries'
import { useDataSource } from '@/lib/dataSource'
import { confColor, confLabel, globalStats } from '@/lib/estimator'
import { fmt, fmtB, fmtGap, fmtPct } from '@/lib/fmt'
import type { Chart as ChartType } from 'chart.js'

function calcDelta(c: { ospi: number; official: number }): number {
  return parseFloat(((c.ospi - c.official) / c.official * 100).toFixed(2))
}

export default function DefaultDashboard() {
  const countries = useCountries()
  const { noSignals } = useDataSource()

  const barRef = useRef<HTMLCanvasElement>(null)
  const scatterRef = useRef<HTMLCanvasElement>(null)
  const barInst = useRef<ChartType | null>(null)
  const scatInst = useRef<ChartType | null>(null)

  const stats = globalStats(countries)

  const topDivergence = [...countries]
    .sort((a, b) => Math.abs(calcDelta(b)) - Math.abs(calcDelta(a)))
    .slice(0, 8)

  const declining = [...countries]
    .filter(c => c.growthRate < 0)
    .sort((a, b) => {
      // score = growthRate penalized by small population
      // official is in millions — log scale so China doesn't totally dominate
      const score = (c: { growthRate: number; official: number }) =>
        c.growthRate * Math.log10(Math.max(c.official, 0.1))
      return score(a) - score(b)
    })
    .slice(0, 8)
  const fastest = [...countries].sort((a, b) => b.growthRate - a.growthRate).slice(0, 4)
  const alphabetical = [...countries].sort((a, b) => a.name.localeCompare(b.name))

  useEffect(() => {
    if (!barRef.current || !scatterRef.current) return

    const init = async () => {
      const {
        Chart, BarController, ScatterController,
        BarElement, PointElement,
        LinearScale, CategoryScale, Tooltip, Legend,
      } = await import('chart.js')
      Chart.register(BarController, ScatterController, BarElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend)

      barInst.current?.destroy()
      scatInst.current?.destroy()

      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const tick = isDark ? '#52525b' : '#a1a1aa'
      const grid = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
      const tooltipBase = {
        backgroundColor: isDark ? '#18181b' : '#fff',
        borderColor: isDark ? '#27272a' : '#e4e4e7',
        borderWidth: 1,
        titleColor: isDark ? '#a1a1aa' : '#71717a',
        bodyColor: isDark ? '#f4f4f5' : '#18181b',
        padding: 8,
      }

      // Divergence bar chart
      barInst.current = new Chart(barRef.current!, {
        type: 'bar',
        data: {
          labels: topDivergence.map(c => c.name),
          datasets: [
            {
              label: 'Official',
              data: topDivergence.map(c => parseFloat(c.official.toFixed(2))),
              backgroundColor: isDark ? 'rgba(113,113,122,0.35)' : 'rgba(161,161,170,0.35)',
              borderRadius: 3,
              barPercentage: 0.65,
            },
            {
              label: 'OSPI',
              data: topDivergence.map(c => parseFloat(c.ospi.toFixed(2))),
              backgroundColor: topDivergence.map(c =>
                c.ospi > c.official ? '#1D9E75' : '#E24B4A'
              ),
              borderRadius: 3,
              barPercentage: 0.65,
            },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: true, labels: { color: tick, font: { size: 9 }, boxWidth: 10, padding: 12 } },
            tooltip: {
              ...tooltipBase,
              callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y as number)}` },
            },
          },
          scales: {
            x: { ticks: { color: tick, font: { size: 9 } }, grid: { display: false }, border: { display: false } },
            y: {
              ticks: {
                color: tick,
                font: { size: 9 },
                callback: v => fmt(v as number),
              },
              grid: { color: grid },
              border: { display: false },
            },
          },
        },
      })

      // Scatter: signal composite vs divergence
      scatInst.current = new Chart(scatterRef.current!, {
        type: 'scatter',
        data: {
          datasets: [{
            label: 'Countries',
            data: countries.map(c => ({
              x: parseFloat((Object.values(c.signals).reduce((a, b) => a + b, 0) / 5).toFixed(2)),
              y: parseFloat(Math.abs(calcDelta(c)).toFixed(2)),
              label: c.name,
            })),
            backgroundColor: countries.map(c =>
              noSignals
                ? (isDark ? 'rgba(113,113,122,0.3)' : 'rgba(161,161,170,0.3)')
                : confColor(c.conf) + 'bb'
            ),
            pointRadius: 5,
            pointHoverRadius: 7,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              ...tooltipBase,
              callbacks: {
                label: (ctx: any) => {
                  const d = ctx.raw as any
                  return ` ${d.label}  sig:${d.x.toFixed(2)}  div:${d.y.toFixed(2)}%`
                },
              },
            },
          },
          scales: {
            x: {
              title: { display: true, text: 'Avg signal score', color: tick, font: { size: 9 } },
              ticks: { color: tick, font: { size: 9 }, callback: v => (v as number).toFixed(0) },
              grid: { color: grid },
              border: { display: false },
            },
            y: {
              title: { display: true, text: 'Divergence %', color: tick, font: { size: 9 } },
              ticks: { color: tick, font: { size: 9 }, callback: v => `${(v as number).toFixed(2)}%` },
              grid: { color: grid },
              border: { display: false },
            },
          },
        },
      })
    }

    init()
    return () => { barInst.current?.destroy(); scatInst.current?.destroy() }
  }, [countries, noSignals])

  const statCards = [
    {
      label: 'Official world pop.',
      value: fmtB(stats.totalOfficial / 1000),
      sub: 'Government census sum',
    },
    {
      label: 'OSPI world estimate',
      value: fmtB(stats.totalOspi / 1000),
      sub: 'Signal-weighted model',
    },
    {
      label: 'Global gap',
      value: fmtGap(stats.totalOspi - stats.totalOfficial),
      sub: 'Absolute divergence',
      color: '#EF9F27',
    },
    {
      label: 'Avg divergence',
      value: `±${stats.avgDivergence.toFixed(2)}%`,
      sub: 'Across all countries',
      color: '#EF9F27',
    },
    {
      label: 'High confidence',
      value: `${stats.highConf}`,
      sub: `of ${countries.length} countries`,
      color: '#1D9E75',
    },
    {
      label: 'Low confidence',
      value: `${stats.lowConf}`,
      sub: 'Disputed or sparse',
      color: '#E24B4A',
    },
  ]

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(113,113,122,0.2) transparent' }}
    >
      <style>{`.dd-scroll::-webkit-scrollbar{width:3px}.dd-scroll::-webkit-scrollbar-track{background:transparent}.dd-scroll::-webkit-scrollbar-thumb{background:rgba(113,113,122,0.2);border-radius:99px}`}</style>
      <div className="dd-scroll h-full overflow-y-auto">
        <div className="p-4 space-y-4">

          {/* Header */}
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Global Population Intelligence</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Signal-based population estimates across {countries.length} countries · Select any country for detailed analysis · Model run: 2024-Q2
            </p>
          </div>

          {/* UN source notice */}
          {noSignals && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20">
              <svg className="text-amber-500 shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-[10px] text-amber-700 dark:text-amber-400">
                UN WPP source active — signal data not yet available. OSPI estimates mirror official figures until model runs.
              </p>
            </div>
          )}

          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-2">
            {statCards.map(k => (
              <div key={k.label} className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg px-3 py-2.5">
                <p className="text-[9px] uppercase tracking-wider text-zinc-400 mb-1">{k.label}</p>
                <p className="text-lg font-semibold leading-none" style={k.color ? { color: k.color } : {}}>
                  <span className={!k.color ? 'text-zinc-800 dark:text-zinc-100' : ''}>{k.value}</span>
                </p>
                <p className="text-[9px] text-zinc-400 mt-1">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Divergence bar chart */}
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">Official vs OSPI — top divergence countries</p>
              <span className="text-[9px] text-zinc-300 dark:text-zinc-600">auto-scaled</span>
            </div>
            <div style={{ height: 140 }}>
              <canvas ref={barRef} />
            </div>
          </div>

          {/* Row: scatter + fastest growth */}
          <div className="grid grid-cols-2 gap-3">

            {/* Scatter — grayed out when no signals */}
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg p-3 flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">Signal quality vs divergence</p>
                {noSignals && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-400">no signals</span>
                )}
              </div>
              <p className="text-[9px] text-zinc-300 dark:text-zinc-600 mb-2">Higher signal → lower divergence expected</p>
              <div className={`${noSignals ? 'opacity-40 pointer-events-none' : ''}`} style={{ height: 120 }}>
                <canvas ref={scatterRef} />
              </div>

              {/* Derived insight strip */}
              {!noSignals && (
                <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                  {(() => {
                    const highSigCountries = countries.filter(c => Math.round(Object.values(c.signals).reduce((a, b) => a + b, 0) / 5) >= 75)
                    const lowSigCountries = countries.filter(c => Math.round(Object.values(c.signals).reduce((a, b) => a + b, 0) / 5) < 50)
                    const avgDivHighSig = (highSigCountries.reduce((s, c) => s + Math.abs(calcDelta(c)), 0) / (highSigCountries.length || 1)).toFixed(2)
                    const avgDivLowSig = (lowSigCountries.reduce((s, c) => s + Math.abs(calcDelta(c)), 0) / (lowSigCountries.length || 1)).toFixed(2)
                    const outliers = countries.filter(c => {
                      const sig = Math.round(Object.values(c.signals).reduce((a, b) => a + b, 0) / 5)
                      const div = Math.abs(calcDelta(c))
                      return (sig >= 75 && div > 5) || (sig < 50 && div < 3)
                    })
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-zinc-400">Avg divergence · high signal</span>
                          <span className="text-[9px] font-mono font-semibold text-emerald-500">±{avgDivHighSig}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-zinc-400">Avg divergence · low signal</span>
                          <span className="text-[9px] font-mono font-semibold text-red-500">±{avgDivLowSig}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-zinc-400">Signal–divergence outliers</span>
                          <span className="text-[9px] font-mono font-medium text-amber-500">{outliers.length} countries</span>
                        </div>
                        <p className="text-[9px] text-zinc-300 dark:text-zinc-600 leading-relaxed">
                          Countries breaking the expected pattern: high signal (≥75) but &gt;5% divergence, or low signal (&lt;50) but &lt;3% divergence.
                          {outliers.length > 0 && <> e.g. <span className="text-zinc-400 dark:text-zinc-500">{outliers.slice(0, 2).map(c => c.name).join(', ')}</span>.</>}
                        </p>
                      </>
                    )
                  })()}
                </div>
              )}

              {/* Placeholder when no signals */}
              {noSignals && (
                <p className="mt-3 text-[9px] text-zinc-300 dark:text-zinc-600 border-t border-zinc-100 dark:border-zinc-800 pt-2.5">
                  Signal insight unavailable — run your model to populate signal scores.
                </p>
              )}
            </div>

            {/* Fastest growing */}
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium mb-2">Fastest growing</p>
              <div className="space-y-2">
                {fastest.map(c => (
                  <div key={c.name} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: confColor(c.conf) }} />
                    <span className="text-xs text-zinc-700 dark:text-zinc-300 flex-1 truncate">{c.name}</span>
                    <span className="text-xs font-mono font-semibold text-emerald-500">{fmtPct(c.growthRate, true)}</span>
                    <div className="w-16 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${(c.growthRate / 3.5) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium mb-2">Declining populations</p>
                <div className="space-y-1.5">
                  {declining.length > 0 ? declining.map(c => (
                    <div key={c.name} className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{c.name}</span>
                      <span className="text-[11px] font-mono font-semibold text-red-500">{fmtPct(c.growthRate)}/yr</span>
                    </div>
                  )) : (
                    <p className="text-[10px] text-zinc-300 dark:text-zinc-600">None in current dataset</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Summary table — alphabetical */}
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">All countries — A → Z</p>
              <div className="flex gap-3">
                {[
                  { label: 'High', col: '#1D9E75' },
                  { label: 'Med', col: '#EF9F27' },
                  { label: 'Low', col: '#E24B4A' },
                ].map(b => (
                  <span key={b.label} className="flex items-center gap-1 text-[9px]" style={{ color: b.col }}>
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: b.col }} />
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  {['Country', 'Region', 'Official', 'OSPI', 'Δ', 'Growth', 'Conf.'].map(h => (
                    <th key={h} className="text-left px-3 py-1.5 text-[9px] uppercase tracking-wider text-zinc-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alphabetical.map((c, i) => {
                  const d = calcDelta(c)
                  const isP = d >= 0
                  const col = noSignals
                    ? '#a1a1aa'
                    : confColor(c.conf)
                  return (
                    <tr
                      key={c.name}
                      className={`border-b border-zinc-100 dark:border-zinc-800 last:border-0 ${i % 2 === 0 ? '' : 'bg-white/50 dark:bg-zinc-950/30'}`}
                    >
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: col }} />
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-zinc-400 text-[10px]">{c.region}</td>
                      <td className="px-3 py-1.5 font-mono text-zinc-500 dark:text-zinc-400">{fmt(c.official)}</td>
                      <td className="px-3 py-1.5 font-mono font-medium text-zinc-700 dark:text-zinc-300">{fmt(c.ospi)}</td>
                      <td className="px-3 py-1.5 font-mono font-semibold" style={{ color: isP ? '#1D9E75' : '#E24B4A' }}>
                        {fmtPct(d, true)}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[10px]" style={{ color: c.growthRate >= 0 ? '#1D9E75' : '#E24B4A' }}>
                        {fmtPct(c.growthRate, true)}
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                          style={noSignals
                            ? { background: 'rgba(161,161,170,0.1)', color: '#a1a1aa' }
                            : { background: `${col}18`, color: col }
                          }
                        >
                          {noSignals ? '—' : confLabel(c.conf)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  )
}