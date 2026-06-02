'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface ModelStatus {
  trained:      boolean
  model_id:     number | null
  trained_at:   string | null
  r_squared:    number | null
  n_training:   number | null
  lambda:       number | null
  mode:         'v2_regression' | 'v1_fallback'
  coefficients?: {
    intercept:   number | null
    telecom:     number | null
    electricity: number | null
    building:    number | null
    mobility:    number | null
    internet:    number | null
  }
}

interface Props {
  /** Base URL of the FastAPI backend */
  backendUrl?: string
  /** Admin token — only pass from a server component or env var in prod */
  adminToken?: string
  /** Called after a successful retrain so the parent can refresh country data */
  onRetrainComplete?: () => void
}

const SIGNAL_COLORS: Record<string, string> = {
  telecom:     '#1D9E75',
  electricity: '#EF9F27',
  building:    '#3B82F6',
  mobility:    '#A855F7',
  internet:    '#E24B4A',
}

function CoefBar({ name, value }: { name: string; value: number | null }) {
  if (value == null) return null
  const max = 0.12  // reasonable upper bound for ridge coefs on 0-100 signals
  const pct = Math.min(Math.abs(value) / max * 100, 100)
  const col = SIGNAL_COLORS[name] ?? '#71717a'
  const isNeg = value < 0

  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-[9px] w-20 capitalize text-zinc-400 shrink-0">{name}</span>
      <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden flex">
        {isNeg
          ? <div className="ml-auto h-full rounded-full" style={{ width: `${pct}%`, background: '#E24B4A' }} />
          : <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} />
        }
      </div>
      <span
        className="text-[9px] font-mono w-14 text-right shrink-0"
        style={{ color: isNeg ? '#E24B4A' : col }}
      >
        {value > 0 ? '+' : ''}{value.toFixed(4)}
      </span>
    </div>
  )
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
      style={{ background: ok ? '#1D9E75' : '#EF9F27' }}
    />
  )
}

