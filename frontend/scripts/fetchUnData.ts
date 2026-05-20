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

// ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BASE = 'https://population.un.org/dataportalapi/api/v1'
const INDICATOR_TOTAL_POP = 49   // PopTotal — in people (NOT thousands!)
const START_YEAR = 2018
const END_YEAR   = 2024

const UN_API_TOKEN = process.env.UN_API_TOKEN

// ISO numeric codes matching your mockData countries
const COUNTRIES: { name: string; iso: string; region: string; lat: number; lng: number }[] = [
  { name: 'China',          iso: '156', region: 'East Asia',       lat: 35,  lng: 105  },
  { name: 'India',          iso: '356', region: 'South Asia',       lat: 20,  lng: 77   },
  { name: 'USA',            iso: '840', region: 'North America',    lat: 38,  lng: -97  },
  { name: 'Indonesia',      iso: '360', region: 'Southeast Asia',   lat: -2,  lng: 118  },
  { name: 'Pakistan',       iso: '586', region: 'South Asia',       lat: 30,  lng: 70   },
  { name: 'Brazil',         iso: '076', region: 'Latin America',    lat: -10, lng: -55  },
  { name: 'Nigeria',        iso: '566', region: 'West Africa',      lat: 9,   lng: 8    },
  { name: 'Russia',         iso: '643', region: 'Eastern Europe',   lat: 61,  lng: 90   },
  { name: 'Ethiopia',       iso: '231', region: 'East Africa',      lat: 9,   lng: 40   },
  { name: 'Germany',        iso: '276', region: 'Western Europe',   lat: 51,  lng: 10   },
  { name: 'North Korea',    iso: '408', region: 'East Asia',        lat: 40,  lng: 127  },
  { name: 'Ukraine',        iso: '804', region: 'Eastern Europe',   lat: 49,  lng: 31   },
  { name: 'Japan',          iso: '392', region: 'East Asia',        lat: 36,  lng: 138  },
  { name: 'DR Congo',       iso: '180', region: 'Central Africa',   lat: -3,  lng: 24   },
  { name: 'Bangladesh',     iso: '050', region: 'South Asia',       lat: 24,  lng: 90   },
  { name: 'United Kingdom', iso: '826', region: 'Western Europe',   lat: 55,  lng: -3   },
  { name: 'Italy',          iso: '380', region: 'Southern Europe',  lat: 42,  lng: 12   },
  { name: 'South Korea',    iso: '410', region: 'East Asia',        lat: 36,  lng: 128  },
  { name: 'Spain',          iso: '724', region: 'Southern Europe',  lat: 40,  lng: -4   },
  { name: 'Canada',         iso: '124', region: 'North America',    lat: 56,  lng: -106 },
  { name: 'Australia',      iso: '036', region: 'Oceania',          lat: -25, lng: 133  },
  { name: 'Mexico',         iso: '484', region: 'North America',    lat: 23,  lng: -102 },
  { name: 'Philippines',    iso: '608', region: 'Southeast Asia',   lat: 13,  lng: 122  },
  { name: 'Vietnam',        iso: '704', region: 'Southeast Asia',   lat: 16,  lng: 108  },
  { name: 'Egypt',          iso: '818', region: 'North Africa',     lat: 26,  lng: 30   },
  { name: 'Turkey',         iso: '792', region: 'Middle East',      lat: 39,  lng: 35   },
  { name: 'Iran',           iso: '364', region: 'Middle East',      lat: 32,  lng: 53   },
  { name: 'Thailand',       iso: '764', region: 'Southeast Asia',   lat: 15,  lng: 101  },
  { name: 'France',         iso: '250', region: 'Western Europe',   lat: 46,  lng: 2    },
  { name: 'Tanzania',       iso: '834', region: 'East Africa',      lat: -6,  lng: 35   },
  { name: 'South Africa',   iso: '710', region: 'Southern Africa',  lat: -30, lng: 25   },
  { name: 'Colombia',       iso: '170', region: 'South America',    lat: 4,   lng: -74  },
  { name: 'Kenya',          iso: '404', region: 'East Africa',      lat: 1,   lng: 38   },
  { name: 'Argentina',      iso: '032', region: 'South America',    lat: -34, lng: -64  },
  { name: 'Myanmar',        iso: '104', region: 'Southeast Asia',   lat: 21,  lng: 96   },
  { name: 'Malaysia',       iso: '458', region: 'Southeast Asia',   lat: 4,   lng: 102  },
  { name: 'Peru',           iso: '604', region: 'South America',    lat: -10, lng: -76  },
  { name: 'Venezuela',      iso: '862', region: 'South America',    lat: 7,   lng: -66  },
  { name: 'Nepal',          iso: '524', region: 'South Asia',       lat: 28,  lng: 84   },
  { name: 'Angola',         iso: '024', region: 'Central Africa',   lat: -12, lng: 18   },
  { name: 'Mozambique',     iso: '508', region: 'East Africa',      lat: -18, lng: 35   },
  { name: 'Ghana',          iso: '288', region: 'West Africa',      lat: 7,   lng: -1   },
  { name: 'Yemen',          iso: '887', region: 'Middle East',      lat: 15,  lng: 48   },
  { name: 'Madagascar',     iso: '450', region: 'East Africa',      lat: -20, lng: 47   },
  { name: 'Cameroon',       iso: '120', region: 'Central Africa',   lat: 6,   lng: 12   },
  { name: 'Ivory Coast',    iso: '384', region: 'West Africa',      lat: 7,   lng: -5   },
  { name: 'Niger',          iso: '562', region: 'West Africa',      lat: 17,  lng: 9    },
  { name: 'Sri Lanka',      iso: '144', region: 'South Asia',       lat: 7,   lng: 81   },
  { name: 'Syria',          iso: '760', region: 'Middle East',      lat: 35,  lng: 38   },
  { name: 'Cuba',           iso: '192', region: 'Caribbean',        lat: 21,  lng: -80  },
]

