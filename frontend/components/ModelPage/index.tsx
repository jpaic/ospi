'use client'

import { useEffect, useMemo, useState } from 'react'
import NavHeader from '@/components/NavHeader'
import { hideNavOverlay, showNavOverlay } from '@/lib/navigation'
import { cacheGet, cacheSet } from '@/lib/cache'
import { getModelVersion } from '@/lib/modelVersion'
import type { DetailsResponse, Histogram } from './types'
import { StatCard, SectionHeader } from './statCard'
import { ScatterPlot, HistogramChart, DistBar, FeatureBars } from './charts'
import { OutliersTable, RegionCoefs } from './tables'
import { CvFolds } from './cvFolds'

const CACHE_KEY = 'modelDetails'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function r2Color(r2: number | null): string {
  if (r2 == null) return '#71717a'
  if (r2 >= 0.85) return '#1D9E75'
  if (r2 >= 0.75) return '#EF9F27'
  return '#E24B4A'
}

export default function ModelPage() {
  const base = (process.env.NEXT_PUBLIC_BACKEND_URL ?? '').replace(/\/+$/, '')
  const cachedData: DetailsResponse | null =
    typeof window !== 'undefined' ? cacheGet<DetailsResponse>(CACHE_KEY) : null

  const [data, setData] = useState<DetailsResponse | null>(cachedData)
  const [ready, setReady] = useState(!!cachedData)
  const [error, setError] = useState<string | null>(
    !base ? 'NEXT_PUBLIC_BACKEND_URL not configured' : null
  )

  useEffect(() => {
    if (!base || cachedData) return

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)

    const version = getModelVersion()
    const qs = version === 'v3' ? '' : `?version=${version}`

    fetch(`${base}/model/details${qs}`, { signal: controller.signal })
      .then(r => {
        clearTimeout(timeout)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => {
        cacheSet(CACHE_KEY, d)
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
  }, [base, cachedData])

  useEffect(() => {
    if (!ready) return
    hideNavOverlay()
  }, [ready])

  useEffect(() => {
    const handlePop = () => {
      showNavOverlay('Dashboard', 'Loading country data…')
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  const [showSigned, setShowSigned] = useState(false)

  const signedHist = useMemo(() => {
    const scatter = data?.training_scatter
    if (!scatter || scatter.length === 0) return null
    const residuals = scatter.map(d => {
      const o = Math.max(d.official, 1), e = Math.max(d.ospi, 1)
      return Math.log(e) - Math.log(o)
    })
    const min = Math.min(...residuals), max = Math.max(...residuals)
    const bins = 20, binWidth = (max - min) / bins
    const binEdges = Array.from({ length: bins + 1 }, (_, i) => min + i * binWidth)
    const counts = new Array(bins).fill(0)
    for (const r of residuals) {
      counts[Math.min(Math.floor((r - min) / binWidth), bins - 1)]++
    }
    const n = residuals.length
    const mean = residuals.reduce((a, b) => a + b, 0) / n
    const variance = residuals.reduce((a, b) => a + (b - mean) ** 2, 0) / n
    const sorted = [...residuals].sort((a, b) => a - b)
    return {
      bins: binEdges, counts,
      mean, std: Math.sqrt(variance),
      p95: sorted[Math.floor(0.95 * n)], p99: sorted[Math.floor(0.99 * n)],
      min, max, n,
    } as Histogram
  }, [data?.training_scatter])

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
            <div key={i} className="ospi-boot-bar"
              style={{ height: b.h, background: b.col, animationDelay: b.delay }} />
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
        <button onClick={() => window.location.reload()}
          className="text-[10px] text-zinc-400 hover:text-zinc-600 underline underline-offset-2 transition-colors">
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

  const activeHist = showSigned && signedHist ? signedHist : hist

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <NavHeader active="model" />
      <div className="max-w-5xl mx-auto px-2 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="R²" value={m.r_squared?.toFixed(4) ?? '—'} color={r2Color(m.r_squared)}
            sub={m.cv_r_squared != null ? `CV: ${m.cv_r_squared.toFixed(4)}` : undefined} />
          <StatCard label="Training countries" value={String(m.n_training ?? '—')} color="#3B82F6" />
          <StatCard label="Model ID" value={`#${m.model_id}`} sub={formatDate(m.trained_at)} />
          <StatCard label="Intercept" value={m.intercept?.toFixed(4) ?? '—'} color="#A855F7" />
        </div>

        <section>
          <SectionHeader title="Training set: Official vs OSPI estimate"
            subtitle={`${scatter.length} countries · log-linear Ridge · per-feature α`} />
          <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800 p-4">
            <ScatterPlot data={scatter} />
          </div>
        </section>

        <section>
          <SectionHeader title="Residual distribution"
            subtitle={`${showSigned ? 'Signed log residuals' : 'Log-scale absolute residuals'} · n=${activeHist.n} · σ=${activeHist.std.toFixed(4)}`} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800 p-4">
              <HistogramChart data={activeHist} showSigned={showSigned} onToggleSigned={() => setShowSigned(v => !v)} />
            </div>
            <div className="space-y-2">
              {[
                { label: 'Mean', value: activeHist.mean.toFixed(4), tip: 'Mean of the residual distribution. 0 = no systematic bias.' },
                { label: 'Std dev', value: activeHist.std.toFixed(4), tip: 'Standard deviation — spread of residuals around the mean.' },
                { label: 'p50', value: (activeHist.bins.length > 0 ? activeHist.bins[Math.floor(activeHist.counts.length / 2)]?.toFixed(4) : '—'), tip: 'Median residual. 50% of countries have a smaller residual.' },
                { label: 'p95', value: activeHist.p95.toFixed(4), tip: '95th percentile — 95% of countries have a residual at or below this value.' },
                { label: 'p99', value: activeHist.p99.toFixed(4), tip: '99th percentile — 99% of countries have a residual at or below this value.' },
                { label: 'Min', value: activeHist.min.toFixed(4), tip: 'Smallest residual in the training set (best-fit country).' },
                { label: 'Max', value: activeHist.max.toFixed(4), tip: 'Largest residual in the training set (worst-fit country).' },
              ].map(s => (
                <div key={s.label} className="relative inline-flex group w-full items-center justify-between px-3 py-1.5 rounded bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider">{s.label}</span>
                  {s.tip && (
                    <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded bg-zinc-800 text-white text-[9px] leading-tight shadow-lg pointer-events-none whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      {s.tip}
                      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800" />
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-zinc-700 dark:text-zinc-300">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {outliers.length > 0 && (
          <section>
            <SectionHeader title="Top outliers" subtitle={`${outliers.length} countries with largest residuals`} />
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800 p-4">
              <OutliersTable data={outliers} />
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section>
            <SectionHeader title="Feature importance" subtitle="Standardised coefficients (scaled space, comparable)" />
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800 p-4">
              <FeatureBars features={fi} />
            </div>
          </section>
          <section>
            <SectionHeader title="Continent adjustments" subtitle="Europe is reference (absorbed into intercept)" />
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800 p-4">
              {m.region_coefs && Object.keys(m.region_coefs).length > 0
                ? <RegionCoefs coefs={m.region_coefs} />
                : <p className="text-[10px] text-zinc-400">No region adjustments</p>
              }
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section>
            <SectionHeader title="Confidence distribution" subtitle={`${conf.total} countries with population data`} />
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800 p-4">
              <DistBar
                tiers={{ high: conf.high, med: conf.med, low: conf.low, unknown: conf.unknown }}
                total={conf.total}
                colors={{ high: '#1D9E75', med: '#EF9F27', low: '#E24B4A', unknown: '#a1a1aa' }}
              />
            </div>
          </section>
          <section>
            <SectionHeader title="Signal coverage tiers" subtitle={`${cov.total} countries · threshold ≥ 0.4 for training`} />
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

        <section>
          <SectionHeader title="Cross-validation diagnostics"
            subtitle={`${cv.n_splits}-fold · n=${cv.n_countries} · per-feature α matching trainer · in-sample R²=${m.r_squared?.toFixed(4) ?? '—'} for comparison`} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800 p-4">
              <CvFolds cv={cv} />
            </div>
            <div className="space-y-2">
              {[
                { label: 'Ø R²', value: cv.cv_r2_mean.toFixed(4), color: r2Color(cv.cv_r2_mean), tip: 'Mean cross-validated R² across all folds (out-of-sample). Lower than the in-sample R² above — this is the true generalization metric.' },
                { label: 'R² std', value: `±${cv.cv_r2_std.toFixed(4)}`, color: '#71717a', tip: 'Standard deviation of R² across folds. High = model is unstable across different data splits.' },
                { label: 'Ø RMSE', value: cv.cv_rmse_mean.toFixed(4), color: '#A855F7', tip: 'Mean root-mean-squared error across folds. Lower is better.' },
                { label: 'RMSE std', value: `±${cv.cv_rmse_std.toFixed(4)}`, color: '#71717a', tip: 'Standard deviation of RMSE across folds. High = inconsistent error across data splits.' },
              ].map(s => (
                <div key={s.label} className="relative inline-flex group w-full items-center justify-between px-3 py-1.5 rounded bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider">{s.label}</span>
                  {s.tip && (
                    <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded bg-zinc-800 text-white text-[9px] leading-tight shadow-lg pointer-events-none whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      {s.tip}
                      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800" />
                    </span>
                  )}
                  <span className="text-[10px] font-mono" style={s.color ? { color: s.color } : {}}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="text-[9px] text-zinc-300 dark:text-zinc-700 leading-relaxed border-t border-zinc-100 dark:border-zinc-800 pt-6 text-center">
          log-linear Ridge regression &middot; 5 signals + log(area) + signal count &middot; per-feature α &middot; 5-fold CV &middot; StandardScaler
        </div>
      </div>
    </div>
  )
}
