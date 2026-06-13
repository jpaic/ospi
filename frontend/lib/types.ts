export interface SignalScores {
  telecom: number
  electricity: number
  gdp_per_capita: number
  nightlights: number
  mobility: number
}

export interface HistoryPoint {
  y: number
  v: number
}

export interface OspiHistoryPoint extends HistoryPoint {
  official?: number
  conf?: 'high' | 'med' | 'low'
  composite_signal?: number | null
}

export interface Region {
  name: string
  pop: number      // official regional pop in millions
  ospi: number     // OSPI estimate
  conf: 'high' | 'med' | 'low'
}

export interface Country {
  name: string
  iso: string
  lat: number
  lng: number
  official: number
  ospi: number
  conf: 'high' | 'med' | 'low'
  signals: SignalScores
  history: HistoryPoint[]
  ospiHistory: OspiHistoryPoint[]
  urbanPct: number       // % urban population
  growthRate: number     // annual % growth
  densityKm2: number     // people per km²
  gdpPerCapita: number   // USD
  region: string         // continent/macro-region
  regions: Region[]
}
