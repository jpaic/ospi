import type { Country } from './mockData'

export function calcDelta(c: Country): number {
  return Math.round((c.ospi - c.official) / c.official * 100)
}

export function deltaStr(c: Country): string {
  const d = calcDelta(c)
  return (d >= 0 ? '+' : '') + d + '%'
}

export function signalColor(v: number): string {
  if (v >= 75) return '#1D9E75'
  if (v >= 50) return '#EF9F27'
  return '#E24B4A'
}

export function confLabel(conf: Country['conf']): string {
  return conf === 'high' ? 'High' : conf === 'med' ? 'Medium' : 'Low'
}

export function confColor(conf: Country['conf']): string {
  if (conf === 'high') return '#1D9E75'
  if (conf === 'med')  return '#EF9F27'
  return '#E24B4A'
}

export function sortByDivergence(countries: Country[]): Country[] {
  return [...countries].sort(
    (a, b) => Math.abs(b.ospi - b.official) - Math.abs(a.ospi - a.official)
  )
}

export function globalStats(countries: Country[]) {
  const totalOfficial = countries.reduce((s, c) => s + c.official, 0)
  const totalOspi     = countries.reduce((s, c) => s + c.ospi, 0)
  const highConf      = countries.filter(c => c.conf === 'high').length
  const lowConf       = countries.filter(c => c.conf === 'low').length
  const avgDivergence = Math.round(
    countries.reduce((s, c) => s + Math.abs(calcDelta(c)), 0) / countries.length
  )
  return { totalOfficial, totalOspi, highConf, lowConf, avgDivergence }
}