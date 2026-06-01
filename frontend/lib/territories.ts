'use client'

/**
 * ISO2 codes for non-sovereign territories in the dataset.
 * These are dependencies, overseas territories, or special administrative
 * regions that lack full UN sovereignty.
 */
export const TERRITORY_ISO2 = new Set([
  'AS', // American Samoa        (US)
  'AW', // Aruba                 (Netherlands)
  'BM', // Bermuda               (UK)
  'VG', // British Virgin Islands (UK)
  'KY', // Cayman Islands        (UK)
  'CW', // Curaçao               (Netherlands)
  'FO', // Faroe Islands         (Denmark)
  'PF', // French Polynesia      (France)
  'GI', // Gibraltar             (UK)
  'GL', // Greenland             (Denmark)
  'GU', // Guam                  (US)
  'HK', // Hong Kong             (China SAR)
  'IM', // Isle of Man           (UK Crown Dependency)
  'MO', // Macao                 (China SAR)
  'MP', // Northern Mariana Islands (US)
  'NC', // New Caledonia         (France)
  'PR', // Puerto Rico           (US)
  'MF', // Saint Martin (French) (France)
  'SX', // Sint Maarten          (Netherlands)
  'TC', // Turks and Caicos      (UK)
  'VI', // US Virgin Islands     (US)
])
