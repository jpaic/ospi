'use client'

/**
 * lib/useCountries.ts
 */

import { useEffect, useState } from 'react'
import { useDataSource } from './dataSource'
import type { Country, SignalScores } from './types'

const CACHE_KEY = 'ospi:countries:v5'
const CACHE_TTL = 24 * 60 * 60 * 1000

type BackendHistoryPoint = {
  y?: number | string
  v?: number | string
}

type BackendOspiHistoryPoint = BackendHistoryPoint & {
  official?: number | string
  conf?: Country['conf']
  composite_signal?: number | string | null
}

type BackendCountryPayload = {
  name?: string
  iso?: string
  lat?: number | string
  lng?: number | string
  region?: string
  official?: number | string
  ospi?: number | string
  conf?: Country['conf']
  signals?: Partial<Record<keyof SignalScores, number | null>>
  history?: BackendHistoryPoint[]
  ospiHistory?: BackendOspiHistoryPoint[]
  urbanPct?: number | string
  densityKm2?: number | string
  gdpPerCapita?: number | string
  growthRate?: number | string
  regions?: Country['regions']
}

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
  } catch {}
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
    telecom:        normalizeSignal(signals?.telecom),
    electricity:    normalizeSignal(signals?.electricity),
    gdp_per_capita: normalizeSignal(signals?.gdp_per_capita),
    nightlights:    normalizeSignal(signals?.nightlights),
    road_density:   normalizeSignal(signals?.road_density),
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

let cachedCountries: Country[] | null = null
let pendingPromise: Promise<Country[]> | null = null

export async function fetchBackendCountries(): Promise<Country[]> {
  if (cachedCountries) return cachedCountries
  if (pendingPromise) return pendingPromise

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, '')
  if (!baseUrl) throw new Error('NEXT_PUBLIC_BACKEND_URL is not set')

  pendingPromise = (async () => {
    try {
      const res = await fetch(`${baseUrl}/countries/full`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`/countries/full returned ${res.status}`)

      const payload = await res.json() as BackendCountryPayload[]

      const countries: Country[] = payload.map((item) => ({
        name:         String(item.name ?? ''),
        iso:          String(item.iso  ?? '').toUpperCase(),
        lat:          Number(item.lat  ?? 0),
        lng:          Number(item.lng  ?? 0),
        region:       String(item.region ?? 'Unknown'),
        official:     Number(item.official ?? 0),
        ospi:         Number(item.ospi ?? item.official ?? 0),
        conf:         (item.conf ?? 'low') as Country['conf'],
        signals:      normalizeSignals(item.signals),
        history:      Array.isArray(item.history)
                        ? item.history.map((h) => ({ y: Number(h.y), v: Number(h.v) }))
                        : [],
        ospiHistory:  Array.isArray(item.ospiHistory)
                        ? item.ospiHistory.map((h) => ({
                            y: Number(h.y),
                            v: Number(h.v),
                          }))
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

// ── Shared reactive state so both hooks stay in sync ─────────────────────────
// We store the raw state outside React so multiple hook instances share it.

type Listener = () => void
let _countries: Country[] = []
let _isLoading = true
const _listeners = new Set<Listener>()

function notify() {
  _listeners.forEach(fn => fn())
}

function setSharedCountries(c: Country[]) {
  _countries = c
  notify()
}

function setSharedLoading(v: boolean) {
  _isLoading = v
  notify()
}

// ── useCountries — backward-compatible: returns Country[] ─────────────────────

export function useCountries(): Country[] {
  const { setSignalsAvailable } = useDataSource()
  const [, rerender] = useState(0)

  useEffect(() => {
    const listener: Listener = () => rerender(n => n + 1)
    _listeners.add(listener)

    // Only kick off the fetch once (first hook instance)
    if (_listeners.size === 1) {
      const cached = loadCachedCountries()
      if (cached) {
        setSharedCountries(cached)
        setSignalsAvailable(cached.some(c => Object.values(c.signals).some(v => v > 0)))
        setSharedLoading(false)
      }

      fetchBackendCountries()
        .then((fresh) => {
          setSharedCountries(fresh)
          saveCachedCountries(fresh)
          setSignalsAvailable(fresh.some(c => Object.values(c.signals).some(v => v > 0)))
          setSharedLoading(false)
        })
        .catch(() => {
          setSignalsAvailable(false)
          setSharedLoading(false)
        })
    } else {
      // Subsequent instances: sync signals availability from whatever's loaded
      if (_countries.length > 0) {
        setSignalsAvailable(_countries.some(c => Object.values(c.signals).some(v => v > 0)))
      }
    }

    return () => { _listeners.delete(listener) }
  }, [setSignalsAvailable])

  return _countries
}

// ── useCountriesLoading — used only by the loading overlay ────────────────────
//
// Returns true from mount until the very first batch of data (cache or network)
// resolves. Flips to false exactly once and never goes back.

export function useCountriesLoading(): boolean {
  const [isLoading, setIsLoading] = useState(_isLoading)

  useEffect(() => {
    const listener: Listener = () => setIsLoading(_isLoading)
    _listeners.add(listener)
    return () => { _listeners.delete(listener) }
  }, [])

  return isLoading
}
