'use client'

import { useEffect, useRef } from 'react'
import type { Country } from '@/lib/types'

interface Props {
  countries: Country[]
  selected: Country | null
  onSelect: (c: Country) => void
  resetKey?: number
}

// ISO 3166-1 numeric IDs used by world-atlas countries-110m.json
const NAME_TO_ISO: Record<string, number> = {
  // A
  'afghanistan': 4,
  'albania': 8,
  'algeria': 12,
  'andorra': 20,
  'angola': 24,
  'antigua and barbuda': 28,
  'argentina': 32,
  'armenia': 51,
  'australia': 36,
  'austria': 40,
  'azerbaijan': 31,
  // B
  'bahamas': 44,
  'bahrain': 48,
  'bangladesh': 50,
  'barbados': 52,
  'belarus': 112,
  'belgium': 56,
  'belize': 84,
  'benin': 204,
  'bhutan': 64,
  'bolivia': 68,
  'bolivia (plurinational state of)': 68,
  'bosnia and herzegovina': 70,
  'botswana': 72,
  'brazil': 76,
  'brunei': 96,
  'brunei darussalam': 96,
  'bulgaria': 100,
  'burkina faso': 854,
  'burundi': 108,
  // C
  'cabo verde': 132,
  'cambodia': 116,
  'cameroon': 120,
  'canada': 124,
  'central african republic': 140,
  'chad': 148,
  'chile': 152,
  'china': 156,
  'colombia': 170,
  'comoros': 174,
  'congo': 178,
  'costa rica': 188,
  "côte d'ivoire": 384,
  'ivory coast': 384,
  'croatia': 191,
  'cuba': 192,
  'cyprus': 196,
  'czech republic': 203,
  'czechia': 203,
  // D
  "dem. people's rep. of korea": 408,
  'democratic republic of the congo': 180,
  'denmark': 208,
  'djibouti': 262,
  'dominica': 212,
  'dominican republic': 214,
  // E
  'ecuador': 218,
  'egypt': 818,
  'el salvador': 222,
  'equatorial guinea': 226,
  'eritrea': 232,
  'estonia': 233,
  'eswatini': 748,
  'ethiopia': 231,
  // F
  'fiji': 242,
  'finland': 246,
  'france': 250,
  // G
  'gabon': 266,
  'gambia': 270,
  'georgia': 268,
  'germany': 276,
  'ghana': 288,
  'greece': 300,
  'grenada': 308,
  'guatemala': 320,
  'guinea': 324,
  'guinea-bissau': 624,
  'guyana': 328,
  // H
  'haiti': 332,
  'honduras': 340,
  'hungary': 348,
  // I
  'iceland': 352,
  'india': 356,
  'indonesia': 360,
  'iran': 364,
  'iran (islamic republic of)': 364,
  'iraq': 368,
  'ireland': 372,
  'israel': 376,
  'italy': 380,
  // J
  'jamaica': 388,
  'japan': 392,
  'jordan': 400,
  // K
  'kazakhstan': 398,
  'kenya': 404,
  'kiribati': 296,
  'kosovo': 383,
  'kosovo (under unsc res. 1244)': 383,
  'kuwait': 414,
  'kyrgyzstan': 417,
  // L
  'laos': 418,
  "lao people's democratic republic": 418,
  'latvia': 428,
  'lebanon': 422,
  'lesotho': 426,
  'liberia': 430,
  'libya': 434,
  'liechtenstein': 438,
  'lithuania': 440,
  'luxembourg': 442,
  // M
  'madagascar': 450,
  'malawi': 454,
  'malaysia': 458,
  'maldives': 462,
  'mali': 466,
  'malta': 470,
  'marshall islands': 584,
  'mauritania': 478,
  'mauritius': 480,
  'mexico': 484,
  'micronesia': 583,
  'moldova': 498,
  'republic of moldova': 498,
  'monaco': 492,
  'mongolia': 496,
  'montenegro': 499,
  'morocco': 504,
  'mozambique': 508,
  'myanmar': 104,
  // N
  'namibia': 516,
  'nauru': 520,
  'nepal': 524,
  'netherlands': 528,
  'new zealand': 554,
  'nicaragua': 558,
  'niger': 562,
  'nigeria': 566,
  'north korea': 408,
  'north macedonia': 807,
  'norway': 578,
  // O
  'oman': 512,
  // P
  'pakistan': 586,
  'palau': 585,
  'panama': 591,
  'papua new guinea': 598,
  'paraguay': 600,
  'peru': 604,
  'philippines': 608,
  'poland': 616,
  'portugal': 620,
  // Q
  'qatar': 634,
  // R
  'republic of korea': 410,
  'romania': 642,
  'russia': 643,
  'russian federation': 643,
  'rwanda': 646,
  // S
  'saint kitts and nevis': 659,
  'saint lucia': 662,
  'saint vincent and the grenadines': 670,
  'samoa': 882,
  'san marino': 674,
  'sao tome and principe': 678,
  'saudi arabia': 682,
  'senegal': 686,
  'serbia': 688,
  'seychelles': 690,
  'sierra leone': 694,
  'singapore': 702,
  'slovakia': 703,
  'slovenia': 705,
  'solomon islands': 90,
  'somalia': 706,
  'south africa': 710,
  'south korea': 410,
  'south sudan': 728,
  'spain': 724,
  'sri lanka': 144,
  'state of palestine': 275,
  'sudan': 729,
  'suriname': 740,
  'sweden': 752,
  'switzerland': 756,
  'syria': 760,
  'syrian arab republic': 760,
  // T
  'taiwan': 158,
  'china, taiwan province of china': 158,
  'tajikistan': 762,
  'tanzania': 834,
  'united republic of tanzania': 834,
  'thailand': 764,
  'timor-leste': 626,
  'togo': 768,
  'tonga': 776,
  'trinidad and tobago': 780,
  'tunisia': 788,
  'turkey': 792,
  'türkiye': 792,
  'turkmenistan': 795,
  'tuvalu': 798,
  // U
  'uganda': 800,
  'ukraine': 804,
  'united arab emirates': 784,
  'uae': 784,
  'united kingdom': 826,
  'uk': 826,
  'united states': 840,
  'usa': 840,
  'united states of america': 840,
  'uruguay': 858,
  'uzbekistan': 860,
  // V
  'vanuatu': 548,
  'venezuela': 862,
  'venezuela (bolivarian republic of)': 862,
  'vietnam': 704,
  'viet nam': 704,
  // Y
  'yemen': 887,
  // Z
  'zambia': 894,
  'zimbabwe': 716,
}

