'use client'

import { useEffect, useRef } from 'react'
import type { Country } from '@/lib/mockData'

interface Props {
  countries: Country[]
  selected: Country | null
  onSelect: (c: Country) => void
}

export default function WorldMap({ countries, selected, onSelect }: Props) {
  const svgRef      = useRef<SVGSVGElement>(null)
  const projRef     = useRef<any>(null)
  const zoomRef     = useRef<any>(null)
  const initDoneRef = useRef(false)

  const drawMarkers = (proj: any, k = 1) => {
    const svg = svgRef.current
    if (!svg) return
    const layer = svg.querySelector('#marker-layer') as SVGGElement
    if (!layer) return
    layer.innerHTML = ''

    countries.forEach(c => {
      const coords = proj([c.lng, c.lat])
      if (!coords) return
      const [x, y] = coords
      const baseR = Math.max(3, Math.min(9, c.ospi / 130))
      const r     = baseR / k
      const col   = c.conf === 'high' ? '#1D9E75' : c.conf === 'med' ? '#EF9F27' : '#E24B4A'
      const isSel = selected?.name === c.name

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      g.style.cursor = 'pointer'
      g.addEventListener('click', e => { e.stopPropagation(); onSelect(c) })

      // pulse ring for selected
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

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    // Square: use the element's actual rendered size
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

        // Ocean bg
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        bg.setAttribute('width', String(W)); bg.setAttribute('height', String(H))
        bg.setAttribute('fill', oceanCol)
        svg.appendChild(bg)

        // Clip
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
        const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath')
        clip.id = 'map-clip'
        const cr = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        cr.setAttribute('width', String(W)); cr.setAttribute('height', String(H))
        clip.appendChild(cr); defs.appendChild(clip); svg.appendChild(defs)

        // Zoomable group
        const mapG = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        mapG.id = 'map-group'
        mapG.setAttribute('clip-path', 'url(#map-clip)')
        svg.appendChild(mapG)

        // Graticule layer
        const gratLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        gratLayer.id = 'grat-layer'
        mapG.appendChild(gratLayer)

        const landLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        landLayer.id = 'land-layer'
        mapG.appendChild(landLayer)

        const markerLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        markerLayer.id = 'marker-layer'
        mapG.appendChild(markerLayer)

        // Projection: Natural Earth, scaled to fill square with padding
        const proj = d3.geoNaturalEarth1()
          .scale(W / 5.8)
          .translate([W / 2, H / 2])
        projRef.current = proj
        const pathGen = d3.geoPath(proj)

        // Graticule
        const graticule = d3.geoGraticule()()
        const gratPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        gratPath.setAttribute('d', pathGen(graticule) ?? '')
        gratPath.setAttribute('fill', 'none')
        gratPath.setAttribute('stroke', gratCol)
        gratPath.setAttribute('stroke-width', '0.4')
        gratLayer.appendChild(gratPath)

        // Land + borders
        const world = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json') as any
        const feats  = (topo.feature(world, world.objects.countries) as any).features
        feats.forEach((f: any) => {
          const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          p.setAttribute('d', pathGen(f) ?? '')
          p.setAttribute('fill', landCol)
          p.setAttribute('stroke', borderCol)
          p.setAttribute('stroke-width', '0.35')
          landLayer.appendChild(p)
        })

        // Zoom — allow full pan in both axes
        let curK = 1
        const zoom = d3.zoom<SVGSVGElement, unknown>()
          .scaleExtent([1, 12])
          .on('zoom', event => {
            curK = event.transform.k
            mapG.setAttribute('transform', event.transform.toString())
            drawMarkers(proj, curK)
          })
        zoomRef.current = zoom
        d3.select(svg).call(zoom)

        // Zoom buttons
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

        const d3svg = d3.select(svg)
        mkBtn('+', 8,  () => d3svg.transition().duration(220).call(zoom.scaleBy, 1.7))
        mkBtn('−', 32, () => d3svg.transition().duration(220).call(zoom.scaleBy, 1 / 1.7))
        mkBtn('⌂', 60, () => d3svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity))

        // Legend — bottom left
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

      drawMarkers(projRef.current, 1)
    }

    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redraw markers when selection changes without re-initing
  useEffect(() => {
    if (projRef.current) drawMarkers(projRef.current, 1)
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