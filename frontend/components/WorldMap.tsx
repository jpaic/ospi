'use client'

import { useEffect, useRef } from 'react'
import type { GeoProjection, GeoPath, GeoPermissibleObjects } from 'd3-geo'
import type { Feature, FeatureCollection } from 'geojson'
import type { Country } from '@/lib/types'
import { nameToIso, normalizeRotDelta } from '@/components/WorldMap/constants'

interface Props {
  countries: Country[]
  selected: Country | null
  onSelect: (c: Country) => void
  resetKey?: number
}

interface AnnotatedPath extends SVGPathElement {
  __feature__?: Feature
}

interface AnnotatedGratPath extends SVGPathElement {
  __grat__?: GeoPermissibleObjects
}

type TopoJson = { objects: { countries: { type: 'Topology'; geometries: [] } } }

export default function WorldMap({ countries, selected, onSelect, resetKey }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const projRef = useRef<GeoProjection | null>(null)
  const pathGenRef = useRef<GeoPath | null>(null)
  const curKRef = useRef<number>(1)
  const curTyRef = useRef<number>(0)
  const curRotRef = useRef<number>(0)
  const initDoneRef = useRef(false)
  const selectedRef = useRef<Country | null>(null)
  const countriesRef = useRef<Country[]>([])
  const onSelectRef = useRef<(c: Country) => void>(() => {})
  const animFrameRef = useRef<number | null>(null)
  const mapGRef = useRef<SVGGElement | null>(null)
  const clampTyRef = useRef<(ty: number, k: number) => number>(() => 0)
  const sizeRef = useRef<{ W: number; H: number }>({ W: 320, H: 320 })
  const featurePathsRef = useRef<Map<number, AnnotatedPath>>(new Map())

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  useEffect(() => {
    countriesRef.current = countries
  }, [countries])

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  const drawMarkers = (proj: GeoProjection, k = 1) => {
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

  const drawHighlight = (sel: Country | null) => {
    const svg = svgRef.current
    if (!svg) return
    const layer = svg.querySelector('#highlight-layer') as SVGGElement | null
    if (!layer) return
    layer.innerHTML = ''
    if (!sel) return

    const isoId = nameToIso(sel.name)
    if (isoId == null) return

    const featurePath = featurePathsRef.current.get(isoId) as AnnotatedPath | undefined
    if (!featurePath) return
    const feature = featurePath.__feature__
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
    svg.querySelectorAll<AnnotatedPath>('#land-layer path').forEach(p => {
      const f = p.__feature__
      if (f) p.setAttribute('d', pathGen(f) ?? '')
    })
    const gratPath = svg.querySelector<AnnotatedGratPath>('#grat-path')
    if (gratPath) {
      const grat = gratPath.__grat__
      if (grat) gratPath.setAttribute('d', pathGen(grat) ?? '')
    }
    if (projRef.current) drawHighlight(selectedRef.current)
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
    const featurePath = isoId != null ? featurePathsRef.current.get(isoId) as AnnotatedPath | undefined : undefined
    const feature = featurePath?.__feature__

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
      drawHighlight(selectedRef.current)

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
      drawHighlight(selectedRef.current)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          ; (gratPath as AnnotatedGratPath).__grat__ = graticule
        gratPath.setAttribute('d', pathGen(graticule) ?? '')
        gratPath.setAttribute('fill', 'none')
        gratPath.setAttribute('stroke', gratCol)
        gratPath.setAttribute('stroke-width', '0.4')
        gratLayer.appendChild(gratPath)

        const world = await d3.json<TopoJson>('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json') as unknown as TopoJson
        const feats = (topo.feature(world, world.objects.countries) as FeatureCollection).features as Feature[]
        feats.forEach((f: Feature) => {
          const p = document.createElementNS('http://www.w3.org/2000/svg', 'path') as AnnotatedPath
          p.__feature__ = f
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
          drawHighlight(selectedRef.current)
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
          drawHighlight(selectedRef.current)
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
            drawHighlight(selectedRef.current)
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
            drawHighlight(selectedRef.current)
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
          drawHighlight(selectedRef.current)
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
      drawHighlight(selectedRef.current)
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
    drawHighlight(selected)
    if (selected) zoomToCountry(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  useEffect(() => {
    if (projRef.current) drawMarkers(projRef.current, curKRef.current)
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