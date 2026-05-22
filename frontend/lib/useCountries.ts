'use client'

/**
 * lib/useCountries.ts
 *
 * Single hook that returns the active countries array based on the
 * current data source (UN + backend signals). Replace direct type
 * imports with this hook in any component.
 *
 * Usage:
 *   const countries = useCountries()
 */

import { useEffect, useMemo, useState } from 'react'
import { useDataSource } from './dataSource'
import type { Country, SignalScores } from './types'
import unRaw from './unData.json'

// Cast the static JSON to Country[]. Fields missing from UN data
// (urbanPct, densityKm2, gdpPerCapita, regions) are zeroed/empty
// in the fetch script, so the shape is always valid.
const initialUnCountries: Country[] = (unRaw as unknown as Country[]).map((country) => ({
  ...country,
  signals: {
    telecom: country.signals?.telecom ?? 0,
    electricity: country.signals?.electricity ?? 0,
    building: country.signals?.building ?? 0,
    mobility: country.signals?.mobility ?? 0,
    internet: country.signals?.internet ?? 0,
  },
  history: country.history ?? [],
  regions: country.regions ?? [],
  urbanPct: country.urbanPct ?? 0,
  densityKm2: country.densityKm2 ?? 0,
  gdpPerCapita: country.gdpPerCapita ?? 0,
  growthRate: country.growthRate ?? 0,
}))

let cachedBackendCountries: Country[] | null = null
let cachedBackendPromise: Promise<Country[]> | null = null

const CACHE_KEY = 'ospi:countries'
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

function loadCachedCountries(): Country[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.ts || !Array.isArray(parsed.countries)) return null
    if (Date.now() - parsed.ts > CACHE_TTL) return null
    return parsed.countries as Country[]
  } catch (e) {
    return null
  }
}

function saveCachedCountries(countries: Country[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), countries }))
  } catch (e) {
    // ignore storage errors
  }
}

function normalizeSignal(value: number | null | undefined) {
  if (value == null) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizeSignals(signals: Partial<Record<keyof SignalScores, number | null>> | undefined) {
  return {
    telecom: normalizeSignal(signals?.telecom),
    electricity: normalizeSignal(signals?.electricity),
    building: normalizeSignal(signals?.building),
    mobility: normalizeSignal(signals?.mobility),
    internet: normalizeSignal(signals?.internet),
  }
}

function mergeUnAndBackend(
  country: Country,
  backend?: {
    iso2: string
    official: number | null
    ospi: number | null
    conf: Country['conf'] | null
    signals?: Partial<Record<keyof SignalScores, number | null>>
  },
) {
  if (!backend) {
    return country
  }

  return {
    ...country,
    official: backend.official ?? country.official,
    ospi: backend.ospi ?? country.ospi,
    conf: backend.conf ?? country.conf,
    signals: normalizeSignals({ ...country.signals, ...backend.signals }),
  }
}

export async function fetchBackendCountries(): Promise<Country[]> {
  if (cachedBackendCountries) return cachedBackendCountries
  if (cachedBackendPromise) return cachedBackendPromise

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, '')
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_BACKEND_URL must be set to fetch backend country signal data')
  }

  const url = `${baseUrl}/countries`

  cachedBackendPromise = (async () => {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) {
        throw new Error(`Failed to fetch backend countries (${res.status}) from ${url}`)
      }
      const payload = await res.json()

        const backendMap = new Map<string, {
          iso2: string
          official: number | null
          ospi: number | null
          conf: Country['conf'] | null
          signals?: Partial<Record<keyof SignalScores, number | null>>
        }>()

        for (const item of payload as Array<any>) {
          backendMap.set(String(item.iso2).toUpperCase(), {
            iso2: String(item.iso2).toUpperCase(),
            official: item.official ?? null,
            ospi: item.ospi ?? null,
            conf: item.conf ?? null,
            signals: item.signals,
          })
        }

      const merged = initialUnCountries.map((country) =>
        mergeUnAndBackend(country, backendMap.get(country.iso.toUpperCase())),
      )
      cachedBackendCountries = merged
      try {
        saveCachedCountries(merged)
      } catch (e) {
        // ignore
      }
      return merged
    } catch (error) {
      cachedBackendPromise = null
      throw error instanceof Error ? error : new Error(String(error))
    }
  })()

  return cachedBackendPromise
}

export function useCountries(): Country[] {
  const { setSignalsAvailable } = useDataSource()
  // Start with the UN baseline on first render to match server-side HTML.
  // Apply any localStorage cache in a client-only effect to avoid hydration mismatches.
  const [countries, setCountries] = useState<Country[]>(() => initialUnCountries)

  useEffect(() => {
    let cancelled = false
    // On the client, prefer a cached copy if available so reloads are fast.
    const cached = loadCachedCountries()
    if (cached) {
      setCountries(cached)
      const hasSignals = cached.some((country) =>
        Object.values(country.signals).some((value) => value > 0),
      )
      setSignalsAvailable(hasSignals)
    } else {
      setCountries(initialUnCountries)
      setSignalsAvailable(false)
    }

    fetchBackendCountries()
      .then((backendCountries) => {
        if (cancelled) return
        setCountries(backendCountries)
        saveCachedCountries(backendCountries)
        const hasSignals = backendCountries.some((country) =>
          Object.values(country.signals).some((value) => value > 0),
        )
        setSignalsAvailable(hasSignals)
      })
      .catch(() => {
        if (cancelled) return
        setCountries(initialUnCountries)
        setSignalsAvailable(false)
      })

    return () => {
      cancelled = true
    }
  }, [setSignalsAvailable])

  return useMemo(() => countries, [countries])
}
