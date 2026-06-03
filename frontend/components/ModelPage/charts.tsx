'use client'

import { useState } from 'react'
import { fmt, fmtPct } from '@/lib/fmt'
import type { ScatterPoint, Histogram } from './types'

const SIGNAL_COLORS: Record<string, string> = {
  telecom:     '#1D9E75',
  electricity: '#EF9F27',
  building:    '#3B82F6',
  mobility:    '#A855F7',
  internet:    '#E24B4A',
  log_area_km2: '#06B6D4',
  signal_count: '#F97316',
}

const SIGNAL_LABELS: Record<string, string> = {
  telecom:     'Telecom',
  electricity: 'Electricity',
  building:    'Building',
  mobility:    'Mobility',
  internet:    'Internet',
  log_area_km2: 'Log Area',
  signal_count: 'Signal Count',
}

export function ScatterPlot({ data }: { data: ScatterPoint[] }) {
  const [tooltip, setTooltip] = useState<ScatterPoint | null>(null)
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
  const [logScale, setLogScale] = useState(false)

  const W = 520, H = 440
  const PAD = { top: 24, right: 24, bottom: 48, left: 64 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const maxOfficial = Math.max(...data.map(d => d.official), 1) * 1.08
  const maxOspi     = Math.max(...data.map(d => d.ospi), 1) * 1.08
  const maxVal      = Math.max(maxOfficial, maxOspi)
  const minVal      = Math.min(...data.flatMap(d => [d.official, d.ospi]), 1)

  const logMin = Math.floor(Math.log10(Math.max(minVal, 1)))
  const logMax = Math.ceil(Math.log10(maxVal))
  const logRange = Math.max(logMax - logMin, 1)

  const xScale = (v: number) =>
    logScale
      ? PAD.left + ((Math.log10(Math.max(v, 1)) - logMin) / logRange) * plotW
      : PAD.left + (v / maxVal) * plotW

  const yScale = (v: number) =>
    logScale
      ? PAD.top + plotH - ((Math.log10(Math.max(v, 1)) - logMin) / logRange) * plotH
      : PAD.top + plotH - (v / maxVal) * plotH

  const maxResid = Math.max(...data.map(d => d.residual), 0.001)
  const residColor = (r: number) => {
    const t = Math.min(r / maxResid, 1)
    return `rgb(${Math.round(220 * t)}, ${Math.round(180 * (1 - t))}, ${Math.round(80 * (1 - t))})`
  }

  const ticks = (() => {
    if (logScale) {
      const n = Math.max(logMax - logMin + 1, 2)
      return Array.from({ length: n }, (_, i) => 10 ** (logMin + i))
    }
    const step = maxVal / 5
    return Array.from({ length: 6 }, (_, i) => Math.round(i * step))
  })()

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
        <span className="text-[9px] uppercase tracking-wider text-zinc-400">Scale</span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono transition-colors ${logScale ? 'text-zinc-400' : 'text-zinc-700 dark:text-zinc-300'}`}>linear</span>
          <button
            role="switch"
            aria-checked={logScale}
            onClick={() => setLogScale(v => !v)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
              logScale ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'
            }`}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform shadow-sm ${
              logScale ? 'translate-x-[18px]' : 'translate-x-[2px]'
            }`} />
          </button>
          <span className={`text-[10px] font-mono transition-colors ${logScale ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400'}`}>log–log</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[520px] mx-auto">
        {ticks.map(t => (
          <g key={t}>
            <line x1={xScale(t)} y1={PAD.top} x2={xScale(t)} y2={PAD.top + plotH}
              stroke="#e4e4e7" strokeWidth={0.5} />
            <line x1={PAD.left} y1={yScale(t)} x2={PAD.left + plotW} y2={yScale(t)}
              stroke="#e4e4e7" strokeWidth={0.5} />
          </g>
        ))}
        <line x1={xScale(logScale ? 10 ** logMin : 0)} y1={yScale(logScale ? 10 ** logMin : 0)} x2={xScale(logScale ? 10 ** logMax : maxVal)} y2={yScale(logScale ? 10 ** logMax : maxVal)}
          stroke="#a1a1aa" strokeWidth={1} strokeDasharray="4 3" />
        {data.map(d => (
          <circle
            key={d.iso2}
            cx={xScale(d.official)}
            cy={yScale(d.ospi)}
            r={3.5}
            fill={residColor(d.residual)}
            opacity={0.75}
            stroke="#fff"
            strokeWidth={0.5}
            style={{ cursor: 'pointer', transition: 'cx 0.3s ease, cy 0.3s ease' }}
            onMouseEnter={e => {
              setTooltip(d)
              const r = e.currentTarget.getBoundingClientRect()
              setHoverPos({ x: r.left + r.width / 2, y: r.top - 4 })
            }}
            onMouseLeave={() => { setTooltip(null); setHoverPos(null) }}
          />
        ))}
        <line x1={PAD.left} y1={PAD.top + plotH} x2={PAD.left + plotW} y2={PAD.top + plotH}
          stroke="#71717a" strokeWidth={1} />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH}
          stroke="#71717a" strokeWidth={1} />
        {ticks.map(t => (
          <g key={t}>
            <line x1={xScale(t)} y1={PAD.top + plotH} x2={xScale(t)} y2={PAD.top + plotH + 5}
              stroke="#71717a" strokeWidth={1} />
            <text x={xScale(t)} y={PAD.top + plotH + 18} textAnchor="middle"
              fill="#71717a" fontSize={9} fontFamily="monospace">
              {t >= 1000 ? fmt(t) : t}
            </text>
          </g>
        ))}
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD.left - 5} y1={yScale(t)} x2={PAD.left} y2={yScale(t)}
              stroke="#71717a" strokeWidth={1} />
            <text x={PAD.left - 8} y={yScale(t) + 3} textAnchor="end"
              fill="#71717a" fontSize={9} fontFamily="monospace">
              {t >= 1000 ? fmt(t) : t}
            </text>
          </g>
        ))}
        <text x={PAD.left + plotW / 2} y={H - 4} textAnchor="middle"
          fill="#52525b" fontSize={10}>Official population</text>
        <text x={12} y={PAD.top + plotH / 2} textAnchor="middle"
          fill="#52525b" fontSize={10}
          transform={`rotate(-90, 12, ${PAD.top + plotH / 2})`}>
          OSPI estimate
        </text>
        <text x={PAD.left + 8} y={PAD.top + 12} fill="#52525b" fontSize={9}>
          ● residual {maxResid.toFixed(3)}
        </text>
        <circle cx={PAD.left + plotW - 40} cy={PAD.top + 10} r={3.5}
          fill={residColor(0)} opacity={0.75} stroke="#fff" strokeWidth={0.5} />
        <text x={PAD.left + plotW - 34} y={PAD.top + 12} fill="#52525b" fontSize={9}>
          residual 0
        </text>
      </svg>
      {tooltip && hoverPos && (
        <div
          className="fixed z-50 bg-zinc-800 text-white text-[10px] rounded-lg px-2.5 py-1.5 shadow-lg pointer-events-none whitespace-nowrap"
          style={{ left: hoverPos.x, top: hoverPos.y, transform: 'translate(-50%, -100%)' }}
        >
          <p className="font-semibold">{tooltip.name} ({tooltip.iso2})</p>
          <p>Official: {fmt(tooltip.official)} &middot; OSPI: {fmt(tooltip.ospi)}</p>
          <p>Residual: {tooltip.residual.toFixed(4)} &middot; Δ: {fmtPct(tooltip.residual_pct, true)}</p>
        </div>
      )}
    </div>
  )
}