function nameToIso(name: string): number | null {
  const lower = name.toLowerCase().trim()
  if (NAME_TO_ISO[lower] != null) return NAME_TO_ISO[lower]
  // Partial match fallback
  for (const [k, v] of Object.entries(NAME_TO_ISO)) {
    if (lower.includes(k) || k.includes(lower)) return v
  }
  return null
}

// Normalize a rotation delta to [-180, 180] so animations always
// take the shortest arc around the globe.
function normalizeRotDelta(delta: number): number {
  let d = delta % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

export default function WorldMap({ countries, selected, onSelect, resetKey }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const projRef = useRef<any>(null)
  const pathGenRef = useRef<any>(null)
  const curKRef = useRef<number>(1)
  const curTyRef = useRef<number>(0)
  const curRotRef = useRef<number>(0)
  const initDoneRef = useRef(false)
  const selectedRef = useRef<Country | null>(selected)
  const countriesRef = useRef<Country[]>(countries)
  const onSelectRef = useRef(onSelect)
  const animFrameRef = useRef<number | null>(null)
  const mapGRef = useRef<SVGGElement | null>(null)
  const clampTyRef = useRef<(ty: number, k: number) => number>(() => 0)
  const sizeRef = useRef<{ W: number; H: number }>({ W: 320, H: 320 })
  const featurePathsRef = useRef<Map<number, SVGPathElement>>(new Map())

  selectedRef.current = selected
  countriesRef.current = countries
  onSelectRef.current = onSelect

  const drawMarkers = (proj: any, k = 1) => {
    const svg = svgRef.current
    if (!svg) return
    const layer = svg.querySelector('#marker-layer') as SVGGElement
    if (!layer) return
    layer.innerHTML = ''

    countriesRef.current.forEach(c => {
      const coords = proj([c.lng, c.lat])
      if (!coords) return
      const [x, y] = coords
      const baseR = Math.max(3, Math.min(9, c.ospi / 130))
      const normalR = baseR / k

      const col =
        c.conf === 'high'
          ? '#1D9E75'
          : c.conf === 'med'
            ? '#EF9F27'
            : '#E24B4A'

      const isSel = selectedRef.current?.name === c.name
      const hasSelection = !!selectedRef.current

      const effectiveR =
        isSel
          ? (baseR + 1.5) / k
          : hasSelection
            ? normalR * 0.55
            : normalR

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      g.style.cursor = 'pointer'
      g.addEventListener('click', e => { e.stopPropagation(); onSelectRef.current(c) })

      if (isSel) {
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        ring.setAttribute('cx', String(x))
        ring.setAttribute('cy', String(y))
        ring.setAttribute('r', String((baseR + 4) / k))
        ring.setAttribute('fill', 'none')
        ring.setAttribute('stroke', col)
        ring.setAttribute('stroke-width', String(1 / k))
        ring.setAttribute('stroke-opacity', '0.4')
        g.appendChild(ring)
      }

      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      dot.setAttribute('cx', String(x))
      dot.setAttribute('cy', String(y))
      dot.setAttribute('r', String(effectiveR))
      dot.setAttribute('fill', col)

      const opacity =
        isSel
          ? 1
          : hasSelection
            ? 0.2
            : 0.8

      dot.setAttribute('fill-opacity', String(opacity))
      dot.setAttribute(
        'stroke-opacity',
        isSel ? '1' : hasSelection ? '0.35' : '1'
      )
      dot.setAttribute('stroke', '#fff')
      dot.setAttribute('stroke-width', String(isSel ? 1.5 / k : 0.5 / k))

      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
      title.textContent = `${c.name}  ·  OSPI: ${c.ospi}M  ·  Official: ${c.official}M`
      dot.appendChild(title)

      g.appendChild(dot)
      layer.appendChild(g)
    })
  }

  const drawHighlight = (proj: any, sel: Country | null) => {
    const svg = svgRef.current
    if (!svg) return
    const layer = svg.querySelector('#highlight-layer') as SVGGElement | null
    if (!layer) return
    layer.innerHTML = ''
    if (!sel) return

    const isoId = nameToIso(sel.name)
    if (isoId == null) return

    const featurePath = featurePathsRef.current.get(isoId)
    if (!featurePath) return
    const feature = (featurePath as any).__feature__
    if (!feature) return

    const pathGen = pathGenRef.current
    if (!pathGen) return

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const glowCol = isDark ? '#34d399' : '#059669'

    const fill = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    fill.setAttribute('d', pathGen(feature) ?? '')
    fill.setAttribute('fill', glowCol)
    fill.setAttribute('fill-opacity', '0.18')
    fill.setAttribute('stroke', 'none')
    fill.setAttribute('pointer-events', 'none')
    layer.appendChild(fill)

    const outline = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    outline.setAttribute('d', pathGen(feature) ?? '')
    outline.setAttribute('fill', 'none')
    outline.setAttribute('stroke', glowCol)
    outline.setAttribute('stroke-width', `${1.8 / curKRef.current}`)
    outline.setAttribute('stroke-opacity', '0.9')
    outline.setAttribute('stroke-linejoin', 'round')
    outline.setAttribute('pointer-events', 'none')
    layer.appendChild(outline)
  }

  const redrawPaths = () => {
    const svg = svgRef.current
    const pathGen = pathGenRef.current
    if (!svg || !pathGen) return
    svg.querySelectorAll('#land-layer path').forEach(p => {
      const f = (p as any).__feature__
      if (f) p.setAttribute('d', pathGen(f) ?? '')
    })
    const gratPath = svg.querySelector('#grat-path') as SVGPathElement | null
    if (gratPath) {
      const grat = (gratPath as any).__grat__
      if (grat) gratPath.setAttribute('d', pathGen(grat) ?? '')
    }
    drawHighlight(projRef.current, selectedRef.current)
  }

  const applyTransform = (mapG: SVGGElement, W: number, H: number, k: number, ty: number) => {
    const cx = W / 2
    const cy = H / 2
    mapG.setAttribute(
      'transform',
      `translate(${cx * (1 - k)},${cy * (1 - k) + ty}) scale(${k})`
    )
  }

  const zoomToCountry = (country: Country) => {
    const proj = projRef.current
    const mapG = mapGRef.current
    if (!proj || !mapG) return

    const { W, H } = sizeRef.current
    const clampTy = clampTyRef.current

    if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current)

    const START_K = curKRef.current
    const START_TY = curTyRef.current
    const START_ROT = curRotRef.current

    const isoId = nameToIso(country.name)
    const featurePath = isoId != null ? featurePathsRef.current.get(isoId) : null
    const feature = (featurePath as any)?.__feature__

    // Calculate target rotation (center country horizontally)
    const targetRot = -country.lng

    // Compute coords with the TARGET rotation so targetTy is correct
    const originalRot = proj.rotate()
    proj.rotate([targetRot, 0])
    const coords = proj([country.lng, country.lat])
    // Compute bounding-box-based zoom WHILE rotated to target, so bounds are in view-space
    let TARGET_K = 12  // high fallback for micro-states not in 110m topojson

    if (feature) {
      const pathGen = pathGenRef.current
      const bounds = pathGen.bounds(feature)
      const dx = bounds[1][0] - bounds[0][0]
      const dy = bounds[1][1] - bounds[0][1]

      if (dx < 1 || dy < 1) {
        // Feature exists but is sub-pixel at 110m resolution
        TARGET_K = 12
      } else {
        const scale = 0.75 / Math.max(dx / W, dy / H)
        TARGET_K = Math.min(12, Math.max(2, scale))
      }
    }

    proj.rotate(originalRot) // restore original rotation

    let targetTy = 0
    if (coords) {
      const cy = H / 2
      targetTy = cy - TARGET_K * coords[1] - cy * (1 - TARGET_K)
      targetTy = clampTy(targetTy, TARGET_K)
    }

    // Pre-compute the shortest rotation delta (avoids wraparound the long way)
    const rotDelta = normalizeRotDelta(targetRot - START_ROT)

    const DURATION = 600
    const start = performance.now()
    const ease = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION)
      const e = ease(t)

      const k = START_K + (TARGET_K - START_K) * e
      const ty = START_TY + (targetTy - START_TY) * e
      // Use pre-normalized delta so we always take the short arc
      const rot = START_ROT + rotDelta * e

      curKRef.current = k
      curTyRef.current = ty
      curRotRef.current = rot

      proj.rotate([rot, 0])
      redrawPaths()
      applyTransform(mapG, W, H, k, ty)
      drawMarkers(proj, k)
      drawHighlight(proj, selectedRef.current)

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(tick)
      } else {
        animFrameRef.current = null
      }
    }

    animFrameRef.current = requestAnimationFrame(tick)
  }

  const resetMap = () => {
    if (!projRef.current || !mapGRef.current) return

    if (animFrameRef.current != null) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }

    const START_K = curKRef.current
    const START_TY = curTyRef.current
    const START_ROT = curRotRef.current
    const TARGET_K = 1
    const TARGET_TY = 0
    const TARGET_ROT = 0

    const { W, H } = sizeRef.current
    const mapG = mapGRef.current
    const proj = projRef.current

    // Pre-compute shortest rotation delta back to 0
    const rotDelta = normalizeRotDelta(TARGET_ROT - START_ROT)

    const DURATION = 500
    const start = performance.now()
    const ease = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION)
      const e = ease(t)

      const k = START_K + (TARGET_K - START_K) * e
      const ty = START_TY + (TARGET_TY - START_TY) * e
      const rot = START_ROT + rotDelta * e

      curKRef.current = k
      curTyRef.current = ty
      curRotRef.current = rot

      proj.rotate([rot, 0])
      redrawPaths()
      applyTransform(mapG, W, H, k, ty)
      drawMarkers(proj, k)
      drawHighlight(proj, selectedRef.current)

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(tick)
      } else {
        animFrameRef.current = null
      }
    }

    animFrameRef.current = requestAnimationFrame(tick)
  }

  // Respond to resetKey changes
  useEffect(() => {
    if (initDoneRef.current) {
      resetMap()
    }
  }, [resetKey])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const rect = svg.getBoundingClientRect()
    const W = rect.width || 320
    const H = rect.height || 320
    sizeRef.current = { W, H }

    const run = async () => {
      const [d3, topo] = await Promise.all([
        import('d3'),
        import('topojson-client'),
      ])

      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const oceanCol = isDark ? '#0d1117' : '#dde8f4'
      const landCol = isDark ? '#1c2d20' : '#cdddb5'
      const borderCol = isDark ? '#253029' : '#b5cca0'
      const gratCol = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)'

      svg.setAttribute('width', String(W))
      svg.setAttribute('height', String(H))

      if (!initDoneRef.current) {
        svg.innerHTML = ''

        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        bg.setAttribute('width', String(W)); bg.setAttribute('height', String(H))
        bg.setAttribute('fill', oceanCol)
        svg.appendChild(bg)

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
        const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath')
        clip.id = 'map-clip'
        const cr = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        cr.setAttribute('width', String(W)); cr.setAttribute('height', String(H))
        clip.appendChild(cr); defs.appendChild(clip); svg.appendChild(defs)

        const mapG = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        mapG.id = 'map-group'
        mapG.setAttribute('clip-path', 'url(#map-clip)')
        svg.appendChild(mapG)
        mapGRef.current = mapG

        const gratLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        gratLayer.id = 'grat-layer'
        mapG.appendChild(gratLayer)

        const landLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        landLayer.id = 'land-layer'
        mapG.appendChild(landLayer)

        const highlightLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        highlightLayer.id = 'highlight-layer'
        mapG.appendChild(highlightLayer)

        const markerLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        markerLayer.id = 'marker-layer'
        mapG.appendChild(markerLayer)

        const proj = d3.geoNaturalEarth1()
          .scale(W / 5.8)
          .translate([W / 2, H / 2])
          .rotate([0, 0])
        projRef.current = proj

        const pathGen = d3.geoPath(proj)
        pathGenRef.current = pathGen

        const graticule = d3.geoGraticule()()
        const gratPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        gratPath.id = 'grat-path'
          ; (gratPath as any).__grat__ = graticule
        gratPath.setAttribute('d', pathGen(graticule) ?? '')
        gratPath.setAttribute('fill', 'none')
        gratPath.setAttribute('stroke', gratCol)
        gratPath.setAttribute('stroke-width', '0.4')
        gratLayer.appendChild(gratPath)

        const world = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json') as any
        const feats = (topo.feature(world, world.objects.countries) as any).features
        feats.forEach((f: any) => {
          const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
            ; (p as any).__feature__ = f
          p.setAttribute('d', pathGen(f) ?? '')
          p.setAttribute('fill', landCol)
          p.setAttribute('stroke', borderCol)
          p.setAttribute('stroke-width', '0.35')
          landLayer.appendChild(p)
          const numId = parseInt(f.id, 10)
          if (!isNaN(numId)) featurePathsRef.current.set(numId, p)
        })

        const yNorth = proj([0, 82])?.[1] ?? 0
        const ySouth = proj([0, -82])?.[1] ?? H
        const mapH = ySouth - yNorth

        const clampTy = (ty: number, k: number) => {
          const excess = (mapH * k - H) / 2
          if (excess <= 0) return 0
          return Math.max(-excess, Math.min(excess, ty))
        }
        clampTyRef.current = clampTy

        // Drag state
        let isDragging = false
        let lastX = 0
        let lastY = 0

        const pxPerDeg = (k: number) => (W * k) / 360

        const onWheel = (e: WheelEvent) => {
          e.preventDefault()
          const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
          const newK = Math.max(1, Math.min(12, curKRef.current * factor))
          const newTy = clampTy(curTyRef.current * (newK / curKRef.current), newK)
          curKRef.current = newK
          curTyRef.current = newTy
          applyTransform(mapG, W, H, newK, newTy)
          drawMarkers(proj, newK)
          drawHighlight(proj, selectedRef.current)
        }

        const onMouseDown = (e: MouseEvent) => {
          isDragging = true
          lastX = e.clientX
          lastY = e.clientY
          svg.style.cursor = 'grabbing'
        }

        const onMouseMove = (e: MouseEvent) => {
          if (!isDragging) return
          const dx = e.clientX - lastX
          const dy = e.clientY - lastY
          lastX = e.clientX
          lastY = e.clientY

          const newRot = (curRotRef.current + dx / pxPerDeg(curKRef.current)) % 360
          curRotRef.current = newRot
          proj.rotate([newRot, 0])
          redrawPaths()

          const newTy = clampTy(curTyRef.current + dy, curKRef.current)
          curTyRef.current = newTy
          applyTransform(mapG, W, H, curKRef.current, newTy)
          drawMarkers(proj, curKRef.current)
          drawHighlight(proj, selectedRef.current)
        }

        const onMouseUp = () => {
          isDragging = false
          svg.style.cursor = 'grab'
        }

        // Touch support
        let lastTouchX = 0
        let lastTouchY = 0
        let lastTouchDist = 0

        const onTouchStart = (e: TouchEvent) => {
          if (e.touches.length === 1) {
            lastTouchX = e.touches[0].clientX
            lastTouchY = e.touches[0].clientY
          } else if (e.touches.length === 2) {
            const dx = e.touches[1].clientX - e.touches[0].clientX
            const dy = e.touches[1].clientY - e.touches[0].clientY
            lastTouchDist = Math.hypot(dx, dy)
          }
        }

        const onTouchMove = (e: TouchEvent) => {
          e.preventDefault()
          if (e.touches.length === 1) {
            const dx = e.touches[0].clientX - lastTouchX
            const dy = e.touches[0].clientY - lastTouchY
            lastTouchX = e.touches[0].clientX
            lastTouchY = e.touches[0].clientY

            const newRot = (curRotRef.current + dx / pxPerDeg(curKRef.current)) % 360
            curRotRef.current = newRot
            proj.rotate([newRot, 0])
            redrawPaths()

            const newTy = clampTy(curTyRef.current + dy, curKRef.current)
            curTyRef.current = newTy
            applyTransform(mapG, W, H, curKRef.current, newTy)
            drawMarkers(proj, curKRef.current)
            drawHighlight(proj, selectedRef.current)
          } else if (e.touches.length === 2) {
            const dx = e.touches[1].clientX - e.touches[0].clientX
            const dy = e.touches[1].clientY - e.touches[0].clientY
            const dist = Math.hypot(dx, dy)
            const factor = dist / lastTouchDist
            lastTouchDist = dist
            const newK = Math.max(1, Math.min(12, curKRef.current * factor))
            const newTy = clampTy(curTyRef.current * (newK / curKRef.current), newK)
            curKRef.current = newK
            curTyRef.current = newTy
            applyTransform(mapG, W, H, newK, newTy)
            drawMarkers(proj, newK)
            drawHighlight(proj, selectedRef.current)
          }
        }

        svg.addEventListener('wheel', onWheel, { passive: false })
        svg.addEventListener('mousedown', onMouseDown)
        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
        svg.addEventListener('mouseleave', onMouseUp)
        svg.addEventListener('touchstart', onTouchStart, { passive: true })
        svg.addEventListener('touchmove', onTouchMove, { passive: false })
        svg.addEventListener('touchend', () => { lastTouchDist = 0 })

        const ctrlG = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        svg.appendChild(ctrlG)

        const btnBg = isDark ? '#16201a' : '#ffffff'
        const btnBdr = isDark ? '#2a3a2e' : '#d4d4d8'
        const btnTxt = isDark ? '#71717a' : '#71717a'

        const mkBtn = (label: string, y0: number, cb: () => void) => {
          const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
          g.style.cursor = 'pointer'
          g.addEventListener('click', e => { e.stopPropagation(); cb() })

          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
          rect.setAttribute('x', String(W - 30)); rect.setAttribute('y', String(y0))
          rect.setAttribute('width', '22'); rect.setAttribute('height', '20')
          rect.setAttribute('rx', '3')
          rect.setAttribute('fill', btnBg)
          rect.setAttribute('stroke', btnBdr)
          rect.setAttribute('stroke-width', '0.5')

          const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text')
          txt.setAttribute('x', String(W - 19)); txt.setAttribute('y', String(y0 + 14))
          txt.setAttribute('text-anchor', 'middle')
          txt.setAttribute('font-size', '13')
          txt.setAttribute('fill', btnTxt)
          txt.textContent = label

          g.appendChild(rect); g.appendChild(txt); ctrlG.appendChild(g)
        }

        const zoomBy = (factor: number) => {
          const newK = Math.max(1, Math.min(12, curKRef.current * factor))
          const newTy = clampTy(curTyRef.current * (newK / curKRef.current), newK)
          curKRef.current = newK
          curTyRef.current = newTy
          applyTransform(mapG, W, H, newK, newTy)
          drawMarkers(proj, newK)
          drawHighlight(proj, selectedRef.current)
        }

        mkBtn('+', 8, () => zoomBy(1.7))
        mkBtn('−', 32, () => zoomBy(1 / 1.7))
        mkBtn('⌂', 60, () => resetMap())

        const legG = document.createElementNS('http://www.w3.org/2000/svg', 'g')
          ;[
            { label: 'High', col: '#1D9E75' },
            { label: 'Med', col: '#EF9F27' },
            { label: 'Low', col: '#E24B4A' },
          ].forEach(({ label, col }, i) => {
            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
            dot.setAttribute('cx', '8'); dot.setAttribute('cy', String(H - 30 + i * 12))
            dot.setAttribute('r', '3.5'); dot.setAttribute('fill', col); dot.setAttribute('fill-opacity', '0.8')
            const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text')
            txt.setAttribute('x', '16'); txt.setAttribute('y', String(H - 26 + i * 12))
            txt.setAttribute('font-size', '9')
            txt.setAttribute('fill', isDark ? '#52525b' : '#a1a1aa')
            txt.textContent = label
            legG.appendChild(dot); legG.appendChild(txt)
          })
        svg.appendChild(legG)

        initDoneRef.current = true
      }

      drawMarkers(projRef.current, curKRef.current)
      drawHighlight(projRef.current, selectedRef.current)
    }

    run()

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!projRef.current) return
    drawMarkers(projRef.current, curKRef.current)
    drawHighlight(projRef.current, selected)
    if (selected) zoomToCountry(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  useEffect(() => {
    if (projRef.current) drawMarkers(projRef.current, curKRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries])

  return (
    <div className="relative w-full h-full" style={{ userSelect: 'none' }}>
      <svg
        ref={svgRef}
        className="w-full h-full block"
        style={{ cursor: 'grab' }}
        role="img"
        aria-label="Interactive world population map"
      />
      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-zinc-400 dark:text-zinc-700 pointer-events-none tracking-wide">
        scroll to zoom · drag to pan
      </span>
    </div>
  )
}