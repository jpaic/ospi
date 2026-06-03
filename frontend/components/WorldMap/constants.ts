// ISO 3166-1 numeric IDs used by world-atlas countries-110m.json
export const NAME_TO_ISO: Record<string, number> = {
  'afghanistan': 4, 'albania': 8, 'algeria': 12, 'andorra': 20,
  'angola': 24, 'antigua and barbuda': 28, 'argentina': 32, 'armenia': 51,
  'australia': 36, 'austria': 40, 'azerbaijan': 31,
  'bahamas': 44, 'bahrain': 48, 'bangladesh': 50, 'barbados': 52,
  'belarus': 112, 'belgium': 56, 'belize': 84, 'benin': 204, 'bhutan': 64,
  'bolivia': 68, 'bolivia (plurinational state of)': 68,
  'bosnia and herzegovina': 70, 'botswana': 72, 'brazil': 76,
  'brunei': 96, 'brunei darussalam': 96, 'bulgaria': 100,
  'burkina faso': 854, 'burundi': 108,
  'cabo verde': 132, 'cambodia': 116, 'cameroon': 120, 'canada': 124,
  'central african republic': 140, 'chad': 148, 'chile': 152, 'china': 156,
  'colombia': 170, 'comoros': 174, 'congo': 178,
  'congo (democratic republic of the)': 180,
  'democratic republic of the congo': 180,
  'costa rica': 188, "côte d'ivoire": 384, 'croatia': 191, 'cuba': 192,
  'cyprus': 196, 'czech republic': 203,
  'denmark': 208, 'djibouti': 262, 'dominica': 212,
  'dominican republic': 214,
  'ecuador': 218, 'egypt': 818, 'el salvador': 222,
  'equatorial guinea': 226, 'eritrea': 232, 'estonia': 233,
  'eswatini': 748, 'ethiopia': 231,
  'fiji': 242, 'finland': 246, 'france': 250,
  'gabon': 266, 'gambia': 270, 'georgia': 268, 'germany': 276, 'ghana': 288,
  'greece': 300, 'grenada': 308, 'guatemala': 320, 'guinea': 324,
  'guinea-bissau': 624, 'guyana': 328,
  'haiti': 332, 'honduras': 340, 'hungary': 348,
  'iceland': 352, 'india': 356, 'indonesia': 360, 'iran': 364, 'iraq': 368,
  'ireland': 372, 'israel': 376, 'italy': 380,
  'jamaica': 388, 'japan': 392, 'jordan': 400,
  'kazakhstan': 398, 'kenya': 404, 'kiribati': 296,
  'kuwait': 414, 'kyrgyzstan': 417,
  'laos': 418, 'latvia': 428, 'lebanon': 422, 'lesotho': 426, 'liberia': 430,
  'libya': 434, 'liechtenstein': 438, 'lithuania': 440, 'luxembourg': 442,
  'madagascar': 450, 'malawi': 454, 'malaysia': 458, 'maldives': 462,
  'mali': 466, 'malta': 470, 'marshall islands': 584, 'mauritania': 478,
  'mauritius': 480, 'mexico': 484, 'micronesia': 583, 'moldova': 498,
  'monaco': 492, 'mongolia': 496, 'montenegro': 499, 'morocco': 504,
  'mozambique': 508, 'myanmar': 104,
  'namibia': 516, 'nauru': 520, 'nepal': 524, 'netherlands': 528,
  'new zealand': 554, 'nicaragua': 558, 'niger': 562, 'nigeria': 566,
  'north korea': 408, 'north macedonia': 807, 'norway': 578,
  'oman': 512,
  'pakistan': 586, 'palau': 585, 'palestine': 275, 'panama': 591,
  'papua new guinea': 598, 'paraguay': 600, 'peru': 604, 'philippines': 608,
  'poland': 616, 'portugal': 620,
  'qatar': 634,
  'romania': 642, 'russia': 643, 'rwanda': 646,
  'saint kitts and nevis': 659, 'saint lucia': 662,
  'saint vincent and the grenadines': 670, 'samoa': 882,
  'san marino': 674, 'sao tome and principe': 678, 'saudi arabia': 682,
  'senegal': 686, 'serbia': 688, 'seychelles': 690, 'sierra leone': 694,
  'singapore': 702, 'slovakia': 703, 'slovenia': 705, 'solomon islands': 90,
  'somalia': 706, 'south africa': 710, 'south korea': 410,
  'south sudan': 728, 'spain': 724, 'sri lanka': 144, 'sudan': 729,
  'suriname': 740, 'sweden': 752, 'switzerland': 756, 'syria': 760,
  'taiwan': 158, 'tajikistan': 762, 'tanzania': 834, 'thailand': 764,
  'timor-leste': 626, 'togo': 768, 'tonga': 776,
  'trinidad and tobago': 780, 'tunisia': 788, 'turkey': 792,
  'turkmenistan': 795, 'tuvalu': 798,
  'uganda': 800, 'ukraine': 804, 'united arab emirates': 784,
  'united kingdom': 826, 'united states': 840, 'uruguay': 858,
  'uzbekistan': 860,
  'vanuatu': 548, 'vatican city': 336, 'venezuela': 862, 'vietnam': 704,
  'yemen': 887,
  'zambia': 894, 'zimbabwe': 716,
}

export function nameToIso(name: string): number | null {
  const lower = name.toLowerCase().trim()
  if (NAME_TO_ISO[lower] != null) return NAME_TO_ISO[lower]
  for (const [k, v] of Object.entries(NAME_TO_ISO)) {
    if (lower.includes(k) || k.includes(lower)) return v
  }
  return null
}

export function normalizeRotDelta(delta: number): number {
  let d = delta % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}