interface UnDataPoint { timeLabel: string; value: number }

async function fetchPopulation(iso: string): Promise<UnDataPoint[]> {
  const url = `${BASE}/data/indicators/${INDICATOR_TOTAL_POP}/locations/${iso}/start/${START_YEAR}/end/${END_YEAR}/?format=json&pageSize=100`
  
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${UN_API_TOKEN}`
    }
  })
  
  if (!res.ok) throw new Error(`UN API error for iso ${iso}: ${res.status}`)
  const json = await res.json() as any
  
  // The API returns values in people, convert to millions
  return (json.data ?? []).map((point: any) => ({
    timeLabel: point.timeLabel,
    value: point.value / 1_000_000 // Convert to millions
  }))
}

async function main() {
  console.log(`Fetching UN WPP data for ${COUNTRIES.length} countries…`)
  const result = []

  for (const c of COUNTRIES) {
    try {
      const rows = await fetchPopulation(c.iso)

      // Sort ascending by year
      rows.sort((a, b) => Number(a.timeLabel) - Number(b.timeLabel))

      const history = rows.map(r => ({
        y: Number(r.timeLabel),
        v: Math.round(r.value),
      }))

      // Latest year = official population
      const latest   = history[history.length - 1]
      const official = latest?.v ?? 0

      // Derive a rough growth rate from the last two data points
      const prev       = history[history.length - 2]
      const growthRate = prev && prev.v > 0
        ? Math.round(((latest.v - prev.v) / prev.v) * 1000) / 10
        : 0

      result.push({
        name:        c.name,
        iso:         c.iso,
        lat:         c.lat,
        lng:         c.lng,
        region:      c.region,
        official,
        ospi:        official,
        conf:        'low' as const,
        signals: {
          telecom:     0,
          electricity: 0,
          building:    0,
          mobility:    0,
          internet:    0,
        },
        history,
        urbanPct:    0,
        growthRate,
        densityKm2:  0,
        gdpPerCapita: 0,
        regions:     [],
      })

      console.log(`  ✓ ${c.name} — ${official}M`)
    } catch (err) {
      console.error(`  ✗ ${c.name}:`, err)
    }
  }

  const outPath = path.resolve(__dirname, '../lib/unData.json')
  
  // Ensure the lib directory exists
  const libDir = path.dirname(outPath)
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true })
  }
  
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2))
  console.log(`\nWrote ${result.length} countries to ${outPath}`)
}

main()