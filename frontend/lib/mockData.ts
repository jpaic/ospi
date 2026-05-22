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
// Mock country list removed — app now uses UN data and backend signals only.

  {
    name: 'South Korea', iso: '410', lat: 36, lng: 128,
    official: 52, ospi: 51, conf: 'high',
    urbanPct: 82, growthRate: 0.1, densityKm2: 527, gdpPerCapita: 34998, region: 'East Asia',
    signals: { telecom: 98, electricity: 97, building: 94, mobility: 93, internet: 98 },
    history: [2018,2019,2020,2021,2022,2023].map((y) => ({ y, v: 52 })),
    regions: [
      { name: 'Seoul',         pop: 9.4, ospi: 9.3, conf: 'high' },
      { name: 'Gyeonggi',      pop: 13.6, ospi: 13.5, conf: 'high' },
      { name: 'Busan',         pop: 3.3, ospi: 3.2, conf: 'high' },
      { name: 'Incheon',       pop: 3.0, ospi: 3.0, conf: 'high' },
    ],
  },
  {
    name: 'Spain', iso: '724', lat: 40, lng: -4,
    official: 48, ospi: 47, conf: 'high',
    urbanPct: 81, growthRate: 0.2, densityKm2: 96, gdpPerCapita: 32489, region: 'Southern Europe',
    signals: { telecom: 95, electricity: 94, building: 90, mobility: 89, internet: 94 },
    history: [2018,2019,2020,2021,2022,2023].map((y) => ({ y, v: 47 })),
    regions: [
      { name: 'Andalusia',     pop: 8.5, ospi: 8.4, conf: 'high' },
      { name: 'Catalonia',     pop: 7.8, ospi: 7.7, conf: 'high' },
      { name: 'Madrid',        pop: 6.8, ospi: 6.8, conf: 'high' },
      { name: 'Valencia',      pop: 5.1, ospi: 5.0, conf: 'high' },
    ],
  },
  {
    name: 'Canada', iso: '124', lat: 56, lng: -106,
    official: 40, ospi: 40, conf: 'high',
    urbanPct: 82, growthRate: 0.9, densityKm2: 4, gdpPerCapita: 53431, region: 'North America',
    signals: { telecom: 97, electricity: 97, building: 93, mobility: 92, internet: 97 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 37 + i })),
    regions: [
      { name: 'Ontario',       pop: 15,  ospi: 15,  conf: 'high' },
      { name: 'Quebec',        pop: 8.8, ospi: 8.7, conf: 'high' },
      { name: 'British Columbia', pop: 5.4, ospi: 5.3, conf: 'high' },
      { name: 'Alberta',       pop: 4.7, ospi: 4.6, conf: 'high' },
    ],
  },
  {
    name: 'Australia', iso: '036', lat: -25, lng: 133,
    official: 26, ospi: 26, conf: 'high',
    urbanPct: 86, growthRate: 1.0, densityKm2: 3, gdpPerCapita: 65099, region: 'Oceania',
    signals: { telecom: 97, electricity: 98, building: 94, mobility: 93, internet: 97 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 25 + i * 0.2 })),
    regions: [
      { name: 'New South Wales', pop: 8.3, ospi: 8.2, conf: 'high' },
      { name: 'Victoria',       pop: 6.7, ospi: 6.6, conf: 'high' },
      { name: 'Queensland',     pop: 5.4, ospi: 5.3, conf: 'high' },
      { name: 'Western Australia', pop: 2.9, ospi: 2.8, conf: 'high' },
    ],
  },
  {
    name: 'Mexico', iso: '484', lat: 23, lng: -102,
    official: 129, ospi: 127, conf: 'high',
    urbanPct: 81, growthRate: 0.8, densityKm2: 66, gdpPerCapita: 13426, region: 'North America',
    signals: { telecom: 87, electricity: 84, building: 79, mobility: 78, internet: 76 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 124 + i })),
    regions: [
      { name: 'Mexico State', pop: 17, ospi: 17, conf: 'high' },
      { name: 'Mexico City', pop: 9.2, ospi: 9.1, conf: 'high' },
      { name: 'Jalisco', pop: 8.5, ospi: 8.3, conf: 'high' },
      { name: 'Veracruz', pop: 8.1, ospi: 8.0, conf: 'med' },
    ],
  },
  {
    name: 'Philippines', iso: '608', lat: 13, lng: 122,
    official: 117, ospi: 121, conf: 'med',
    urbanPct: 48, growthRate: 1.3, densityKm2: 394, gdpPerCapita: 3950, region: 'Southeast Asia',
    signals: { telecom: 74, electricity: 67, building: 65, mobility: 63, internet: 58 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 108 + i * 2 })),
    regions: [
      { name: 'Luzon', pop: 64, ospi: 67, conf: 'med' },
      { name: 'Visayas', pop: 21, ospi: 22, conf: 'med' },
      { name: 'Mindanao', pop: 27, ospi: 29, conf: 'low' },
    ],
  },
  {
    name: 'Vietnam', iso: '704', lat: 16, lng: 108,
    official: 100, ospi: 101, conf: 'high',
    urbanPct: 39, growthRate: 0.8, densityKm2: 323, gdpPerCapita: 4282, region: 'Southeast Asia',
    signals: { telecom: 85, electricity: 81, building: 74, mobility: 72, internet: 73 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 95 + i })),
    regions: [
      { name: 'Ho Chi Minh City', pop: 9.3, ospi: 9.5, conf: 'high' },
      { name: 'Hanoi', pop: 8.5, ospi: 8.6, conf: 'high' },
      { name: 'Red River Delta', pop: 23, ospi: 23, conf: 'med' },
      { name: 'Mekong Delta', pop: 17, ospi: 17, conf: 'med' },
    ],
  },
  {
    name: 'Egypt', iso: '818', lat: 26, lng: 30,
    official: 112, ospi: 118, conf: 'med',
    urbanPct: 43, growthRate: 1.7, densityKm2: 112, gdpPerCapita: 3547, region: 'North Africa',
    signals: { telecom: 77, electricity: 72, building: 69, mobility: 66, internet: 61 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 99 + i * 2 })),
    regions: [
      { name: 'Cairo', pop: 22, ospi: 24, conf: 'med' },
      { name: 'Alexandria', pop: 5.6, ospi: 5.8, conf: 'med' },
      { name: 'Giza', pop: 9.5, ospi: 10, conf: 'med' },
      { name: 'Upper Egypt', pop: 38, ospi: 40, conf: 'low' },
    ],
  },
  {
    name: 'Turkey', iso: '792', lat: 39, lng: 35,
    official: 86, ospi: 85, conf: 'high',
    urbanPct: 77, growthRate: 0.7, densityKm2: 110, gdpPerCapita: 13110, region: 'Middle East',
    signals: { telecom: 89, electricity: 85, building: 82, mobility: 79, internet: 78 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 82 + i })),
    regions: [
      { name: 'Istanbul', pop: 16, ospi: 16, conf: 'high' },
      { name: 'Ankara', pop: 5.8, ospi: 5.7, conf: 'high' },
      { name: 'Izmir', pop: 4.5, ospi: 4.5, conf: 'high' },
      { name: 'Southeast Anatolia', pop: 9, ospi: 9.5, conf: 'med' },
    ],
  },
  {
    name: 'Iran', iso: '364', lat: 32, lng: 53,
    official: 89, ospi: 87, conf: 'med',
    urbanPct: 76, growthRate: 0.9, densityKm2: 55, gdpPerCapita: 4635, region: 'Middle East',
    signals: { telecom: 81, electricity: 74, building: 71, mobility: 69, internet: 67 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 82 + i })),
    regions: [
      { name: 'Tehran', pop: 14, ospi: 14, conf: 'high' },
      { name: 'Isfahan', pop: 5.4, ospi: 5.3, conf: 'med' },
      { name: 'Fars', pop: 5.1, ospi: 5.0, conf: 'med' },
      { name: 'Khorasan', pop: 8.2, ospi: 8.0, conf: 'med' },
    ],
  },
  {
    name: 'Thailand', iso: '764', lat: 15, lng: 101,
    official: 71, ospi: 70, conf: 'high',
    urbanPct: 53, growthRate: 0.2, densityKm2: 139, gdpPerCapita: 7808, region: 'Southeast Asia',
    signals: { telecom: 90, electricity: 86, building: 80, mobility: 79, internet: 81 },
    history: [2018,2019,2020,2021,2022,2023].map((y) => ({ y, v: 70 })),
    regions: [
      { name: 'Bangkok', pop: 11, ospi: 11, conf: 'high' },
      { name: 'Chiang Mai', pop: 1.8, ospi: 1.8, conf: 'high' },
      { name: 'Isan', pop: 22, ospi: 22, conf: 'med' },
      { name: 'Southern Thailand', pop: 9, ospi: 9, conf: 'med' },
    ],
  },
  {
    name: 'France', iso: '250', lat: 46, lng: 2,
    official: 68, ospi: 67, conf: 'high',
    urbanPct: 81, growthRate: 0.2, densityKm2: 123, gdpPerCapita: 44408, region: 'Western Europe',
    signals: { telecom: 97, electricity: 96, building: 92, mobility: 91, internet: 95 },
    history: [2018,2019,2020,2021,2022,2023].map((y) => ({ y, v: 67 })),
    regions: [
      { name: 'Île-de-France', pop: 12, ospi: 12, conf: 'high' },
      { name: 'Auvergne-Rhône-Alpes', pop: 8.1, ospi: 8.0, conf: 'high' },
      { name: 'Provence-Alpes-Côte d’Azur', pop: 5.1, ospi: 5.0, conf: 'high' },
      { name: 'Nouvelle-Aquitaine', pop: 6.1, ospi: 6.0, conf: 'high' },
    ],
  },
  {
    name: 'Tanzania', iso: '834', lat: -6, lng: 35,
    official: 67, ospi: 72, conf: 'low',
    urbanPct: 38, growthRate: 2.9, densityKm2: 67, gdpPerCapita: 1142, region: 'East Africa',
    signals: { telecom: 62, electricity: 33, building: 46, mobility: 41, internet: 28 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 55 + i * 2 })),
    regions: [
      { name: 'Dar es Salaam', pop: 6.8, ospi: 7.2, conf: 'low' },
      { name: 'Mwanza', pop: 3.5, ospi: 3.7, conf: 'low' },
      { name: 'Dodoma', pop: 2.1, ospi: 2.2, conf: 'low' },
      { name: 'Arusha', pop: 2.0, ospi: 2.1, conf: 'low' },
    ],
  },
  {
    name: 'South Africa', iso: '710', lat: -30, lng: 25,
    official: 60, ospi: 59, conf: 'high',
    urbanPct: 68, growthRate: 0.9, densityKm2: 49, gdpPerCapita: 6776, region: 'Southern Africa',
    signals: { telecom: 85, electricity: 76, building: 72, mobility: 70, internet: 74 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 58 + i * 0.2 })),
    regions: [
      { name: 'Gauteng', pop: 15, ospi: 14.8, conf: 'high' },
      { name: 'KwaZulu-Natal', pop: 11, ospi: 10.9, conf: 'high' },
      { name: 'Western Cape', pop: 7, ospi: 6.9, conf: 'high' },
      { name: 'Eastern Cape', pop: 7.2, ospi: 7.0, conf: 'med' },
    ],
  },
  {
    name: 'Colombia', iso: '170', lat: 4, lng: -74,
    official: 52, ospi: 53, conf: 'high',
    urbanPct: 81, growthRate: 0.8, densityKm2: 46, gdpPerCapita: 6624, region: 'South America',
    signals: { telecom: 83, electricity: 79, building: 75, mobility: 73, internet: 72 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 50 + i * 0.4 })),
    regions: [
      { name: 'Bogotá', pop: 8.0, ospi: 7.9, conf: 'high' },
      { name: 'Antioquia', pop: 6.6, ospi: 6.5, conf: 'high' },
      { name: 'Valle del Cauca', pop: 4.5, ospi: 4.4, conf: 'high' },
      { name: 'Cundinamarca', pop: 3.0, ospi: 2.9, conf: 'med' },
    ],
  },
  {
    name: 'Kenya', iso: '404', lat: 1, lng: 38,
    official: 54, ospi: 57, conf: 'med',
    urbanPct: 31, growthRate: 2.3, densityKm2: 94, gdpPerCapita: 2081, region: 'East Africa',
    signals: { telecom: 78, electricity: 45, building: 55, mobility: 52, internet: 48 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 48 + i * 1.5 })),
    regions: [
      { name: 'Nairobi', pop: 4.5, ospi: 4.7, conf: 'high' },
      { name: 'Mombasa', pop: 1.2, ospi: 1.3, conf: 'med' },
      { name: 'Kisumu', pop: 1.1, ospi: 1.2, conf: 'med' },
      { name: 'Rift Valley', pop: 10, ospi: 10.5, conf: 'low' },
    ],
  },
  {
    name: 'Argentina', iso: '032', lat: -34, lng: -64,
    official: 46, ospi: 45, conf: 'high',
    urbanPct: 92, growthRate: 0.3, densityKm2: 17, gdpPerCapita: 13650, region: 'South America',
    signals: { telecom: 90, electricity: 88, building: 84, mobility: 82, internet: 86 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 44 + i * 0.2 })),
    regions: [
      { name: 'Buenos Aires', pop: 17, ospi: 16.8, conf: 'high' },
      { name: 'Córdoba', pop: 3.7, ospi: 3.6, conf: 'high' },
      { name: 'Santa Fe', pop: 3.5, ospi: 3.4, conf: 'high' },
      { name: 'Mendoza', pop: 2.0, ospi: 1.9, conf: 'med' },
    ],
  },
  {
    name: 'Myanmar', iso: '104', lat: 21, lng: 96,
    official: 55, ospi: 57, conf: 'low',
    urbanPct: 31, growthRate: 0.7, densityKm2: 83, gdpPerCapita: 1200, region: 'Southeast Asia',
    signals: { telecom: 60, electricity: 45, building: 52, mobility: 48, internet: 40 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 53 + i * 1 })),
    regions: [
      { name: 'Yangon', pop: 7.3, ospi: 7.5, conf: 'low' },
      { name: 'Mandalay', pop: 2.0, ospi: 2.1, conf: 'low' },
      { name: 'Ayeyarwady', pop: 6.2, ospi: 6.4, conf: 'low' },
      { name: 'Shan State', pop: 5.8, ospi: 6.0, conf: 'low' },
    ],
  },
  {
    name: 'Malaysia', iso: '458', lat: 4, lng: 102,
    official: 34, ospi: 35, conf: 'high',
    urbanPct: 77, growthRate: 1.0, densityKm2: 99, gdpPerCapita: 11414, region: 'Southeast Asia',
    signals: { telecom: 92, electricity: 88, building: 85, mobility: 83, internet: 87 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 32 + i * 0.3 })),
    regions: [
      { name: 'Selangor', pop: 6.7, ospi: 6.6, conf: 'high' },
      { name: 'Johor', pop: 4.0, ospi: 3.9, conf: 'high' },
      { name: 'Sabah', pop: 3.9, ospi: 4.0, conf: 'med' },
      { name: 'Sarawak', pop: 2.8, ospi: 2.9, conf: 'med' },
    ],
  },
  {
    name: 'Peru', iso: '604', lat: -10, lng: -76,
    official: 34, ospi: 33, conf: 'high',
    urbanPct: 79, growthRate: 1.0, densityKm2: 26, gdpPerCapita: 7177, region: 'South America',
    signals: { telecom: 82, electricity: 78, building: 74, mobility: 72, internet: 70 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 32 + i * 0.3 })),
    regions: [
      { name: 'Lima', pop: 11, ospi: 10.8, conf: 'high' },
      { name: 'Arequipa', pop: 1.5, ospi: 1.4, conf: 'med' },
      { name: 'La Libertad', pop: 2.1, ospi: 2.0, conf: 'med' },
      { name: 'Piura', pop: 2.0, ospi: 1.9, conf: 'med' },
    ],
  },
  {
    name: 'Venezuela', iso: '862', lat: 7, lng: -66,
    official: 28, ospi: 27, conf: 'low',
    urbanPct: 88, growthRate: -0.3, densityKm2: 32, gdpPerCapita: 3673, region: 'South America',
    signals: { telecom: 70, electricity: 55, building: 60, mobility: 58, internet: 50 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 30 - i * 0.4 })),
    regions: [
      { name: 'Caracas', pop: 3.0, ospi: 2.9, conf: 'low' },
      { name: 'Zulia', pop: 4.0, ospi: 3.8, conf: 'low' },
      { name: 'Carabobo', pop: 2.5, ospi: 2.4, conf: 'low' },
      { name: 'Lara', pop: 1.8, ospi: 1.7, conf: 'low' },
    ],
  },
  {
    name: 'Nepal', iso: '524', lat: 28, lng: 84,
    official: 30, ospi: 31, conf: 'med',
    urbanPct: 22, growthRate: 1.2, densityKm2: 203, gdpPerCapita: 1300, region: 'South Asia',
    signals: { telecom: 65, electricity: 50, building: 55, mobility: 52, internet: 45 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 28 + i * 0.5 })),
    regions: [
      { name: 'Bagmati', pop: 6.0, ospi: 6.2, conf: 'med' },
      { name: 'Gandaki', pop: 2.4, ospi: 2.5, conf: 'med' },
      { name: 'Lumbini', pop: 5.1, ospi: 5.2, conf: 'low' },
      { name: 'Karnali', pop: 1.6, ospi: 1.7, conf: 'low' },
    ],
  },
  {
    name: 'Angola', iso: '024', lat: -12, lng: 18,
    official: 36, ospi: 38, conf: 'low',
    urbanPct: 68, growthRate: 3.0, densityKm2: 26, gdpPerCapita: 2200, region: 'Central Africa',
    signals: { telecom: 65, electricity: 40, building: 52, mobility: 48, internet: 35 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 30 + i * 2 })),
    regions: [
      { name: 'Luanda', pop: 9, ospi: 9.5, conf: 'med' },
      { name: 'Huambo', pop: 2.0, ospi: 2.1, conf: 'low' },
      { name: 'Benguela', pop: 1.8, ospi: 1.9, conf: 'low' },
      { name: 'Lubango', pop: 1.2, ospi: 1.3, conf: 'low' },
    ],
  },
  {
    name: 'Mozambique', iso: '508', lat: -18, lng: 35,
    official: 33, ospi: 35, conf: 'low',
    urbanPct: 38, growthRate: 2.7, densityKm2: 42, gdpPerCapita: 600, region: 'East Africa',
    signals: { telecom: 58, electricity: 28, building: 45, mobility: 40, internet: 25 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 28 + i * 2 })),
    regions: [
      { name: 'Maputo', pop: 3.0, ospi: 3.2, conf: 'low' },
      { name: 'Nampula', pop: 5.0, ospi: 5.3, conf: 'low' },
      { name: 'Sofala', pop: 2.3, ospi: 2.4, conf: 'low' },
      { name: 'Zambezia', pop: 5.5, ospi: 5.8, conf: 'low' },
    ],
  },
  {
    name: 'Ghana', iso: '288', lat: 7, lng: -1,
    official: 33, ospi: 34, conf: 'med',
    urbanPct: 57, growthRate: 2.1, densityKm2: 137, gdpPerCapita: 2450, region: 'West Africa',
    signals: { telecom: 75, electricity: 60, building: 62, mobility: 58, internet: 55 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 31 + i * 1 })),
    regions: [
      { name: 'Greater Accra', pop: 5.4, ospi: 5.5, conf: 'med' },
      { name: 'Ashanti', pop: 5.0, ospi: 5.1, conf: 'med' },
      { name: 'Northern', pop: 3.0, ospi: 3.1, conf: 'low' },
      { name: 'Western', pop: 2.0, ospi: 2.1, conf: 'low' },
    ],
  },
  {
    name: 'Yemen', iso: '887', lat: 15, lng: 48,
    official: 34, ospi: 36, conf: 'low',
    urbanPct: 38, growthRate: 2.4, densityKm2: 64, gdpPerCapita: 650, region: 'Middle East',
    signals: { telecom: 45, electricity: 20, building: 35, mobility: 30, internet: 18 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 27 + i * 1 })),
    regions: [
      { name: 'Sana’a', pop: 3.0, ospi: 3.2, conf: 'low' },
      { name: 'Aden', pop: 1.0, ospi: 1.1, conf: 'low' },
      { name: 'Taiz', pop: 2.5, ospi: 2.6, conf: 'low' },
      { name: 'Hadhramaut', pop: 1.5, ospi: 1.6, conf: 'low' },
    ],
  },
  {
    name: 'Madagascar', iso: '450', lat: -20, lng: 47,
    official: 30, ospi: 32, conf: 'low',
    urbanPct: 39, growthRate: 2.6, densityKm2: 48, gdpPerCapita: 500, region: 'East Africa',
    signals: { telecom: 55, electricity: 25, building: 40, mobility: 38, internet: 20 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 25 + i * 1 })),
    regions: [
      { name: 'Antananarivo', pop: 3.5, ospi: 3.7, conf: 'low' },
      { name: 'Toamasina', pop: 1.8, ospi: 1.9, conf: 'low' },
      { name: 'Fianarantsoa', pop: 1.6, ospi: 1.7, conf: 'low' },
      { name: 'Mahajanga', pop: 1.2, ospi: 1.3, conf: 'low' },
    ],
  },
  {
    name: 'Cameroon', iso: '120', lat: 6, lng: 12,
    official: 28, ospi: 29, conf: 'low',
    urbanPct: 57, growthRate: 2.4, densityKm2: 56, gdpPerCapita: 1700, region: 'Central Africa',
    signals: { telecom: 60, electricity: 35, building: 48, mobility: 44, internet: 30 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 26 + i * 1 })),
    regions: [
      { name: 'Littoral', pop: 4.5, ospi: 4.7, conf: 'low' },
      { name: 'Centre', pop: 4.0, ospi: 4.2, conf: 'low' },
      { name: 'North', pop: 3.5, ospi: 3.7, conf: 'low' },
      { name: 'Southwest', pop: 2.5, ospi: 2.6, conf: 'low' },
    ],
  },
  {
    name: 'Ivory Coast', iso: '384', lat: 7, lng: -5,
    official: 28, ospi: 30, conf: 'low',
    urbanPct: 52, growthRate: 2.3, densityKm2: 83, gdpPerCapita: 2600, region: 'West Africa',
    signals: { telecom: 70, electricity: 55, building: 58, mobility: 54, internet: 50 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 27 + i * 1 })),
    regions: [
      { name: 'Abidjan', pop: 5.0, ospi: 5.2, conf: 'low' },
      { name: 'Bouaké', pop: 1.5, ospi: 1.6, conf: 'low' },
      { name: 'Daloa', pop: 1.2, ospi: 1.3, conf: 'low' },
      { name: 'San-Pédro', pop: 1.0, ospi: 1.1, conf: 'low' },
    ],
  },
  {
    name: 'Niger', iso: '562', lat: 17, lng: 9,
    official: 27, ospi: 29, conf: 'low',
    urbanPct: 17, growthRate: 3.7, densityKm2: 19, gdpPerCapita: 550, region: 'West Africa',
    signals: { telecom: 48, electricity: 15, building: 30, mobility: 28, internet: 12 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 20 + i * 1 })),
    regions: [
      { name: 'Niamey', pop: 1.5, ospi: 1.6, conf: 'low' },
      { name: 'Zinder', pop: 1.7, ospi: 1.8, conf: 'low' },
      { name: 'Maradi', pop: 1.6, ospi: 1.7, conf: 'low' },
      { name: 'Agadez', pop: 0.7, ospi: 0.8, conf: 'low' },
    ],
  },
  {
    name: 'Sri Lanka', iso: '144', lat: 7, lng: 81,
    official: 22, ospi: 21, conf: 'med',
    urbanPct: 19, growthRate: 0.3, densityKm2: 341, gdpPerCapita: 3680, region: 'South Asia',
    signals: { telecom: 82, electricity: 78, building: 70, mobility: 68, internet: 65 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 21 - i * 0.1 })),
    regions: [
      { name: 'Western Province', pop: 6.0, ospi: 5.9, conf: 'med' },
      { name: 'Central Province', pop: 2.5, ospi: 2.4, conf: 'med' },
      { name: 'Southern Province', pop: 2.4, ospi: 2.3, conf: 'med' },
      { name: 'Northern Province', pop: 1.3, ospi: 1.2, conf: 'low' },
    ],
  },
  {
    name: 'Syria', iso: '760', lat: 35, lng: 38,
    official: 22, ospi: 20, conf: 'low',
    urbanPct: 55, growthRate: -0.5, densityKm2: 95, gdpPerCapita: 900, region: 'Middle East',
    signals: { telecom: 50, electricity: 30, building: 40, mobility: 35, internet: 25 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 23 - i * 0.3 })),
    regions: [
      { name: 'Damascus', pop: 2.0, ospi: 1.9, conf: 'low' },
      { name: 'Aleppo', pop: 2.5, ospi: 2.4, conf: 'low' },
      { name: 'Homs', pop: 1.5, ospi: 1.4, conf: 'low' },
      { name: 'Latakia', pop: 1.0, ospi: 0.9, conf: 'low' },
    ],
  },
  {
    name: 'Cuba', iso: '192', lat: 21, lng: -80,
    official: 11, ospi: 11, conf: 'med',
    urbanPct: 78, growthRate: -0.2, densityKm2: 103, gdpPerCapita: 9450, region: 'Caribbean',
    signals: { telecom: 60, electricity: 70, building: 65, mobility: 62, internet: 55 },
    history: [2018,2019,2020,2021,2022,2023].map((y,i) => ({ y, v: 11 - i * 0.05 })),
    regions: [
      { name: 'Havana', pop: 2.1, ospi: 2.0, conf: 'med' },
      { name: 'Santiago de Cuba', pop: 1.0, ospi: 0.9, conf: 'med' },
      { name: 'Camagüey', pop: 0.8, ospi: 0.7, conf: 'med' },
      { name: 'Holguín', pop: 0.9, ospi: 0.8, conf: 'med' },
    ],
  },
]