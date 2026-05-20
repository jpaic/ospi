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
const INDICATOR_TOTAL_POP = 49   // PopTotal — in people
const START_YEAR = 2018
const END_YEAR = 2024

const UN_API_TOKEN = process.env.UN_API_TOKEN

interface Location {
    Id: number
    Name: string
    Iso2: string | null
    Iso3: string | null
    Latitude: number | null
    Longitude: number | null
    Region: string | null
    SubRegion: string | null
    WorldBankIncomeGroup: string | null
    UNDevelopmentGroup: string | null
    SDGRegion: string | null
    PopPeak: string | null
}

interface UnDataPoint { timeLabel: string; value: number }

interface CountryData {
    name: string
    iso: string
    lat: number
    lng: number
    region: string
    official: number
    ospi: number
    conf: 'low' | 'medium' | 'high'
    signals: {
        telecom: number
        electricity: number
        building: number
        mobility: number
        internet: number
    }
    history: Array<{ y: number; v: number }>
    urbanPct: number
    growthRate: number
    densityKm2: number
    gdpPerCapita: number
    regions: any[]
}

// List of UN member states + observers
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
    'Dem. People\'s Rep. of Korea', 'Democratic Republic of the Congo', 'Denmark', 'Djibouti', 'Dominica',
    'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea',
    'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji',
    'Finland', 'France', 'Gabon', 'Gambia', 'Georgia',
    'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala',
    'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras',
    'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran (Islamic Republic of)',
    'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica',
    'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati',
    'Kuwait', 'Kyrgyzstan', 'Kosovo (under UNSC res. 1244)', 'Lao People\'s Democratic Republic', 'Latvia', 'Lebanon',
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
    'Viet Nam', 'Yemen', 'Zambia', 'Zimbabwe'
])