export default function ModelStatus({ backendUrl, adminToken, onRetrainComplete }: Props) {
  const [status, setStatus] = useState<ModelStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [retraining, setRetraining] = useState(false)
  const [retrainResult, setRetrainResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const base = (backendUrl ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? '').replace(/\/+$/, '')

  const fetchStatus = useCallback(async () => {
    if (!base) return
    try {
      const res = await fetch(`${base}/model/status`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: ModelStatus = await res.json()
      setStatus(data)
      setError(null)
    } catch (e) {
      setError('Could not reach backend')
    } finally {
      setLoading(false)
    }
  }, [base])

  useEffect(() => {
    fetchStatus()
    // Refresh every 30 s to catch background retrains
    const t = setInterval(fetchStatus, 30_000)
    return () => clearInterval(t)
  }, [fetchStatus])

  const handleRetrain = async () => {
    if (!adminToken) {
      setRetrainResult('No admin token configured')
      return
    }
    setRetraining(true)
    setRetrainResult(null)
    try {
      const res = await fetch(`${base}/admin/retrain/sync`, {
        method: 'POST',
        headers: { 'X-Admin-Token': adminToken },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? `HTTP ${res.status}`)
      setRetrainResult(
        `✓ Model ${data.model_id} trained · R²=${data.r_squared} · n=${data.n_training}`
      )
      await fetchStatus()
      onRetrainComplete?.()
    } catch (e: any) {
      setRetrainResult(`✗ ${e.message}`)
    } finally {
      setRetraining(false)
    }
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const r2Color = (r2: number | null) => {
    if (r2 == null) return '#71717a'
    if (r2 >= 0.85) return '#1D9E75'
    if (r2 >= 0.75) return '#EF9F27'
    return '#E24B4A'
  }

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="border border-zinc-100 dark:border-zinc-800 rounded-lg p-3 animate-pulse">
        <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-1/2 mb-2" />
        <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded w-3/4" />
      </div>
    )
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="border border-zinc-100 dark:border-zinc-800 rounded-lg p-3">
        <p className="text-[10px] text-red-400">{error}</p>
      </div>
    )
  }

  const s = status!
  const isV2 = s.mode === 'v2_regression'
  const r2Good = (s.r_squared ?? 0) >= 0.75

  return (
    <div className="border border-zinc-100 dark:border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2">
          <StatusDot ok={isV2 && r2Good} />
          <span className="text-[10px] font-medium text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
            ML Model
          </span>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
            style={isV2
              ? { background: '#1D9E7520', color: '#1D9E75' }
              : { background: '#EF9F2720', color: '#EF9F27' }
            }
          >
            {isV2 ? 'v2 regression' : 'v1 fallback'}
          </span>
        </div>
        <svg
          className="text-zinc-400 transition-transform"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
          width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Summary strip — always visible */}
      <div className="grid grid-cols-3 gap-px bg-zinc-100 dark:bg-zinc-800 border-t border-zinc-100 dark:border-zinc-800">
        {[
          {
            label: 'R²',
            value: s.r_squared != null ? s.r_squared.toFixed(3) : '—',
            color: r2Color(s.r_squared),
          },
          {
            label: 'Countries',
            value: s.n_training != null ? String(s.n_training) : '—',
            color: '',
          },
          {
            label: 'Mode',
            value: isV2 ? 'Ridge' : 'Corr.',
            color: isV2 ? '#1D9E75' : '#EF9F27',
          },
        ].map(k => (
          <div key={k.label} className="bg-white dark:bg-zinc-950 px-2 py-1.5">
            <p className="text-[8px] uppercase tracking-wider text-zinc-400">{k.label}</p>
            <p
              className="text-[11px] font-semibold font-mono mt-0.5"
              style={k.color ? { color: k.color } : { color: 'inherit' }}
            >
              <span className={!k.color ? 'text-zinc-700 dark:text-zinc-300' : ''}>
                {k.value}
              </span>
            </p>
          </div>
        ))}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 py-2.5 space-y-3 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950">

          {/* Meta row */}
          <div className="space-y-1">
            {[
              { label: 'Model ID', value: s.model_id != null ? `#${s.model_id}` : '—' },
              { label: 'Trained at', value: formatDate(s.trained_at) },
              { label: 'λ (ridge)', value: s.lambda != null ? s.lambda.toString() : '—' },
            ].map(r => (
              <div key={r.label} className="flex justify-between">
                <span className="text-[9px] text-zinc-400">{r.label}</span>
                <span className="text-[9px] font-mono text-zinc-600 dark:text-zinc-400">{r.value}</span>
              </div>
            ))}
          </div>

          {/* Coefficient bars */}
          {isV2 && s.coefficients && (
            <div>
              <p className="text-[8px] uppercase tracking-wider text-zinc-400 mb-1.5">
                Signal coefficients
              </p>
              {(['telecom', 'electricity', 'building', 'mobility', 'internet'] as const).map(k => (
                <CoefBar key={k} name={k} value={s.coefficients![k]} />
              ))}
              <div className="flex justify-between mt-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[9px] text-zinc-400">intercept</span>
                <span className="text-[9px] font-mono text-zinc-500">
                  {s.coefficients.intercept?.toFixed(4) ?? '—'}
                </span>
              </div>
            </div>
          )}

          {/* R² health indicator */}
          {s.r_squared != null && (
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[9px] text-zinc-400">Goodness of fit (R²)</span>
                <span
                  className="text-[9px] font-mono font-semibold"
                  style={{ color: r2Color(s.r_squared) }}
                >
                  {s.r_squared.toFixed(4)}
                </span>
              </div>
              <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(s.r_squared * 100, 100)}%`,
                    background: r2Color(s.r_squared),
                  }}
                />
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-[8px] text-zinc-300 dark:text-zinc-700">0</span>
                <span className="text-[8px] text-zinc-300 dark:text-zinc-700">
                  {s.r_squared < 0.75 ? '⚠ below 0.75 threshold' : '✓ healthy'}
                </span>
                <span className="text-[8px] text-zinc-300 dark:text-zinc-700">1</span>
              </div>
            </div>
          )}

          {/* Retrain button (only shown when adminToken is present) */}
          {adminToken && (
            <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={handleRetrain}
                disabled={retraining}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-medium transition-colors"
                style={{
                  background: retraining ? 'rgba(29,158,117,0.08)' : 'rgba(29,158,117,0.12)',
                  color: '#1D9E75',
                  cursor: retraining ? 'not-allowed' : 'pointer',
                  opacity: retraining ? 0.6 : 1,
                }}
              >
                {retraining ? (
                  <>
                    <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                    Training…
                  </>
                ) : (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
                    </svg>
                    Retrain model
                  </>
                )}
              </button>
              {retrainResult && (
                <p
                  className="mt-1.5 text-[9px] text-center"
                  style={{ color: retrainResult.startsWith('✓') ? '#1D9E75' : '#E24B4A' }}
                >
                  {retrainResult}
                </p>
              )}
            </div>
          )}

          {/* Method note */}
          <p className="text-[8px] text-zinc-300 dark:text-zinc-700 leading-relaxed">
            {isV2
              ? 'v2: log-linear Ridge regression (RidgeCV, 5-fold). Estimates census-free from infrastructure signals only.'
              : 'v1: correction-factor fallback. Run schema patches + retrain to activate v2.'}
          </p>

          {/* Link to full showcase */}
          <Link
            href="/model"
            className="block text-center text-[9px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors pt-1"
          >
            Full details &rarr;
          </Link>
        </div>
      )}
    </div>
  )
}
