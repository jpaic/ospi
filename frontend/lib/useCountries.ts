'use client'

/**
 * lib/useCountries.ts
 *
 * Single hook that returns the active countries array based on the
 * current data source (mock or UN). Replace direct imports of
 * `countries` from mockData with this hook in any component.
 *
 * Usage:
 *   const countries = useCountries()
 */

import { useMemo } from 'react'
import { useDataSource } from './dataSource'
import { countries as mockCountries } from './mockData'
import unRaw from './unData.json'
import type { Country } from './mockData'

// Cast the static JSON to Country[]. Fields missing from UN data
// (urbanPct, densityKm2, gdpPerCapita, regions) are zeroed/empty
// in the fetch script, so the shape is always valid.
const unCountries = unRaw as unknown as Country[]

export function useCountries(): Country[] {
  const { source } = useDataSource()
  return useMemo(
    () => source === 'mock' ? mockCountries : unCountries,
    [source],
  )
}