async function fetchAllLocations(): Promise<Location[]> {
    const allLocations: Location[] = []
    let page = 1
    const pageSize = 250
    let totalPages = 1

    while (page <= totalPages) {
        // Use the locationsWithAggregates endpoint
        const url = `${BASE}/locationsWithAggregates?pageNumber=${page}&pageSize=${pageSize}`
        console.log(`Fetching page ${page} of locations...`)

        const res = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${UN_API_TOKEN}`
            }
        })

        if (!res.ok) throw new Error(`Failed to fetch locations: ${res.status}`)
        const response = await res.json() as any

        if (response.data && Array.isArray(response.data)) {
            allLocations.push(...response.data)

            if (response.pages) {
                totalPages = response.pages
            }

            console.log(`  Found ${response.data.length} locations on page ${page} (${allLocations.length}/${response.total} total)`)
            page++
        } else {
            console.error('Unexpected response structure:', Object.keys(response))
            break
        }
    }

    console.log(`\nTotal locations fetched: ${allLocations.length}`)
    return allLocations
}

async function fetchPopulation(locationId: number): Promise<UnDataPoint[]> {
    const url = `${BASE}/data/indicators/${INDICATOR_TOTAL_POP}/locations/${locationId}/start/${START_YEAR}/end/${END_YEAR}/?format=json&pageSize=100`

    const res = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${UN_API_TOKEN}`
        }
    })

    if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`)
    }

    const json = await res.json() as any

    let allData: any[] = []

    if (json.data && Array.isArray(json.data)) {
        allData = json.data
    } else if (Array.isArray(json)) {
        allData = json
    }

    // The API returns values in people, convert to millions
    return allData.map((point: any) => ({
        timeLabel: point.timeLabel,
        value: point.value / 1_000_000
    }))
}

// Wrapper function with retry logic for 502 errors
async function fetchPopulationWithRetry(
    locationId: number,
    locationName: string,
    maxRetries: number = 3
): Promise<UnDataPoint[]> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fetchPopulation(locationId)
        } catch (err) {
            const error = err as Error
            lastError = error

            // Check if it's a 502 error
            const is502 = error.message.includes('502')

            if (is502 && attempt < maxRetries) {
                // Exponential backoff: 1s, 2s, 4s
                const delay = Math.pow(2, attempt - 1) * 1000
                console.log(`${locationName}: 502 error, retry ${attempt}/${maxRetries} in ${delay}ms`)
                await new Promise(resolve => setTimeout(resolve, delay))
                continue
            }

            // If not 502 or out of retries, throw the error
            throw error
        }
    }

    throw lastError || new Error(`Failed to fetch data for ${locationName} after ${maxRetries} attempts`)
}

async function main() {
    console.log('Fetching all countries from UN Data Portal...\n')

    const allLocations = await fetchAllLocations()

    // Filter to include only sovereign countries
    const countries = allLocations.filter(loc => {
        // Must have Iso2 code (basic validation)
        if (!loc.Iso2 || loc.Iso2.length !== 2) return false

        // Check if it's a sovereign country by name
        return SOVEREIGN_COUNTRIES.has(loc.Name)
    })

    console.log(`\n  ${countries.length} sovereign countries identified out of ${allLocations.length} total locations\n`)

    if (countries.length === 0) {
        console.error('No countries found!')
        console.log('\n💡 Debug: Here are the first 20 locations from API:')
        allLocations.slice(0, 20).forEach((loc, idx) => {
            console.log(`  ${idx + 1}. ${loc.Name} - Iso2: ${loc.Iso2 || 'null'}, SubRegion: ${loc.SubRegion || 'null'}`)
        })
        return
    }

    console.log('Sample countries:')
    countries.slice(0, 10).forEach(c => {
        console.log(`  - ${c.Name} (${c.Iso2})`)
    })
    console.log('')

    console.log('  Fetching population data for all countries...\n')
    const result: CountryData[] = []
    let successCount = 0
    let failCount = 0
    let noDataCount = 0

    for (let i = 0; i < countries.length; i++) {
        const country = countries[i]

        // Show progress every 10 countries
        if (i % 10 === 0 && i > 0) {
            console.log(`  Progress: ${i}/${countries.length} countries processed (${successCount} successful, ${noDataCount} no data, ${failCount} failed)`)
        }

        try {
            // Use the retry wrapper instead of direct fetchPopulation
            const rows = await fetchPopulationWithRetry(country.Id, country.Name)

            if (rows.length === 0) {
                noDataCount++
                continue
            }

            // Sort ascending by year
            rows.sort((a, b) => Number(a.timeLabel) - Number(b.timeLabel))

            const history = rows.map(r => ({
                y: Number(r.timeLabel),
                v: r.value,
            }))

            // Latest year = official population
            const latest = history[history.length - 1]
            const official = latest?.v ?? 0

            // Skip if population is 0 (likely no data)
            if (official === 0) {
                noDataCount++
                continue
            }

            // Derive a rough growth rate from the last two data points
            const prev = history[history.length - 2]
            const growthRate = prev && prev.v > 0
                ? ((latest.v - prev.v) / prev.v) * 100  // Returns decimal like 1.23 for 1.23%
                : 0

            // Use coordinates from API
            const lat = country.Latitude ?? 0
            const lng = country.Longitude ?? 0

            const region = country.SubRegion || 'Unknown'

            result.push({
                name: country.Name,
                iso: country.Iso2 || '',
                lat: lat,
                lng: lng,
                region: region,
                official,
                ospi: official,
                conf: 'low' as const,
                signals: {
                    telecom: 0,
                    electricity: 0,
                    building: 0,
                    mobility: 0,
                    internet: 0,
                },
                history,
                urbanPct: 0,
                growthRate,
                densityKm2: 0,
                gdpPerCapita: 0,
                regions: [],
            })

            successCount++

            // Log first 20 successes to see progress
            if (successCount <= 20) {
                console.log(`${country.Name} — ${official.toLocaleString()}M (${region})`)
            }

            // Add a small delay to be nice to the API and prevent rate limiting
            await new Promise(resolve => setTimeout(resolve, 200))
        } catch (err) {
            failCount++
            // Error already logged in retry function, only log if it's not a 502 retry case
            if (failCount <= 10) {
                console.error(`${country.Name}:`, err instanceof Error ? err.message : err)
            }
        }
    }

    // Sort by population (largest first)
    result.sort((a, b) => b.official - a.official)

    const outPath = path.resolve(__dirname, '../lib/unData.json')

    // Ensure the lib directory exists
    const libDir = path.dirname(outPath)
    if (!fs.existsSync(libDir)) {
        fs.mkdirSync(libDir, { recursive: true })
    }

    fs.writeFileSync(outPath, JSON.stringify(result, null, 2))

    console.log(`\n   Done!`)
    console.log(`   • Successfully fetched: ${successCount} countries`)
    console.log(`   • No data available: ${noDataCount} countries`)
    console.log(`   • Failed: ${failCount} countries`)
    console.log(`   • Total countries in dataset: ${result.length}`)
    console.log(`   • Data saved to: ${outPath}`)
    console.log(`\n  Top 20 most populous countries:`)
    result.slice(0, 20).forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.name}: ${c.official.toLocaleString()}M (${c.region})`)
    })
}

main().catch(console.error)