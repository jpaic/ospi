'use client'

import { useEffect, useState } from 'react'
import NavHeader from '@/components/NavHeader'
import { fmt, fmtPct } from '@/lib/fmt'
import { hideNavOverlay, showNavOverlay } from '@/lib/navigation'

// ── Types ─────────────────────────────────────────────────────────────────

interface ModelInfo {
  model_id:     number
  trained_at:   string
  r_squared:    number | null
  cv_r_squared: number | null
  n_training:   number | null
  intercept:    number | null
  coefficients: Record<string, number | null>
  region_coefs: Record<string, number> | null
}

interface ScatterPoint {
  iso2:         string
  name:         string
  official:     number
  ospi:         number
  residual:     number
  residual_pct: number
}

interface Histogram {
  bins:   number[]
  counts: number[]
  mean:   number
  std:    number
  p95:    number
  p99:    number
  min:    number
  max:    number
  n:      number
}

interface CoverageDist {
  total: number
  tiers: Record<string, number>
}

interface CvResult {
  n_countries:  number
  n_splits:     number
  cv_r2_mean:   number
  cv_r2_std:    number
  cv_rmse_mean: number
  cv_rmse_std:  number
  r2_by_fold:   number[]
  rmse_by_fold: number[]
}

interface DetailsResponse {
  trained:            boolean
  model?:             ModelInfo
  training_scatter?:  ScatterPoint[]
  residual_histogram?: Histogram
  outliers?:          ScatterPoint[]
  confidence?:        Record<string, number>
  coverage?:          CoverageDist
  cv?:                CvResult
  feature_importance?: { feature: string; coefficient: number }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────

const SIGNAL_LABELS: Record<string, string> = {
  telecom:     'Telecom',
  electricity: 'Electricity',
  building:    'Building',
  mobility:    'Mobility',
  internet:    'Internet',
  log_area_km2: 'Log Area',
  signal_count: 'Signal Count',
}

const SIGNAL_COLORS: Record<string, string> = {
  telecom:     '#1D9E75',
  electricity: '#EF9F27',
  building:    '#3B82F6',
  mobility:    '#A855F7',
  internet:    '#E24B4A',
  log_area_km2: '#06B6D4',
  signal_count: '#F97316',
}

function r2Color(r2: number | null): string {
  if (r2 == null) return '#71717a'
  if (r2 >= 0.85) return '#1D9E75'
  if (r2 >= 0.75) return '#EF9F27'
  return '#E24B4A'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function classNames(...args: (string | false | undefined | null)[]): string {
  return args.filter(Boolean).join(' ')
}

// ── Stat card ─────────────────────────────────────────────────────────────

function StatCard({ label, value, color, sub }: {
  label: string
  value: string
  color?: string
  sub?: string
}) {
  return (
    <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="text-base font-semibold font-mono mt-0.5" style={color ? { color } : {}}>
        {value}
      </p>
      {sub && <p className="text-[9px] text-zinc-300 dark:text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── SVG Scatter Plot ──────────────────────────────────────────────────────

function ScatterPlot({ data }: { data: ScatterPoint[] }) {
  const [tooltip, setTooltip] = useState<ScatterPoint | null>(null)
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)

  const W = 520, H = 440
  const PAD = { top: 24, right: 24, bottom: 48, left: 64 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const maxOfficial = Math.max(...data.map(d => d.official), 1) * 1.08
  const maxOspi     = Math.max(...data.map(d => d.ospi), 1) * 1.08
  const maxVal      = Math.max(maxOfficial, maxOspi)
  const minVal      = 0

  const xScale = (v: number) => PAD.left + (v / maxVal) * plotW
  const yScale = (v: number) => PAD.top + plotH - (v / maxVal) * plotH

  const maxResid = Math.max(...data.map(d => d.residual), 0.001)
  const residColor = (r: number) => {
    const t = Math.min(r / maxResid, 1)
    return `rgb(${Math.round(220 * t)}, ${Math.round(180 * (1 - t))}, ${Math.round(80 * (1 - t))})`
  }

  const ticks = (() => {
    const step = maxVal / 5
    return Array.from({ length: 6 }, (_, i) => Math.round(i * step))
  })()

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[520px] mx-auto">
        {/* Grid lines */}
        {ticks.map(t => (
          <g key={t}>
            <line x1={xScale(t)} y1={PAD.top} x2={xScale(t)} y2={PAD.top + plotH}
              stroke="#e4e4e7" strokeWidth={0.5} />
            <line x1={PAD.left} y1={yScale(t)} x2={PAD.left + plotW} y2={yScale(t)}
              stroke="#e4e4e7" strokeWidth={0.5} />
          </g>
        ))}

        {/* y=x reference line */}
        <line x1={xScale(0)} y1={yScale(0)} x2={xScale(maxVal)} y2={yScale(maxVal)}
          stroke="#a1a1aa" strokeWidth={1} strokeDasharray="4 3" />

        {/* Points */}
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
            style={{ cursor: 'pointer' }}
            onMouseEnter={e => {
              setTooltip(d)
              const r = e.currentTarget.getBoundingClientRect()
              setHoverPos({ x: r.left + r.width / 2, y: r.top - 4 })
            }}
            onMouseLeave={() => { setTooltip(null); setHoverPos(null) }}
          />
        ))}

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top + plotH} x2={PAD.left + plotW} y2={PAD.top + plotH}
          stroke="#71717a" strokeWidth={1} />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH}
          stroke="#71717a" strokeWidth={1} />

