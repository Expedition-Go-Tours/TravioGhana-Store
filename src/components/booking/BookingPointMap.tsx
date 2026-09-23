import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import { ExternalLink } from 'lucide-react'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  createMapLibreMap,
  maplibrePinEl,
  TILE_STYLE,
  warmMapResources,
} from '../../lib/mapUtils'

interface BookingPointMapProps {
  lat: number
  lng: number
  label?: string
  className?: string
}

/**
 * Non-interactive single-pin map for the booking workspace. Renders with the
 * app's existing MapLibre stack; the whole tile is a link to Google Maps.
 * Gracefully reports load failure instead of leaving a broken box.
 */
export default function BookingPointMap({ lat, lng, label, className = '' }: BookingPointMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    warmMapResources()

    let settled = false
    let map: maplibregl.Map | null = null
    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true
        setState('error')
      }
    }, 10000)

    map = createMapLibreMap(el, {
      style: TILE_STYLE,
      center: [lng, lat],
      zoom: 12,
      interactive: false,
      attributionControl: false,
    })

    if (!map) {
      settled = true
      window.clearTimeout(timeout)
      setState('error')
      return
    }

    map.on('load', () => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      setState('ready')
      map?.resize()
      new maplibregl.Marker({ element: maplibrePinEl('#16a34a'), anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(map)
    })
    map.on('error', () => {
      if (!settled) {
        settled = true
        window.clearTimeout(timeout)
        setState('error')
      }
    })

    return () => {
      window.clearTimeout(timeout)
      if (!el.isConnected) {
        map?.remove()
      }
    }
  }, [lat, lng])

  const href = `https://www.google.com/maps?q=${lat},${lng}`

  return (
    <div className={`bk-pointmap${className ? ` ${className}` : ''}`}>
      <a href={href} target="_blank" rel="noreferrer noopener" aria-label={label || 'Open location in Google Maps'}>
        <div className="bk-pointmap-frame">
          <div ref={containerRef} className="bk-pointmap-canvas" />
          {state === 'loading' && (
            <span className="bk-pointmap-overlay">
              <span className="bk-pointmap-spinner" /> Loading map…
            </span>
          )}
          {state === 'error' && (
            <span className="bk-pointmap-overlay">View in Google Maps →</span>
          )}
          <span className="bk-pointmap-hint" aria-hidden="true">
            <ExternalLink size={15} /> View on Google Maps
          </span>
        </div>
      </a>
    </div>
  )
}
