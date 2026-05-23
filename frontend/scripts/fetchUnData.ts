/**
 * scripts/fetchUnData.ts
 *
 * Fetches real population data from the UN World Population Prospects API
 * and writes it to lib/unData.json.
 *
 * Run with:
 *   npx ts-node scripts/fetchUnData.ts
 *
 * Re-run any time you want fresher UN figures.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BASE = 'https://population.un.org/dataportalapi/api/v1'
const INDICATOR_TOTAL_POP = 49   // PopTotal — in people
const MEDIUM_VARIANT_ID   = 4    // UN WPP: 4=Medium, 5=High, 6=Low
const START_YEAR = 2018
const END_YEAR   = 2024

const UN_API_TOKEN = process.env.UN_API_TOKEN

// ── Types ────────────────────────────────────────────────────────────────────

interface Location {
  Id:       number
  Name:     string
  Iso2:     string | null
  Iso3:     string | null
  Latitude: number | null
  Longitude: number | null
  SubRegion: string | null
}

interface HistoryPoint {
  y: number   // year
  v: number   // population in millions, rounded to 4 dp
}

interface CountryData {
  name:        string
  iso:         string
  lat:         number
  lng:         number
  region:      string
  official:    number   // latest year's population (millions)
  ospi:        number   // mirrors official until model runs
  conf:        'low' | 'med' | 'high'
  signals: {
    telecom:     number
    electricity: number
    building:    number
    mobility:    number
    internet:    number
  }
  history:     HistoryPoint[]   // one entry per year, medium variant total
  urbanPct:    number
  growthRate:  number           // % p.a., derived from last two annual totals
  densityKm2:  number
  gdpPerCapita: number
  regions:     any[]
}

// ── Sovereign country filter ──────────────────────────────────────────────────

const SOVEREIGN_COUNTRIES = new Set([
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola',
  'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria',
  'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados',
  'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan',
  'Bolivia (Plurinational State of)', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei Darussalam',
  'Bulgaria', 'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cambodia',
  'Cameroon', 'Canada', 'Central African Republic', 'Chad', 'Chile',
  'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica',
  "Côte d'Ivoire", 'Croatia', 'Cuba', 'Cyprus', 'Czechia',
  "Dem. People's Rep. of Korea", 'Democratic Republic of the Congo', 'Denmark', 'Djibouti', 'Dominica',
  'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea',
  'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji',
  'Finland', 'France', 'Gabon', 'Gambia', 'Georgia',
  'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala',
  'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras',
  'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran (Islamic Republic of)',
  'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica',
  'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati',
  'Kuwait', 'Kyrgyzstan', 'Kosovo (under UNSC res. 1244)', "Lao People's Democratic Republic", 'Latvia', 'Lebanon',
  'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania',
  'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives',
  'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius',
  'Mexico', 'Micronesia', 'Monaco', 'Mongolia', 'Montenegro',
  'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru',
  'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger',
  'Nigeria', 'North Macedonia', 'Norway', 'Oman', 'Pakistan',
  'Palau', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru',
  'Philippines', 'Poland', 'Portugal', 'Qatar', 'Republic of Korea',
  'Republic of Moldova', 'Romania', 'Russian Federation', 'Rwanda', 'Saint Kitts and Nevis',
  'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe',
  'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone',
  'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia',
  'South Africa', 'South Sudan', 'Spain', 'Sri Lanka', 'State of Palestine',
  'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syrian Arab Republic',
  'China, Taiwan Province of China', 'Tajikistan', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga',
  'Trinidad and Tobago', 'Tunisia', 'Türkiye', 'Turkmenistan', 'Tuvalu',
  'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United Republic of Tanzania',
  'United States of America', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Venezuela (Bolivarian Republic of)',
  'Viet Nam', 'Yemen', 'Zambia', 'Zimbabwe',
])

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchAllLocations(): Promise<Location[]> {
  const all: Location[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const url = `${BASE}/locationsWithAggregates?pageNumber=${page}&pageSize=250`
    console.log(`Fetching locations page ${page}/${totalPages}…`)

    const res = await fetch(url, { headers: { Authorization: `Bearer ${UN_API_TOKEN}` } })
    if (!res.ok) throw new Error(`Locations fetch failed: ${res.status}`)

    const body = await res.json() as { data: Location[]; pages: number }
    all.push(...body.data)
    totalPages = body.pages ?? 1
    page++
  }

  console.log(`\nTotal locations: ${all.length}`)
  return all
}

async function fetchPopulation(locationId: number): Promise<HistoryPoint[]> {
  const url =
    `${BASE}/data/indicators/${INDICATOR_TOTAL_POP}` +
    `/locations/${locationId}/start/${START_YEAR}/end/${END_YEAR}` +
    `/?format=json&pageSize=200`

  const res = await fetch(url, { headers: { Authorization: `Bearer ${UN_API_TOKEN}` } })
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)

  const json = await res.json() as any
  const rows: any[] = json.data ?? (Array.isArray(json) ? json : [])

  const yearMap = new Map<number, number>()

  for (const row of rows) {
    if (row.variantId !== MEDIUM_VARIANT_ID) continue
    if (row.value == null) continue

    const year = Number(row.timeLabel)
    const pop  = parseFloat((row.value / 1_000_000).toFixed(4))

    if (!yearMap.has(year)) {
      yearMap.set(year, pop)
    }
  }

  return Array.from(yearMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([y, v]) => ({ y, v }))
}

async function fetchWithRetry(
  locationId: number,
  name: string,
  retries = 3,
): Promise<HistoryPoint[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetchPopulation(locationId)
    } catch (err: any) {
      if (err.message?.includes('502') && attempt < retries) {
        const delay = Math.pow(2, attempt - 1) * 1000
        console.log(`  ${name}: 502 error — retry ${attempt}/${retries} in ${delay}ms`)
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      throw err
    }
  }
  throw new Error(`Failed after ${retries} retries: ${name}`)
}

// ── Growth rate ───────────────────────────────────────────────────────────────

function calcGrowthRate(history: HistoryPoint[]): number {
  if (history.length < 2) return 0
  const latest = history[history.length - 1]
  const prev   = history[history.length - 2]
  if (!prev || prev.v === 0) return 0
  return parseFloat(((latest.v - prev.v) / prev.v * 100).toFixed(4))
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching UN WPP population data (Medium variant only)…\n')

  const allLocations = await fetchAllLocations()

  const countries = allLocations.filter(
    loc => loc.Iso2?.length === 2 && SOVEREIGN_COUNTRIES.has(loc.Name),
  )
  console.log(`\n${countries.length} sovereign countries identified\n`)

  const result: CountryData[] = []
  let successCount  = 0
  let noDataCount   = 0
  let failCount     = 0

  for (let i = 0; i < countries.length; i++) {
    const country = countries[i]

    if (i > 0 && i % 10 === 0) {
      console.log(
        `  Progress: ${i}/${countries.length} — ` +
        `${successCount} successful · ${noDataCount} no data · ${failCount} failed`,
      )
    }

    try {
      const history = await fetchWithRetry(country.Id, country.Name)

      if (history.length === 0) {
        noDataCount++
        continue
      }

      const latest  = history[history.length - 1]
      const official = latest.v

      if (official === 0) {
        noDataCount++
        continue
      }

      result.push({
        name:         country.Name,
        iso:          country.Iso2!,
        lat:          country.Latitude  ?? 0,
        lng:          country.Longitude ?? 0,
        region:       country.SubRegion ?? 'Unknown',
        official,
        ospi:         official,
        conf:         'low',
        signals: {
          telecom:     0,
          electricity: 0,
          building:    0,
          mobility:    0,
          internet:    0,
        },
        history,
        urbanPct:     0,
        growthRate:   calcGrowthRate(history),
        densityKm2:   0,
        gdpPerCapita: 0,
        regions:      [],
      })

      successCount++
      if (successCount <= 5) {
        console.log(
          `  ${country.Name} — ${official.toLocaleString()}M · ` +
          `${history.length} years · growth ${result[result.length - 1].growthRate.toFixed(2)}%`,
        )
      }

      await new Promise(r => setTimeout(r, 200))
    } catch (err) {
      failCount++
      if (failCount <= 10) {
        console.error(`  ✗ ${country.Name}:`, err instanceof Error ? err.message : err)
      }
    }
  }

  // Sort by population descending
  result.sort((a, b) => b.official - a.official)

  // ── Write output ────────────────────────────────────────────────────────────
  const outPath = path.resolve(__dirname, '../lib/unData.json')
  const libDir  = path.dirname(outPath)
  if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true })

  fs.writeFileSync(outPath, JSON.stringify(result, null, 2))

  console.log(`\n✓ Done`)
  console.log(`  Successfully fetched : ${successCount}`)
  console.log(`  No data / skipped    : ${noDataCount}`)
  console.log(`  Failed               : ${failCount}`)
  console.log(`  Written to           : ${outPath}`)
  console.log(`\n  Top 10:`)
  result.slice(0, 10).forEach((c, i) => {
    console.log(
      `    ${String(i + 1).padStart(2)}. ${c.name.padEnd(35)} ` +
      `${c.official.toFixed(2).padStart(8)}M  ` +
      `growth ${c.growthRate >= 0 ? '+' : ''}${c.growthRate.toFixed(2)}%`,
    )
  })
}

main().catch(console.error)