        {/* X ticks */}
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

        {/* Y ticks */}
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

        {/* Labels */}
        <text x={PAD.left + plotW / 2} y={H - 4} textAnchor="middle"
          fill="#52525b" fontSize={10} fontFamily="sans-serif">
          Official population
        </text>
        <text x={12} y={PAD.top + plotH / 2} textAnchor="middle"
          fill="#52525b" fontSize={10} fontFamily="sans-serif"
          transform={`rotate(-90, 12, ${PAD.top + plotH / 2})`}>
          OSPI estimate
        </text>

        {/* Legend */}
        <text x={PAD.left + 8} y={PAD.top + 12} fill="#52525b" fontSize={9}>
          ● residual {maxResid.toFixed(3)}
        </text>
        <circle cx={PAD.left + plotW - 40} cy={PAD.top + 10} r={3.5}
          fill={residColor(0)} opacity={0.75} stroke="#fff" strokeWidth={0.5} />
        <text x={PAD.left + plotW - 34} y={PAD.top + 12} fill="#52525b" fontSize={9}>
          residual 0
        </text>
      </svg>

      {/* Tooltip */}
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

// ── SVG Histogram ─────────────────────────────────────────────────────────

function Histogram({ data, highlight }: { data: Histogram; highlight?: number[] }) {
  const W = 520, H = 240
  const PAD = { top: 20, right: 20, bottom: 36, left: 52 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const maxCount = Math.max(...data.counts, 1)
  const barWidth = plotW / data.counts.length

  const barX = (i: number) => PAD.left + i * barWidth
  const barH = (c: number) => (c / maxCount) * plotH
  const valX = (v: number) => PAD.left + (v - data.min) / (data.max - data.min || 1) * plotW

  return (
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

      {/* Mean line */}
      <line x1={valX(data.mean)} y1={PAD.top} x2={valX(data.mean)} y2={PAD.top + plotH}
        stroke="#E24B4A" strokeWidth={1.5} strokeDasharray="4 2" />
      <text x={valX(data.mean) + 3} y={PAD.top + 10} fill="#E24B4A" fontSize={9}>
        mean={data.mean.toFixed(3)}
      </text>

      {/* p95 line */}
      <line x1={valX(data.p95)} y1={PAD.top} x2={valX(data.p95)} y2={PAD.top + plotH}
        stroke="#EF9F27" strokeWidth={1.5} strokeDasharray="4 2" />
      <text x={valX(data.p95) + 3} y={PAD.top + 22} fill="#EF9F27" fontSize={9}>
        p95={data.p95.toFixed(3)}
      </text>

      {/* Axes */}
      <line x1={PAD.left} y1={PAD.top + plotH} x2={PAD.left + plotW} y2={PAD.top + plotH}
        stroke="#71717a" strokeWidth={1} />
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH}
        stroke="#71717a" strokeWidth={1} />

      <text x={PAD.left + plotW / 2} y={H - 4} textAnchor="middle"
        fill="#52525b" fontSize={9}>Absolute log residual</text>
      <text x={14} y={PAD.top + plotH / 2} textAnchor="middle"
        fill="#52525b" fontSize={9} transform={`rotate(-90, 14, ${PAD.top + plotH / 2})`}>
        Countries
      </text>
    </svg>
  )
}

// ── Feature importance bars ───────────────────────────────────────────────

function FeatureBars({ features }: { features: { feature: string; coefficient: number }[] }) {
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

// ── Distribution bar (horizontal stacked) ─────────────────────────────────

function DistBar({ tiers, total, colors }: {
  tiers: Record<string, number>
  total: number
  colors: Record<string, string>
}) {
  const entries = Object.entries(tiers).filter(([_, v]) => v > 0)

  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {entries.map(([k, v]) => (
          <div
            key={k}
            className="h-full transition-all"
            style={{
              width: `${(v / total) * 100}%`,
              background: colors[k] ?? '#71717a',
            }}
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

// ── Outliers table ────────────────────────────────────────────────────────

function OutliersTable({ data }: { data: ScatterPoint[] }) {
  return (
    <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
      <table className="w-full text-[10px]">
        <thead>
          <tr className="text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800">
            <th className="text-left py-1.5 pr-2 font-medium">Country</th>
            <th className="text-right px-2 font-medium">Official</th>
            <th className="text-right px-2 font-medium">OSPI</th>
            <th className="text-right px-2 font-medium">Residual</th>
            <th className="text-right pl-2 font-medium">Δ%</th>
          </tr>
        </thead>
        <tbody>
          {data.map(d => (
            <tr key={d.iso2} className="border-b border-zinc-50 dark:border-zinc-900">
              <td className="py-1.5 pr-2 text-zinc-700 dark:text-zinc-300">
                <span className="font-medium">{d.name}</span>
                <span className="text-zinc-300 dark:text-zinc-700 ml-1">({d.iso2})</span>
              </td>
              <td className="text-right px-2 font-mono text-zinc-500">{fmt(d.official)}</td>
              <td className="text-right px-2 font-mono text-zinc-500">{fmt(d.ospi)}</td>
              <td className="text-right px-2 font-mono" style={{ color: r2Color(1 - d.residual) }}>
                {d.residual.toFixed(4)}
              </td>
              <td className="text-right pl-2 font-mono"
                style={{ color: d.residual_pct >= 0 ? '#1D9E75' : '#E24B4A' }}>
                {fmtPct(d.residual_pct, true)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── CV fold cards ─────────────────────────────────────────────────────────

function CvFolds({ cv }: { cv: CvResult }) {
  return (
    <div className="space-y-2">
      {cv.r2_by_fold.map((r2, i) => {
        const rmse = cv.rmse_by_fold[i]
        return (
          <div key={i} className="flex items-center gap-3 py-1 border-b border-zinc-50 dark:border-zinc-900 last:border-0">
            <span className="text-[10px] text-zinc-400 w-14 shrink-0">Fold {i + 1}</span>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{
                  width: `${Math.max(r2 * 100, 2)}%`,
                  background: r2Color(r2),
                }} />
              </div>
            </div>
            <span className="text-[10px] font-mono w-16 text-right" style={{ color: r2Color(r2) }}>
              R²={r2.toFixed(3)}
            </span>
            <span className="text-[10px] font-mono w-20 text-right text-zinc-400">
              RMSE={rmse.toFixed(3)}
            </span>
          </div>
        )
      })}
      <div className="flex items-center gap-3 pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
        <span className="text-[10px] text-zinc-500 w-14 shrink-0 font-medium">Mean</span>
        <div className="flex-1" />
        <span className="text-[10px] font-mono w-16 text-right" style={{ color: r2Color(cv.cv_r2_mean) }}>
          Ø R²={cv.cv_r2_mean.toFixed(3)}
        </span>
        <span className="text-[10px] font-mono w-20 text-right text-zinc-500">
          Ø RMSE={cv.cv_rmse_mean.toFixed(3)}
        </span>
      </div>
    </div>
  )
}

// ── Region coefs table ────────────────────────────────────────────────────

function RegionCoefs({ coefs }: { coefs: Record<string, number> }) {
  return (
    <div className="space-y-1.5">
      {Object.entries(coefs).map(([k, v]) => (
        <div key={k} className="flex items-center justify-between text-[10px]">
          <span className="text-zinc-500">{k}</span>
          <span className="font-mono" style={{ color: v >= 0 ? '#1D9E75' : '#E24B4A' }}>
            {v >= 0 ? '+' : ''}{v.toFixed(6)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Module-level cache (survives client-side navigation) ──────────────────

let _cachedModelData: DetailsResponse | null = null

// ── Main page ─────────────────────────────────────────────────────────────

export default function ModelPage() {
  const [data, setData] = useState<DetailsResponse | null>(
    typeof window !== 'undefined' ? _cachedModelData ?? null : null
  )
  const [ready, setReady] = useState(
    typeof window !== 'undefined' ? !!_cachedModelData : false
  )
  const [error, setError] = useState<string | null>(null)

  const base = (process.env.NEXT_PUBLIC_BACKEND_URL ?? '').replace(/\/+$/, '')

  useEffect(() => {
    if (!base) {
      setError('NEXT_PUBLIC_BACKEND_URL not configured')
      setReady(true)
      return
    }

    if (_cachedModelData) {
      setData(_cachedModelData)
      setReady(true)
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)

    fetch(`${base}/model/details`, { signal: controller.signal })
      .then(r => {
        clearTimeout(timeout)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => {
        _cachedModelData = d
        setData(d)
        setReady(true)
      })
      .catch(e => {
        if (e.name === 'AbortError') {
          setError('Request timed out — backend may be unavailable')
        } else {
          setError(e.message)
        }
        setReady(true)
      })
  }, [base])

  // Dismiss the boot overlay when data arrives.
  useEffect(() => {
    if (!ready) return
    hideNavOverlay()
  }, [ready])

  // Show the boot overlay on browser back/forward (fires before React
  // processes the navigation, so the overlay covers the transition).
  useEffect(() => {
    const handlePop = () => {
      showNavOverlay('Dashboard', 'Loading country data…')
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  if (!ready) {
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
        <p className="ospi-boot-sub">Loading model details…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center gap-3">
        <div className="text-red-400 text-xs">{error}</div>
        <button
          onClick={() => window.location.reload()}
          className="text-[10px] text-zinc-400 hover:text-zinc-600 underline underline-offset-2 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data || !data.trained) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 text-xs">No trained model found. Train a model first.</div>
      </div>
    )
  }

  const m = data.model!
  const scatter = data.training_scatter!
  const hist = data.residual_histogram!
  const outliers = data.outliers!
  const fi = data.feature_importance!
  const conf = data.confidence!
  const cov = data.coverage!
  const cv = data.cv!

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">

      <NavHeader active="model" />

      {/* ── Content ── */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">

        {/* ── Hero cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="R²"          value={m.r_squared?.toFixed(4) ?? '—'}     color={r2Color(m.r_squared)} sub={m.cv_r_squared != null ? `CV: ${m.cv_r_squared.toFixed(4)}` : undefined} />
          <StatCard label="Training countries" value={String(m.n_training ?? '—')}  color="#3B82F6" />
          <StatCard label="Model ID"     value={`#${m.model_id}`}                   sub={formatDate(m.trained_at)} />
          <StatCard label="Intercept"    value={m.intercept?.toFixed(4) ?? '—'}     color="#A855F7" />
        </div>

        {/* ── Section: Scatter plot ── */}
        <section>
          <SectionHeader title="Training set: Official vs OSPI estimate"
            subtitle={`${scatter.length} countries · log-linear Ridge · per-feature α`} />
          <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800 p-4">
            <ScatterPlot data={scatter} />
          </div>
        </section>

        {/* ── Section: Residuals ── */}
        <section>
          <SectionHeader title="Residual distribution"
            subtitle={`Log-scale absolute residuals · n=${hist.n} · σ=${hist.std.toFixed(4)}`} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800 p-4">
              <Histogram data={hist} />
            </div>
            <div className="space-y-2">
              {[
                { label: 'Mean', value: hist.mean.toFixed(4) },
                { label: 'Std dev', value: hist.std.toFixed(4) },
                { label: 'p50', value: (hist.bins.length > 0 ? hist.bins[Math.floor(hist.counts.length / 2)]?.toFixed(4) : '—') },
                { label: 'p95', value: hist.p95.toFixed(4) },
                { label: 'p99', value: hist.p99.toFixed(4) },
                { label: 'Min', value: hist.min.toFixed(4) },
                { label: 'Max', value: hist.max.toFixed(4) },
              ].map(s => (
                <div key={s.label} className="flex justify-between items-center px-3 py-1.5 rounded bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider">{s.label}</span>
                  <span className="text-[10px] font-mono text-zinc-700 dark:text-zinc-300">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section: Outliers ── */}
        {outliers.length > 0 && (
          <section>
            <SectionHeader title="Top outliers"
              subtitle={`${outliers.length} countries with largest residuals`} />
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800 p-4">
              <OutliersTable data={outliers} />
            </div>
          </section>
        )}

        {/* ── Grid: Feature Importance + Region Coefs ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section>
            <SectionHeader title="Feature importance"
              subtitle="Standardised coefficients (scaled space, comparable)" />
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800 p-4">
              <FeatureBars features={fi} />
            </div>
          </section>
          <section>
            <SectionHeader title="Continent adjustments"
              subtitle="Europe is reference (absorbed into intercept)" />
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800 p-4">
              {m.region_coefs && Object.keys(m.region_coefs).length > 0
                ? <RegionCoefs coefs={m.region_coefs} />
                : <p className="text-[10px] text-zinc-400">No region adjustments</p>
              }
            </div>
          </section>
        </div>

        {/* ── Grid: Confidence + Coverage ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section>
            <SectionHeader title="Confidence distribution"
              subtitle={`${conf.total} countries with population data`} />
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800 p-4">
              <DistBar
                tiers={{ high: conf.high, med: conf.med, low: conf.low, unknown: conf.unknown }}
                total={conf.total}
                colors={{ high: '#1D9E75', med: '#EF9F27', low: '#E24B4A', unknown: '#a1a1aa' }}
              />
            </div>
          </section>
          <section>
            <SectionHeader title="Signal coverage tiers"
              subtitle={`${cov.total} countries · threshold ≥ 0.4 for training`} />
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800 p-4">
              {cov.tiers && (
                <DistBar
                  tiers={cov.tiers as Record<string, number>}
                  total={cov.total}
                  colors={{ full: '#1D9E75', high: '#3B82F6', med: '#EF9F27', low: '#E24B4A', insufficient: '#a1a1aa' }}
                />
              )}
            </div>
          </section>
        </div>

        {/* ── Section: CV diagnostics ── */}
        <section>
          <SectionHeader title="Cross-validation diagnostics"
            subtitle={`${cv.n_splits}-fold · n=${cv.n_countries} · per-feature α matching trainer`} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800 p-4">
              <CvFolds cv={cv} />
            </div>
            <div className="space-y-2">
              {[
                { label: 'Ø R²', value: cv.cv_r2_mean.toFixed(4), color: r2Color(cv.cv_r2_mean) },
                { label: 'R² std', value: `±${cv.cv_r2_std.toFixed(4)}`, color: '#71717a' },
                { label: 'Ø RMSE', value: cv.cv_rmse_mean.toFixed(4), color: '#A855F7' },
                { label: 'RMSE std', value: `±${cv.cv_rmse_std.toFixed(4)}`, color: '#71717a' },
              ].map(s => (
                <div key={s.label} className="flex justify-between items-center px-3 py-1.5 rounded bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider">{s.label}</span>
                  <span className="text-[10px] font-mono" style={s.color ? { color: s.color } : {}}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Footer method note ── */}
        <div className="text-[9px] text-zinc-300 dark:text-zinc-700 leading-relaxed border-t border-zinc-100 dark:border-zinc-800 pt-6 text-center">
          log-linear Ridge regression &middot; 5 signals + log(area) + signal count &middot; per-feature α &middot; 5-fold CV &middot; StandardScaler
        </div>
      </div>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-[11px] font-bold tracking-widest uppercase text-zinc-700 dark:text-zinc-300">
        {title}
      </h2>
      {subtitle && (
        <p className="text-[9px] text-zinc-300 dark:text-zinc-700 mt-0.5 tracking-wider">
          {subtitle}
        </p>
      )}
    </div>
  )
}
