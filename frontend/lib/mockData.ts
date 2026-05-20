export interface SignalScores {
  telecom: number
  electricity: number
  building: number
  mobility: number
  internet: number
}

export interface HistoryPoint {
  y: number
  v: number
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
  urbanPct: number       // % urban population
  growthRate: number     // annual % growth
  densityKm2: number     // people per km²
  gdpPerCapita: number   // USD
  region: string         // continent/macro-region
  regions: Region[]
}

export const countries: Country[] = [
  {
    name: 'China', iso: '156', lat: 35, lng: 105,
    official: 1412, ospi: 1389, conf: 'high',
    urbanPct: 64, growthRate: 0.1, densityKm2: 147, gdpPerCapita: 12720, region: 'East Asia',
    signals: { telecom: 91, electricity: 88, building: 85, mobility: 82, internet: 79 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 1370 + i * 4 })),
    regions: [
      { name: 'Guangdong',  pop: 127, ospi: 124, conf: 'high' },
      { name: 'Shandong',   pop: 102, ospi: 99,  conf: 'high' },
      { name: 'Henan',      pop: 99,  ospi: 97,  conf: 'med'  },
      { name: 'Sichuan',    pop: 84,  ospi: 82,  conf: 'med'  },
      { name: 'Xinjiang',   pop: 26,  ospi: 21,  conf: 'low'  },
      { name: 'Tibet',      pop: 3.6, ospi: 3.1, conf: 'low'  },
    ],
  },
  {
    name: 'India', iso: '356', lat: 20, lng: 77,
    official: 1417, ospi: 1451, conf: 'med',
    urbanPct: 35, growthRate: 0.9, densityKm2: 430, gdpPerCapita: 2379, region: 'South Asia',
    signals: { telecom: 84, electricity: 71, building: 78, mobility: 75, internet: 62 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 1350 + i * 17 })),
    regions: [
      { name: 'Uttar Pradesh', pop: 241, ospi: 251, conf: 'low'  },
      { name: 'Maharashtra',   pop: 123, ospi: 128, conf: 'med'  },
      { name: 'Bihar',         pop: 124, ospi: 132, conf: 'low'  },
      { name: 'West Bengal',   pop: 99,  ospi: 101, conf: 'med'  },
      { name: 'Rajasthan',     pop: 82,  ospi: 85,  conf: 'med'  },
    ],
  },
  {
    name: 'USA', iso: '840', lat: 38, lng: -97,
    official: 334, ospi: 331, conf: 'high',
    urbanPct: 83, growthRate: 0.4, densityKm2: 34, gdpPerCapita: 63530, region: 'North America',
    signals: { telecom: 95, electricity: 93, building: 90, mobility: 88, internet: 94 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 327 + i * 1 })),
    regions: [
      { name: 'California',    pop: 39,  ospi: 38,  conf: 'high' },
      { name: 'Texas',         pop: 30,  ospi: 30,  conf: 'high' },
      { name: 'Florida',       pop: 22,  ospi: 22,  conf: 'high' },
      { name: 'New York',      pop: 20,  ospi: 19,  conf: 'high' },
      { name: 'Illinois',      pop: 13,  ospi: 12,  conf: 'high' },
    ],
  },
  {
    name: 'Indonesia', iso: '360', lat: -2, lng: 118,
    official: 277, ospi: 291, conf: 'med',
    urbanPct: 57, growthRate: 1.1, densityKm2: 145, gdpPerCapita: 4292, region: 'Southeast Asia',
    signals: { telecom: 79, electricity: 61, building: 68, mobility: 65, internet: 55 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 267 + i * 4 })),
    regions: [
      { name: 'Java',          pop: 156, ospi: 163, conf: 'med' },
      { name: 'Sumatra',       pop: 58,  ospi: 62,  conf: 'med' },
      { name: 'Kalimantan',    pop: 16,  ospi: 17,  conf: 'low' },
      { name: 'Sulawesi',      pop: 19,  ospi: 20,  conf: 'low' },
      { name: 'Papua',         pop: 4.3, ospi: 5.1, conf: 'low' },
    ],
  },
  {
    name: 'Pakistan', iso: '586', lat: 30, lng: 70,
    official: 231, ospi: 258, conf: 'low',
    urbanPct: 37, growthRate: 2.0, densityKm2: 287, gdpPerCapita: 1505, region: 'South Asia',
    signals: { telecom: 68, electricity: 52, building: 59, mobility: 55, internet: 43 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 212 + i * 7 })),
    regions: [
      { name: 'Punjab',        pop: 110, ospi: 122, conf: 'low' },
      { name: 'Sindh',         pop: 55,  ospi: 62,  conf: 'low' },
      { name: 'KPK',           pop: 36,  ospi: 40,  conf: 'low' },
      { name: 'Balochistan',   pop: 14,  ospi: 17,  conf: 'low' },
    ],
  },
  {
    name: 'Brazil', iso: '076', lat: -10, lng: -55,
    official: 215, ospi: 212, conf: 'high',
    urbanPct: 87, growthRate: 0.5, densityKm2: 25, gdpPerCapita: 8917, region: 'Latin America',
    signals: { telecom: 88, electricity: 82, building: 79, mobility: 76, internet: 80 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 208 + i * 1 })),
    regions: [
      { name: 'São Paulo',     pop: 46,  ospi: 45,  conf: 'high' },
      { name: 'Minas Gerais',  pop: 21,  ospi: 21,  conf: 'high' },
      { name: 'Rio de Janeiro',pop: 17,  ospi: 17,  conf: 'high' },
      { name: 'Bahia',         pop: 15,  ospi: 14,  conf: 'med'  },
      { name: 'Amazon',        pop: 4.3, ospi: 4.1, conf: 'med'  },
    ],
  },
  {
    name: 'Nigeria', iso: '566', lat: 9, lng: 8,
    official: 218, ospi: 247, conf: 'low',
    urbanPct: 53, growthRate: 2.5, densityKm2: 236, gdpPerCapita: 2184, region: 'West Africa',
    signals: { telecom: 72, electricity: 38, building: 55, mobility: 49, internet: 40 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 195 + i * 9 })),
    regions: [
      { name: 'Lagos',         pop: 15,  ospi: 21,  conf: 'low' },
      { name: 'Kano',          pop: 13,  ospi: 16,  conf: 'low' },
      { name: 'Kaduna',        pop: 9,   ospi: 11,  conf: 'low' },
      { name: 'Rivers',        pop: 8,   ospi: 9,   conf: 'low' },
    ],
  },
  {
    name: 'Russia', iso: '643', lat: 61, lng: 90,
    official: 144, ospi: 139, conf: 'med',
    urbanPct: 75, growthRate: -0.2, densityKm2: 8, gdpPerCapita: 12195, region: 'Eastern Europe',
    signals: { telecom: 82, electricity: 80, building: 70, mobility: 68, internet: 83 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 145 - i * 1 })),
    regions: [
      { name: 'Moscow Oblast', pop: 21,  ospi: 20,  conf: 'high' },
      { name: 'Krasnodar',     pop: 5.7, ospi: 5.5, conf: 'med'  },
      { name: 'Tatarstan',     pop: 3.9, ospi: 3.8, conf: 'med'  },
      { name: 'Siberia',       pop: 19,  ospi: 17,  conf: 'low'  },
    ],
  },
  {
    name: 'Ethiopia', iso: '231', lat: 9, lng: 40,
    official: 126, ospi: 141, conf: 'low',
    urbanPct: 22, growthRate: 2.6, densityKm2: 115, gdpPerCapita: 925, region: 'East Africa',
    signals: { telecom: 55, electricity: 29, building: 44, mobility: 38, internet: 22 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 108 + i * 6 })),
    regions: [
      { name: 'Oromia',        pop: 42,  ospi: 49,  conf: 'low' },
      { name: 'Amhara',        pop: 27,  ospi: 31,  conf: 'low' },
      { name: 'Tigray',        pop: 7.1, ospi: 5.8, conf: 'low' },
      { name: 'SNNP',          pop: 23,  ospi: 26,  conf: 'low' },
    ],
  },
  {
    name: 'Germany', iso: '276', lat: 51, lng: 10,
    official: 84, ospi: 83, conf: 'high',
    urbanPct: 77, growthRate: 0.3, densityKm2: 234, gdpPerCapita: 48717, region: 'Western Europe',
    signals: { telecom: 96, electricity: 94, building: 92, mobility: 91, internet: 96 },
    history: [2018,2019,2020,2021,2022,2023].map(() => ({ y: 0, v: 83 })).map((h,i) => ({ y: 2018+i, v: 83 })),
    regions: [
      { name: 'Bavaria',       pop: 13,  ospi: 13,  conf: 'high' },
      { name: 'NRW',           pop: 18,  ospi: 18,  conf: 'high' },
      { name: 'Berlin',        pop: 3.7, ospi: 3.7, conf: 'high' },
      { name: 'Hamburg',       pop: 1.8, ospi: 1.8, conf: 'high' },
    ],
  },
  {
    name: 'North Korea', iso: '408', lat: 40, lng: 127,
    official: 26, ospi: 24, conf: 'low',
    urbanPct: 62, growthRate: 0.4, densityKm2: 214, gdpPerCapita: 640, region: 'East Asia',
    signals: { telecom: 22, electricity: 18, building: 30, mobility: 15, internet: 4 },
    history: [2018,2019,2020,2021,2022,2023].map((y) => ({ y, v: 25 })),
    regions: [
      { name: 'Pyongyang',     pop: 3.1, ospi: 2.6, conf: 'low' },
      { name: 'South Hwanghae',pop: 2.3, ospi: 2.0, conf: 'low' },
      { name: 'North Hamgyong',pop: 2.4, ospi: 2.1, conf: 'low' },
    ],
  },
  {
    name: 'Ukraine', iso: '804', lat: 49, lng: 31,
    official: 44, ospi: 36, conf: 'low',
    urbanPct: 70, growthRate: -1.4, densityKm2: 60, gdpPerCapita: 3984, region: 'Eastern Europe',
    signals: { telecom: 58, electricity: 41, building: 48, mobility: 35, internet: 62 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 42 - i * 1 })),
    regions: [
      { name: 'Kyiv Oblast',   pop: 4.7, ospi: 4.1, conf: 'med' },
      { name: 'Kharkiv',       pop: 2.6, ospi: 2.0, conf: 'low' },
      { name: 'Donetsk',       pop: 4.1, ospi: 2.4, conf: 'low' },
      { name: 'Lviv',          pop: 2.5, ospi: 2.3, conf: 'med' },
    ],
  },
  {
    name: 'Japan', iso: '392', lat: 36, lng: 138,
    official: 125, ospi: 123, conf: 'high',
    urbanPct: 91, growthRate: -0.5, densityKm2: 334, gdpPerCapita: 33815, region: 'East Asia',
    signals: { telecom: 97, electricity: 95, building: 91, mobility: 90, internet: 95 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: Math.round(126 - i * 0.5) })),
    regions: [
      { name: 'Kanto',         pop: 43,  ospi: 43,  conf: 'high' },
      { name: 'Kinki',         pop: 22,  ospi: 21,  conf: 'high' },
      { name: 'Chubu',         pop: 17,  ospi: 17,  conf: 'high' },
      { name: 'Kyushu',        pop: 13,  ospi: 12,  conf: 'high' },
    ],
  },
  {
    name: 'DR Congo', iso: '180', lat: -3, lng: 24,
    official: 102, ospi: 119, conf: 'low',
    urbanPct: 46, growthRate: 3.1, densityKm2: 43, gdpPerCapita: 556, region: 'Central Africa',
    signals: { telecom: 48, electricity: 21, building: 37, mobility: 28, internet: 14 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 86 + i * 5 })),
    regions: [
      { name: 'Kinshasa',      pop: 15,  ospi: 18,  conf: 'low' },
      { name: 'Kivu',          pop: 12,  ospi: 15,  conf: 'low' },
      { name: 'Katanga',       pop: 14,  ospi: 17,  conf: 'low' },
      { name: 'Kasai',         pop: 9,   ospi: 11,  conf: 'low' },
    ],
  },
]