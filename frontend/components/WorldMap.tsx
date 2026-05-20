'use client'

import { useEffect, useRef } from 'react'
import type { Country } from '@/lib/mockData'

interface Props {
  countries: Country[]
  selected: Country | null
  onSelect: (c: Country) => void
}

export default function WorldMap({ countries, selected, onSelect }: Props) {
  const svgRef        = useRef<SVGSVGElement>(null)
  const projRef       = useRef<any>(null)
  const pathGenRef    = useRef<any>(null)
  const zoomRef       = useRef<any>(null)
  const curKRef       = useRef<number>(1)
  const curTyRef      = useRef<number>(0)   // manual Y-pan accumulator
  const initDoneRef   = useRef(false)
  // Keep latest props in refs so event-handler closures never go stale
  const selectedRef   = useRef<Country | null>(selected)
  const countriesRef  = useRef<Country[]>(countries)
  const onSelectRef   = useRef(onSelect)

  selectedRef.current  = selected
  countriesRef.current = countries
  onSelectRef.current  = onSelect

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
      const r     = baseR / k
      const col   = c.conf === 'high' ? '#1D9E75' : c.conf === 'med' ? '#EF9F27' : '#E24B4A'
      const isSel = selectedRef.current?.name === c.name

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      g.style.cursor = 'pointer'
      g.addEventListener('click', e => { e.stopPropagation(); onSelectRef.current(c) })

      if (isSel) {
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        ring.setAttribute('cx', String(x))
        ring.setAttribute('cy', String(y))
        ring.setAttribute('r',  String((baseR + 4) / k))
        ring.setAttribute('fill', 'none')
        ring.setAttribute('stroke', col)
        ring.setAttribute('stroke-width', String(1 / k))
        ring.setAttribute('stroke-opacity', '0.4')
        g.appendChild(ring)
      }

      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      dot.setAttribute('cx', String(x))
      dot.setAttribute('cy', String(y))
      dot.setAttribute('r',  String(isSel ? (baseR + 1.5) / k : r))
      dot.setAttribute('fill', col)
      dot.setAttribute('fill-opacity', isSel ? '1' : '0.7')
      dot.setAttribute('stroke', '#fff')
      dot.setAttribute('stroke-width', String(isSel ? 1.5 / k : 0.5 / k))

      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
      title.textContent = `${c.name}  ·  OSPI: ${c.ospi}M  ·  Official: ${c.official}M`
      dot.appendChild(title)

      g.appendChild(dot)
      layer.appendChild(g)
    })
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
  }

  // Apply the current k + ty to mapG, always scaling from viewport center
  const applyTransform = (mapG: SVGGElement, W: number, H: number, k: number, ty: number) => {
    const cx = W / 2
    const cy = H / 2
    mapG.setAttribute(
      'transform',
      `translate(${cx * (1 - k)},${cy * (1 - k) + ty}) scale(${k})`
    )
  }

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const SIZE = svg.clientWidth || 320
    const W = SIZE, H = SIZE

    const run = async () => {
      const [d3, topo] = await Promise.all([
        import('d3'),
        import('topojson-client'),
      ])

      const isDark    = window.matchMedia('(prefers-color-scheme: dark)').matches
      const oceanCol  = isDark ? '#0d1117' : '#dde8f4'
      const landCol   = isDark ? '#1c2d20' : '#cdddb5'
      const borderCol = isDark ? '#253029' : '#b5cca0'
      const gratCol   = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)'

      svg.setAttribute('width',  String(W))
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

        const gratLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        gratLayer.id = 'grat-layer'
        mapG.appendChild(gratLayer)

        const landLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        landLayer.id = 'land-layer'
        mapG.appendChild(landLayer)

        const markerLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        markerLayer.id = 'marker-layer'
        mapG.appendChild(markerLayer)

        // ── Projection ──
        const proj = d3.geoNaturalEarth1()
          .scale(W / 5.8)
          .translate([W / 2, H / 2])
          .rotate([0, 0])
        projRef.current = proj

        const pathGen = d3.geoPath(proj)
        pathGenRef.current = pathGen

        // Graticule
        const graticule = d3.geoGraticule()()
        const gratPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        gratPath.id = 'grat-path'
        ;(gratPath as any).__grat__ = graticule
        gratPath.setAttribute('d', pathGen(graticule) ?? '')
        gratPath.setAttribute('fill', 'none')
        gratPath.setAttribute('stroke', gratCol)
        gratPath.setAttribute('stroke-width', '0.4')
        gratLayer.appendChild(gratPath)

        // Land
        const world = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json') as any
        const feats  = (topo.feature(world, world.objects.countries) as any).features
        feats.forEach((f: any) => {
          const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          ;(p as any).__feature__ = f
          p.setAttribute('d', pathGen(f) ?? '')
          p.setAttribute('fill', landCol)
          p.setAttribute('stroke', borderCol)
          p.setAttribute('stroke-width', '0.35')
          landLayer.appendChild(p)
        })

        // ── Y-clamp bounds ──
        // At k=1, how far can the map pan vertically before showing empty ocean?
        const yNorth = proj([0,  82])?.[1] ?? 0
        const ySouth = proj([0, -82])?.[1] ?? H
        const mapH   = ySouth - yNorth  // SVG height of the full map at k=1

        const clampTy = (ty: number, k: number) => {
          // At scale k, the visible map height grows by k.
          // The excess beyond the viewport is (mapH * k - H) / 2 on each side.
          const excess = (mapH * k - H) / 2
          if (excess <= 0) return 0  // map fits entirely — center it
          return Math.max(-excess, Math.min(excess, ty))
        }

        // ── Manual drag + wheel handler ──
        // We bypass D3 zoom entirely for X (rotation) and manage Y + scale ourselves.
        // This avoids D3's internal tx accumulation fighting our center-anchored scale.
        let rotLambda = 0
        let isDragging = false
        let lastX = 0
        let lastY = 0

        const pxPerDeg = (k: number) => (W * k) / 360

        const onWheel = (e: WheelEvent) => {
          e.preventDefault()
          const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
          const newK = Math.max(1, Math.min(12, curKRef.current * factor))
          // When zoom changes, keep ty proportionally clamped
          const newTy = clampTy(curTyRef.current * (newK / curKRef.current), newK)
          curKRef.current = newK
          curTyRef.current = newTy
          applyTransform(mapG, W, H, newK, newTy)
          drawMarkers(proj, newK)
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

          // X → rotate projection (sphere rotation, pixel-perfect with markers)
          rotLambda = (rotLambda + dx / pxPerDeg(curKRef.current)) % 360
          proj.rotate([rotLambda, 0])
          redrawPaths()

          // Y → pan with clamp
          const newTy = clampTy(curTyRef.current + dy, curKRef.current)
          curTyRef.current = newTy
          applyTransform(mapG, W, H, curKRef.current, newTy)
          drawMarkers(proj, curKRef.current)
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

            rotLambda = (rotLambda + dx / pxPerDeg(curKRef.current)) % 360
            proj.rotate([rotLambda, 0])
            redrawPaths()

            const newTy = clampTy(curTyRef.current + dy, curKRef.current)
            curTyRef.current = newTy
            applyTransform(mapG, W, H, curKRef.current, newTy)
            drawMarkers(proj, curKRef.current)
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
          }
        }

        svg.addEventListener('wheel',      onWheel,      { passive: false })
        svg.addEventListener('mousedown',  onMouseDown)
        svg.addEventListener('mousemove',  onMouseMove)
        svg.addEventListener('mouseup',    onMouseUp)
        svg.addEventListener('mouseleave', onMouseUp)
        svg.addEventListener('touchstart', onTouchStart, { passive: true })
        svg.addEventListener('touchmove',  onTouchMove,  { passive: false })
        svg.addEventListener('touchend',   () => { lastTouchDist = 0 })

        // ── Zoom buttons ──
        const ctrlG = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        svg.appendChild(ctrlG)

        const btnBg  = isDark ? '#16201a' : '#ffffff'
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
        }

        mkBtn('+', 8,  () => zoomBy(1.7))
        mkBtn('−', 32, () => zoomBy(1 / 1.7))
        mkBtn('⌂', 60, () => {
          rotLambda = 0
          proj.rotate([0, 0])
          redrawPaths()
          curKRef.current = 1
          curTyRef.current = 0
          applyTransform(mapG, W, H, 1, 0)
          drawMarkers(proj, 1)
        })

        // ── Legend ──
        const legG = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        ;[
          { label: 'High', col: '#1D9E75' },
          { label: 'Med',  col: '#EF9F27' },
          { label: 'Low',  col: '#E24B4A' },
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
    }

    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redraw markers on selection change, preserving zoom level
  useEffect(() => {
    if (projRef.current) drawMarkers(projRef.current, curKRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, countries])

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