export function HistogramChart({ data, showSigned, onToggleSigned }: {
  data: Histogram
  showSigned?: boolean
  onToggleSigned?: () => void
}) {
  const [showCdf, setShowCdf] = useState(false)

  const W = 520, H = 240
  const PAD = { top: 20, right: 20, bottom: 36, left: 52 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const maxCount = Math.max(...data.counts, 1)
  const barWidth = plotW / data.counts.length

  const barX = (i: number) => PAD.left + i * barWidth
  const barH = (c: number) => (c / maxCount) * plotH
  const valX = (v: number) => PAD.left + (v - data.min) / (data.max - data.min || 1) * plotW

  const total = data.counts.reduce((a, b) => a + b, 0)
  const cdfPoints = (() => {
    let cum = 0
    return data.counts.map((c, i) => {
      cum += c
      return { x: barX(i) + barWidth / 2, y: PAD.top + plotH - (cum / total) * plotH }
    })
  })()

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
        <span className="text-[9px] uppercase tracking-wider text-zinc-400">
          {showSigned ? 'Signed log residuals' : 'Absolute log residuals'}
        </span>
        <div className="flex items-center gap-3">
          {onToggleSigned && (
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-mono transition-colors ${showSigned ? 'text-zinc-400' : 'text-zinc-700 dark:text-zinc-300'}`}>abs</span>
              <button role="switch" aria-checked={!!showSigned} onClick={onToggleSigned}
                className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${showSigned ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
                <span className={`inline-block h-3 w-3 rounded-full bg-white transition-transform shadow-sm ${showSigned ? 'translate-x-[14px]' : 'translate-x-[2px]'}`} />
              </button>
              <span className={`text-[10px] font-mono transition-colors ${showSigned ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400'}`}>signed</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-mono transition-colors ${showCdf ? 'text-zinc-400' : 'text-zinc-700 dark:text-zinc-300'}`}>bars</span>
            <button role="switch" aria-checked={showCdf} onClick={() => setShowCdf(v => !v)}
              className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${showCdf ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
              <span className={`inline-block h-3 w-3 rounded-full bg-white transition-transform shadow-sm ${showCdf ? 'translate-x-[14px]' : 'translate-x-[2px]'}`} />
            </button>
            <span className={`text-[10px] font-mono transition-colors ${showCdf ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400'}`}>CDF</span>
          </div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[520px] mx-auto">
        {data.counts.map((c, i) => (
          <rect
            key={i}
            x={barX(i) + 1}
            y={PAD.top + plotH - barH(c)}
            width={Math.max(barWidth - 2, 1)}
            height={barH(c)}
            fill="#1D9E75"
            opacity={0.6}
            rx={1}
          />
        ))}
        {showCdf && cdfPoints.length > 0 && (
          <path d={`M${cdfPoints[0].x},${PAD.top + plotH} ${cdfPoints.map(p => `L${p.x},${p.y}`).join(' ')} L${cdfPoints[cdfPoints.length - 1].x},${PAD.top}`}
            fill="none" stroke="#A855F7" strokeWidth={1.5} />
        )}
        <line x1={valX(data.mean)} y1={PAD.top} x2={valX(data.mean)} y2={PAD.top + plotH}
          stroke="#E24B4A" strokeWidth={1.5} strokeDasharray="4 2" />
        <text x={valX(data.mean) + 3} y={PAD.top + 10} fill="#E24B4A" fontSize={9}>
          mean={data.mean.toFixed(3)}
        </text>
        <line x1={valX(data.p95)} y1={PAD.top} x2={valX(data.p95)} y2={PAD.top + plotH}
          stroke="#EF9F27" strokeWidth={1.5} strokeDasharray="4 2" />
        <text x={valX(data.p95) + 3} y={PAD.top + 22} fill="#EF9F27" fontSize={9}>
          p95={data.p95.toFixed(3)}
        </text>
        <line x1={PAD.left} y1={PAD.top + plotH} x2={PAD.left + plotW} y2={PAD.top + plotH}
          stroke="#71717a" strokeWidth={1} />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH}
          stroke="#71717a" strokeWidth={1} />
        <text x={PAD.left + plotW / 2} y={H - 4} textAnchor="middle"
          fill="#52525b" fontSize={9}>{showSigned ? 'Signed log residual' : 'Absolute log residual'}</text>
        <text x={14} y={PAD.top + plotH / 2} textAnchor="middle"
          fill="#52525b" fontSize={9} transform={`rotate(-90, 14, ${PAD.top + plotH / 2})`}>
          Countries
        </text>
      </svg>
    </div>
  )
}

export function DistBar({ tiers, total, colors }: {
  tiers: Record<string, number>
  total: number
  colors: Record<string, string>
}) {
  const entries = Object.entries(tiers).filter(([, v]) => v > 0)
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {entries.map(([k, v]) => (
          <div key={k} className="h-full transition-all"
            style={{ width: `${(v / total) * 100}%`, background: colors[k] ?? '#71717a' }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {entries.map(([k, v]) => {
          const pct = ((v / total) * 100).toFixed(1)
          return (
            <span key={k} className="text-[10px] flex items-center gap-1.5 text-zinc-500">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: colors[k] }} />
              {k}: {v} ({pct}%)
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function FeatureBars({ features }: { features: { feature: string; coefficient: number }[] }) {
  const maxAbs = Math.max(...features.map(f => Math.abs(f.coefficient)), 0.001)
  return (
    <div className="space-y-2.5">
      {features.map(f => {
        const pct = (Math.abs(f.coefficient) / maxAbs) * 100
        const col = SIGNAL_COLORS[f.feature] ?? '#71717a'
        return (
          <div key={f.feature}>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-zinc-500">{SIGNAL_LABELS[f.feature] || f.feature}</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300">
                {f.coefficient >= 0 ? '+' : ''}{f.coefficient.toFixed(4)}
              </span>
            </div>
            <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(pct, 2)}%`,
                  background: col,
                  marginLeft: f.coefficient < 0 ? 'auto' : undefined,
                  float: f.coefficient < 0 ? 'right' : undefined,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
