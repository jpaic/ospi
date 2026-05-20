'use client'

import { useEffect, useRef } from 'react'
import type { Country } from '@/lib/mockData'
import { deltaStr, signalColor, confLabel, confColor } from '@/lib/estimator'
import { useDataSource } from '@/lib/dataSource'
import type { Chart as ChartType } from 'chart.js'

interface Props { country: Country }

const SIGNALS: { key: keyof Country['signals']; label: string }[] = [
  { key: 'telecom',     label: 'Telecom'     },
  { key: 'electricity', label: 'Electricity' },
  { key: 'building',    label: 'Building'    },
  { key: 'mobility',    label: 'Mobility'    },
  { key: 'internet',    label: 'Internet'    },
]

export default function CountryDetail({ country: c }: Props) {
  const { noSignals } = useDataSource()

  const trendRef  = useRef<HTMLCanvasElement>(null)
  const radarRef  = useRef<HTMLCanvasElement>(null)
  const barRef    = useRef<HTMLCanvasElement>(null)
  const trendInst = useRef<ChartType | null>(null)
  const radarInst = useRef<ChartType | null>(null)
  const barInst   = useRef<ChartType | null>(null)

  const delta  = deltaStr(c)
  const isPos  = c.ospi >= c.official
  const badge  = noSignals ? '#a1a1aa' : confColor(c.conf)
  const avgSig = Math.round(Object.values(c.signals).reduce((a, b) => a + b, 0) / 5)

  useEffect(() => {
    if (!trendRef.current || !radarRef.current || !barRef.current) return

    const init = async () => {
      const {
        Chart, LineController, RadarController, BarController,
        LineElement, BarElement, PointElement, RadialLinearScale,
        LinearScale, CategoryScale, Tooltip, Filler, Legend,
      } = await import('chart.js')
      Chart.register(
        LineController, RadarController, BarController,
        LineElement, BarElement, PointElement, RadialLinearScale,
        LinearScale, CategoryScale, Tooltip, Filler, Legend,
      )

      trendInst.current?.destroy()
      radarInst.current?.destroy()
      barInst.current?.destroy()

      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const tick   = isDark ? '#52525b' : '#a1a1aa'
      const grid   = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
      const tooltipOpts = {
        backgroundColor: isDark ? '#18181b' : '#fff',
        borderColor:     isDark ? '#27272a' : '#e4e4e7',
        borderWidth: 1,
        titleColor: isDark ? '#a1a1aa' : '#71717a',
        bodyColor:  isDark ? '#f4f4f5' : '#18181b',
        padding: 8,
      }

      // ── Trend chart ──
      trendInst.current = new Chart(trendRef.current!, {
        type: 'line',
        data: {
          labels: c.history.map(h => String(h.y)),
          datasets: [
            {
              label: 'OSPI',
              data:  c.history.map(h => Math.round(h.v)),
              borderColor: '#1D9E75',
              backgroundColor: isDark ? 'rgba(29,158,117,0.1)' : 'rgba(29,158,117,0.07)',
              borderWidth: 2,
              pointRadius: 3,
              pointBackgroundColor: '#1D9E75',
              fill: true,
              tension: 0.4,
            },
            {
              label: 'Official',
              data:  c.history.map(() => c.official),
              borderColor: isDark ? '#3f3f46' : '#d4d4d8',
              borderWidth: 1.5,
              borderDash: [5, 4],
              pointRadius: 0,
              fill: false,
            },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: { ...tooltipOpts, callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}M` } },
          },
          scales: {
            x: { ticks: { color: tick, font: { size: 9 } }, grid: { display: false }, border: { display: false } },
            y: { ticks: { color: tick, font: { size: 9 }, callback: v => `${v}M` }, grid: { color: grid }, border: { display: false } },
          },
        },
      })

      // ── Radar chart ──
      radarInst.current = new Chart(radarRef.current!, {
        type: 'radar',
        data: {
          labels: ['Telecom', 'Electricity', 'Building', 'Mobility', 'Internet'],
          datasets: [{
            data: SIGNALS.map(s => c.signals[s.key]),
            backgroundColor: noSignals
              ? (isDark ? 'rgba(113,113,122,0.1)' : 'rgba(161,161,170,0.1)')
              : (isDark ? 'rgba(29,158,117,0.15)' : 'rgba(29,158,117,0.1)'),
            borderColor: noSignals ? '#71717a' : '#1D9E75',
            borderWidth: 1.5,
            pointBackgroundColor: noSignals ? '#71717a' : '#1D9E75',
            pointRadius: 3,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: tooltipOpts },
          scales: {
            r: {
              min: 0, max: 100,
              ticks: { color: tick, font: { size: 8 }, stepSize: 25, backdropColor: 'transparent' },
              grid:  { color: grid },
              pointLabels: { color: tick, font: { size: 9 } },
              angleLines: { color: grid },
            },
          },
        },
      })

      // ── Region bar chart ──
      if (c.regions.length > 0) {
        barInst.current = new Chart(barRef.current!, {
          type: 'bar',
          data: {
            labels: c.regions.map(r => r.name),
            datasets: [
              {
                label: 'Official',
                data:  c.regions.map(r => r.pop),
                backgroundColor: isDark ? 'rgba(113,113,122,0.4)' : 'rgba(161,161,170,0.4)',
                borderRadius: 3,
                barPercentage: 0.6,
              },
              {
                label: 'OSPI',
                data:  c.regions.map(r => r.ospi),
                backgroundColor: '#1D9E75',
                borderRadius: 3,
                barPercentage: 0.6,
              },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: true, labels: { color: tick, font: { size: 9 }, boxWidth: 10, padding: 10 } },
              tooltip: { ...tooltipOpts, callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}M` } },
            },
            scales: {
              x: { ticks: { color: tick, font: { size: 9 } }, grid: { display: false }, border: { display: false } },
              y: { ticks: { color: tick, font: { size: 9 }, callback: v => `${v}M` }, grid: { color: grid }, border: { display: false } },
            },
          },
        })
      }
    }

    init()
    return () => {
      trendInst.current?.destroy()
      radarInst.current?.destroy()
      barInst.current?.destroy()
    }
  }, [c, noSignals])

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(113,113,122,0.2) transparent' }}
    >
      <style>{`.det-scroll::-webkit-scrollbar{width:3px}.det-scroll::-webkit-scrollbar-track{background:transparent}.det-scroll::-webkit-scrollbar-thumb{background:rgba(113,113,122,0.2);border-radius:99px}.det-scroll::-webkit-scrollbar-thumb:hover{background:rgba(113,113,122,0.4)}`}</style>
      <div className="det-scroll h-full overflow-y-auto">
        <div className="p-4 space-y-4">

          {/* ── Header ── */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{c.name}</h2>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">ISO {c.iso}</span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {c.region}
                {c.densityKm2  ? ` · ${c.densityKm2} people/km²` : ''}
                {c.urbanPct    ? ` · ${c.urbanPct}% urban`        : ''}
              </p>
            </div>
            <div
              className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
              style={{ background: `${badge}18`, color: badge }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: badge }} />
              {noSignals ? 'Unscored' : confLabel(c.conf)} confidence
            </div>
          </div>

          {/* ── KPI strip ── */}
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: 'Official pop.',  value: `${c.official}M`,   sub: 'Census reported',    color: '' },
              { label: 'OSPI estimate',  value: `${c.ospi}M`,       sub: 'Signal-weighted',    color: '#1D9E75' },
              { label: 'Divergence',     value: delta,               sub: `${Math.abs(c.ospi - c.official)}M gap`, color: isPos ? '#1D9E75' : '#E24B4A' },
              { label: 'GDP / capita',   value: c.gdpPerCapita ? `$${c.gdpPerCapita.toLocaleString()}` : '—', sub: 'USD nominal', color: '' },
              { label: 'Annual growth',  value: `${c.growthRate > 0 ? '+' : ''}${c.growthRate}%`, sub: 'Rate p.a.', color: c.growthRate >= 0 ? '#1D9E75' : '#E24B4A' },
            ].map(k => (
              <div key={k.label} className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg px-3 py-2.5">
                <p className="text-[9px] uppercase tracking-wider text-zinc-400 mb-1">{k.label}</p>
                <p className="text-base font-semibold leading-none" style={k.color ? { color: k.color } : {}}>
                  <span className={!k.color ? 'text-zinc-800 dark:text-zinc-100' : ''}>{k.value}</span>
                </p>
                <p className="text-[9px] text-zinc-400 mt-1">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Charts row 1: Trend + Radar ── */}
          <div className="grid grid-cols-3 gap-3">
            {/* Trend */}
            <div className="col-span-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">Population trend</p>
                <div className="flex gap-3">
                  {[{ col: '#1D9E75', label: 'OSPI' }, { col: '#a1a1aa', label: 'Official', dashed: true }].map(l => (
                    <span key={l.label} className="flex items-center gap-1 text-[9px] text-zinc-400">
                      <span
                        className="inline-block w-4 h-px border-t"
                        style={l.dashed
                          ? { borderColor: l.col, borderStyle: 'dashed' }
                          : { background: l.col, borderTopWidth: '2px' }
                        }
                      />
                      {l.label}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ height: 100 }}>
                <canvas ref={trendRef} />
              </div>
            </div>

            {/* Radar — grayed out when no signals */}
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">Signal radar</p>
                {noSignals && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-400">no signals</span>
                )}
              </div>
              <div className={noSignals ? 'opacity-40 pointer-events-none' : ''} style={{ height: 118 }}>
                <canvas ref={radarRef} />
              </div>
            </div>
          </div>

          {/* ── Charts row 2: Signal bars + Region bar ── */}
          <div className="grid grid-cols-3 gap-3">
            {/* Signal bars — grayed out when no signals */}
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">Signal scores</p>
                {noSignals && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-400">no signals</span>
                )}
              </div>
              <div className={`space-y-2 ${noSignals ? 'opacity-40 pointer-events-none' : ''}`}>
                {SIGNALS.map(({ key, label }) => {
                  const v   = c.signals[key]
                  const col = noSignals ? '#a1a1aa' : signalColor(v)
                  return (
                    <div key={key}>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{label}</span>
                        <span className="text-[10px] font-mono font-semibold" style={{ color: col }}>{v}/100</span>
                      </div>
                      <div className="h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${v}%`, background: col }} />
                      </div>
                    </div>
                  )
                })}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                  <span className="text-[9px] text-zinc-400 uppercase tracking-wider">Composite</span>
                  <span className="text-sm font-semibold" style={{ color: noSignals ? '#a1a1aa' : signalColor(avgSig) }}>
                    {noSignals ? '—' : avgSig}
                  </span>
                </div>
              </div>
              {noSignals && (
                <p className="text-[9px] text-zinc-300 dark:text-zinc-600 mt-2">
                  Run your model to populate signal scores.
                </p>
              )}
            </div>

            {/* Region bar chart */}
            <div className="col-span-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium mb-2">Regional breakdown</p>
              {c.regions.length > 0 ? (
                <div style={{ height: 130 }}>
                  <canvas ref={barRef} />
                </div>
              ) : (
                <div className="flex items-center justify-center h-24 text-[10px] text-zinc-300 dark:text-zinc-700">
                  No regional data
                </div>
              )}
            </div>
          </div>

          {/* ── Region table ── */}
          {c.regions.length > 0 && (
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">Sub-national regions</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    {['Region', 'Official', 'OSPI est.', 'Divergence', 'Confidence'].map(h => (
                      <th key={h} className="text-left px-3 py-1.5 text-[9px] uppercase tracking-wider text-zinc-400 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {c.regions.map((r, i) => {
                    const rDelta = Math.round((r.ospi - r.pop) / r.pop * 100)
                    const rPos   = r.ospi >= r.pop
                    const rCol   = noSignals ? '#a1a1aa' : confColor(r.conf)
                    return (
                      <tr
                        key={r.name}
                        className={`border-b border-zinc-100 dark:border-zinc-800 last:border-0 ${i % 2 === 0 ? '' : 'bg-zinc-50/50 dark:bg-zinc-900/50'}`}
                      >
                        <td className="px-3 py-1.5 font-medium text-zinc-700 dark:text-zinc-300">{r.name}</td>
                        <td className="px-3 py-1.5 font-mono text-zinc-500 dark:text-zinc-400">{r.pop}M</td>
                        <td className="px-3 py-1.5 font-mono font-semibold text-zinc-700 dark:text-zinc-300">{r.ospi}M</td>
                        <td className="px-3 py-1.5 font-mono font-semibold" style={{ color: rPos ? '#1D9E75' : '#E24B4A' }}>
                          {rPos ? '+' : ''}{rDelta}%
                        </td>
                        <td className="px-3 py-1.5">
                          <span
                            className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{ background: `${rCol}18`, color: rCol }}
                          >
                            {noSignals ? '—' : confLabel(r.conf)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Methodology note ── */}
          <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 px-3 py-2 flex gap-2 items-start">
            <svg className="text-zinc-300 dark:text-zinc-600 mt-0.5 shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
            </svg>
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              OSPI estimates are probabilistic models derived from weighted signal indicators.
              Confidence reflects data source reliability. Estimates should not be treated as official counts.
              Last model run: <span className="font-mono">2023-Q4</span>.
              {noSignals && ' · Signal data not yet available for this source — OSPI mirrors official figures until your model runs.'}
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}