'use client'

import { useEffect, useRef, useState } from 'react'
import type { Country } from '@/lib/types'
import { confLabel, confColor } from '@/lib/estimator'
import { fmt, fmtGap, fmtPct, fmtUsd, fmtDensity } from '@/lib/fmt'
import { useDataSource } from '@/lib/dataSource'
import { fetchVersion } from '@/lib/version'
import type { Chart as ChartType } from 'chart.js'


interface Props { country: Country; onBack?: () => void }

const SIGNALS: { key: keyof Country['signals']; label: string }[] = [
  { key: 'telecom', label: 'Telecom' },
  { key: 'electricity', label: 'Electricity' },
  { key: 'building', label: 'Building' },
  { key: 'mobility', label: 'Mobility' },
  { key: 'internet', label: 'Internet' },
]

function signalColor(v: number): string {
  if (v >= 75) return '#1D9E75'
  if (v >= 50) return '#EF9F27'
  return '#E24B4A'
}

function deltaStr(c: Country): string {
  const pct = ((c.ospi - c.official) / c.official) * 100
  return (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%'
}

export default function CountryDetail({ country: c, onBack }: Props) {
  const { noSignals } = useDataSource()
  const [modelRun, setModelRun] = useState('—')

  useEffect(() => {
    fetchVersion().then(v => { if (v?.model_run) setModelRun(v.model_run) })
  }, [])

  const trendRef = useRef<HTMLCanvasElement>(null)
  const radarRef = useRef<HTMLCanvasElement>(null)
  const barRef = useRef<HTMLCanvasElement>(null)
  const trendInst = useRef<ChartType | null>(null)
  const radarInst = useRef<ChartType | null>(null)
  const barInst = useRef<ChartType | null>(null)

  const delta = deltaStr(c)
  const isPos = c.ospi >= c.official
  const badge = noSignals ? '#a1a1aa' : confColor(c.conf)
  const avgSig = Math.round(Object.values(c.signals).reduce((a, b) => a + b, 0) / 5)

  useEffect(() => {
    if (!trendRef.current || !radarRef.current) return

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
      const tick = isDark ? '#52525b' : '#a1a1aa'
      const grid = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
      const tooltipOpts = {
        backgroundColor: isDark ? '#18181b' : '#fff',
        borderColor: isDark ? '#27272a' : '#e4e4e7',
        borderWidth: 1,
        titleColor: isDark ? '#a1a1aa' : '#71717a',
        bodyColor: isDark ? '#f4f4f5' : '#18181b',
        padding: 8,
      }

      // ── Trend chart ──
      const trendLabels = c.history.map(h => String(h.y))
      const histDataset = c.history.map(h => parseFloat(h.v.toFixed(4)))
      const ospiVal = parseFloat(c.ospi.toFixed(4))

      const ospiDataset = c.history.map((_, i) =>
        i === c.history.length - 1 ? ospiVal : null
      )

      trendInst.current = new Chart(trendRef.current!, {
        type: 'line',
        data: {
          labels: trendLabels,
          datasets: [
            {
              // Historical population from populations DB table
              label: 'Population',
              data: histDataset,
              borderColor: isDark ? '#71717a' : '#a1a1aa',
              backgroundColor: isDark ? 'rgba(113,113,122,0.08)' : 'rgba(161,161,170,0.08)',
              borderWidth: 2,
              pointRadius: (ctx) => ctx.dataIndex === histDataset.length - 1 ? 4 : 3,
              pointBackgroundColor: isDark ? '#71717a' : '#a1a1aa',
              fill: true,
              tension: 0.4,
              spanGaps: false,
            },
            {
              label: 'OSPI estimate',
              data: ospiDataset,
              borderColor: 'transparent',
              backgroundColor: 'transparent',
              borderWidth: 0,
              pointRadius: (ctx) => ctx.parsed.y === null ? 0 : 7,
              pointBackgroundColor: noSignals
                ? (isDark ? '#3f3f46' : '#d4d4d8')
                : isPos ? '#1D9E75' : '#E24B4A',
              pointBorderColor: isDark ? '#18181b' : '#fff',
              pointBorderWidth: 2,
              pointStyle: 'circle',
              fill: false,
              spanGaps: false,
            },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              ...tooltipOpts,
              callbacks: {
                label: ctx => {
                  if (ctx.parsed.y === null) return ''
                  const label = ctx.datasetIndex === 0 ? 'Population' : 'OSPI estimate'
                  return ` ${label}: ${fmt(ctx.parsed.y as number)}`
                },
              },
            },
          },
          scales: {
            x: { ticks: { color: tick, font: { size: 9 } }, grid: { display: false }, border: { display: false } },
            y: {
              ticks: { color: tick, font: { size: 9 }, callback: v => fmt(v as number) },
              grid: { color: grid },
              border: { display: false },
            },
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
              grid: { color: grid },
              pointLabels: { color: tick, font: { size: 9 } },
              angleLines: { color: grid },
            },
          },
        },
      })

      // ── Region bar chart ──
      if (c.regions.length > 0 && barRef.current) {
        barInst.current = new Chart(barRef.current, {
          type: 'bar',
          data: {
            labels: c.regions.map(r => r.name),
            datasets: [
              {
                label: 'Official',
                data: c.regions.map(r => parseFloat(r.pop.toFixed(2))),
                backgroundColor: isDark ? 'rgba(113,113,122,0.4)' : 'rgba(161,161,170,0.4)',
                borderRadius: 3,
                barPercentage: 0.6,
              },
              {
                label: 'OSPI',
                data: c.regions.map(r => parseFloat(r.ospi.toFixed(2))),
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
              tooltip: {
                ...tooltipOpts,
                callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y as number)}` },
              },
            },
            scales: {
              x: { ticks: { color: tick, font: { size: 9 } }, grid: { display: false }, border: { display: false } },
              y: {
                ticks: { color: tick, font: { size: 9 }, callback: v => fmt(v as number) },
                grid: { color: grid },
                border: { display: false },
              },
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
  }, [c, noSignals, isPos])

  return (
    <div className="h-full overflow-hidden">
      <div className="h-full overflow-hidden">
        <div className="p-4 space-y-4">

          {/* ── Header ── */}
          {onBack && (
            <button onClick={onBack}
              className="text-[9px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 uppercase tracking-wider transition-colors flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              back to overview
            </button>
          )}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{c.name}</h2>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">ISO {c.iso}</span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {c.region}
                {c.densityKm2 ? ` · ${fmtDensity(c.densityKm2)}` : ''}
                {c.urbanPct ? ` · ${c.urbanPct.toFixed(1)}% urban` : ''}
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
              { label: 'Official pop.', value: fmt(c.official), sub: 'Census reported', color: '' },
              { label: 'OSPI estimate', value: fmt(c.ospi), sub: 'Signal-weighted', color: '#1D9E75' },
              { label: 'Divergence', value: delta, sub: `${fmtGap(c.ospi - c.official)} gap`, color: isPos ? '#1D9E75' : '#E24B4A' },
              { label: 'GDP / capita', value: c.gdpPerCapita ? fmtUsd(c.gdpPerCapita) : '—', sub: 'USD nominal', color: '' },
              { label: 'Annual growth', value: fmtPct(c.growthRate, true), sub: 'Rate p.a.', color: c.growthRate >= 0 ? '#1D9E75' : '#E24B4A' },
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
                  {[
                    { col: '#a1a1aa', label: 'UN data', dashed: false },
                    { col: noSignals ? '#a1a1aa' : isPos ? '#1D9E75' : '#E24B4A', label: 'OSPI estimate', dashed: true },].map(l => (
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
              <div style={{ height: 110 }}>
                <canvas ref={trendRef} />
              </div>
            </div>

            {/* Radar */}
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
            {/* Signal bars */}
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">Signal scores</p>
                {noSignals && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-400">no signals</span>
                )}
              </div>
              <div className={`space-y-2 ${noSignals ? 'opacity-40 pointer-events-none' : ''}`}>
                {SIGNALS.map(({ key, label }) => {
                  const v = c.signals[key]
                  const col = noSignals ? '#a1a1aa' : signalColor(v)
                  return (
                    <div key={key}>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{label}</span>
                        <span className="text-[10px] font-mono font-semibold" style={{ color: col }}>{v.toFixed(0)}/100</span>
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
                    {noSignals ? '—' : avgSig.toFixed(0)}
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
                    const rDeltaPct = ((r.ospi - r.pop) / r.pop * 100).toFixed(2)
                    const rPos = r.ospi >= r.pop
                    const rCol = noSignals ? '#a1a1aa' : confColor(r.conf)
                    return (
                      <tr
                        key={r.name}
                        className={`border-b border-zinc-100 dark:border-zinc-800 last:border-0 ${i % 2 === 0 ? '' : 'bg-zinc-50/50 dark:bg-zinc-900/50'}`}
                      >
                        <td className="px-3 py-1.5 font-medium text-zinc-700 dark:text-zinc-300">{r.name}</td>
                        <td className="px-3 py-1.5 font-mono text-zinc-500 dark:text-zinc-400">{fmt(r.pop)}</td>
                        <td className="px-3 py-1.5 font-mono font-semibold text-zinc-700 dark:text-zinc-300">{fmt(r.ospi)}</td>
                        <td className="px-3 py-1.5 font-mono font-semibold" style={{ color: rPos ? '#1D9E75' : '#E24B4A' }}>
                          {rPos ? '+' : ''}{rDeltaPct}%
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
              <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
            </svg>
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              OSPI estimates are probabilistic models derived from weighted signal indicators.
              Historical population data sourced from UN WPP (Medium variant, both sexes).
              Confidence reflects data source reliability. Estimates should not be treated as official counts.
               Last model run: <span className="font-mono">{modelRun}</span>.
              {noSignals && ' · Signal data not yet available — OSPI mirrors official figures until your model runs.'}
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
