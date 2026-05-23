'use client'

/**
 * lib/useCountries.ts
 *
 * Fetches the full Country dataset from the backend /countries/full endpoint.
 * No longer depends on the static unData.json baseline.
 */

import { useEffect, useMemo, useState } from 'react'
import { useDataSource } from './dataSource'
import type { Country, SignalScores } from './types'

const CACHE_KEY = 'ospi:countries:v2'   // bumped to bust old unData-based cache
const CACHE_TTL = 24 * 60 * 60 * 1000  // 24 h

// ── Cache helpers ─────────────────────────────────────────────────────────────

function loadCachedCountries(): Country[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.ts || !Array.isArray(parsed.countries)) return null
    if (Date.now() - parsed.ts > CACHE_TTL) return null
    return parsed.countries as Country[]
  } catch {
    return null
  }
}

function saveCachedCountries(countries: Country[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), countries }))
  } catch {
    // ignore quota errors
  }
}

// ── Signal normalisation ──────────────────────────────────────────────────────

function normalizeSignal(value: number | null | undefined): number {
  if (value == null) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizeSignals(
  signals: Partial<Record<keyof SignalScores, number | null>> | undefined,
): SignalScores {
  return {
    telecom:     normalizeSignal(signals?.telecom),
    electricity: normalizeSignal(signals?.electricity),
    building:    normalizeSignal(signals?.building),
    mobility:    normalizeSignal(signals?.mobility),
    internet:    normalizeSignal(signals?.internet),
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

let cachedCountries: Country[] | null = null
let pendingPromise:  Promise<Country[]> | null = null

export async function fetchBackendCountries(): Promise<Country[]> {
  if (cachedCountries) return cachedCountries
  if (pendingPromise)  return pendingPromise

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, '')
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_BACKEND_URL is not set')
  }

  pendingPromise = (async () => {
    try {
      const res = await fetch(`${baseUrl}/countries/full`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`/countries/full returned ${res.status}`)

      const payload: any[] = await res.json()

      const countries: Country[] = payload.map((item) => ({
        name:         String(item.name ?? ''),
        iso:          String(item.iso  ?? '').toUpperCase(),
        lat:          Number(item.lat  ?? 0),
        lng:          Number(item.lng  ?? 0),
        region:       String(item.region ?? 'Unknown'),
        official:     Number(item.official ?? 0),
        ospi:         Number(item.ospi     ?? item.official ?? 0),
        conf:         (item.conf ?? 'low') as Country['conf'],
        signals:      normalizeSignals(item.signals),
        history:      Array.isArray(item.history)
                        ? item.history.map((h: any) => ({ y: Number(h.y), v: Number(h.v) }))
                        : [],
        urbanPct:     Number(item.urbanPct     ?? 0),
        densityKm2:   Number(item.densityKm2   ?? 0),
        gdpPerCapita: Number(item.gdpPerCapita ?? 0),
        growthRate:   Number(item.growthRate   ?? 0),
        regions:      Array.isArray(item.regions) ? item.regions : [],
      }))

      cachedCountries = countries
      saveCachedCountries(countries)
      return countries
    } catch (err) {
      pendingPromise = null
      throw err instanceof Error ? err : new Error(String(err))
    }
  })()

  return pendingPromise
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCountries(): Country[] {
  const { setSignalsAvailable } = useDataSource()
  const [countries, setCountries] = useState<Country[]>([])

  useEffect(() => {
    let cancelled = false

    // Serve cache instantly on mount so the UI isn't blank on reload
    const cached = loadCachedCountries()
    if (cached) {
      setCountries(cached)
      setSignalsAvailable(cached.some(c => Object.values(c.signals).some(v => v > 0)))
    }

    fetchBackendCountries()
      .then((fresh) => {
        if (cancelled) return
        setCountries(fresh)
        saveCachedCountries(fresh)
        setSignalsAvailable(fresh.some(c => Object.values(c.signals).some(v => v > 0)))
      })
      .catch(() => {
        if (cancelled) return
        // Keep whatever is already displayed (cache or empty)
        setSignalsAvailable(false)
      })

    return () => { cancelled = true }
  }, [setSignalsAvailable])

  return useMemo(() => countries, [countries])
}