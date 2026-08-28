import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  createMapLibreMap, maplibrePinEl, TILE_STYLE, TOUR_PIN_COLOR, warmMapResources, type MapPoint,
} from '../../lib/mapUtils'
import './TourLocationMap.css'

interface TourLocationMapProps {
  coordinates: { lat: number; lng: number }
  location: string
  title: string
}

/** Tour-detail location card. Renders a non-interactive MapLibre map (free
    OpenFreeMap "Liberty" tiles, no API key — the same stack the supplier
    platform uses) with a single green pin at the meeting point; the whole
    map stays a link that opens Google Maps. */
export default function TourLocationMap({ coordinates, location, title }: TourLocationMapProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'error'>('loading')

  const hasCoords = Number.isFinite(coordinates.lat) && Number.isFinite(coordinates.lng)
  const googleMapsUrl = `https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}`

  useEffect(() => {
    const el = containerRef.current
    if (!el || !hasCoords) return
    warmMapResources()

    const existing = mapRef.current
    if (existing) {
      existing.jumpTo({ center: [coordinates.lng, coordinates.lat], zoom: 13 })
      return () => {
        if (!el.isConnected) {
          existing.remove()
          mapRef.current = null
        }
      }
    }

    let settled = false
    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true
        setMapState('error')
      }
    }, 12000)
    const settle = (s: 'ready' | 'error') => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      setMapState(s)
    }

    const createdMap = createMapLibreMap(el, {
      style: TILE_STYLE,
      center: [coordinates.lng, coordinates.lat],
      zoom: 13,
    })
    if (!createdMap) {
      settle('error')
      return
    }
    mapRef.current = createdMap

    // Keep it static: the map is just a picture inside the Google-Maps link.
    createdMap.dragPan.disable()
    createdMap.scrollZoom.disable()
    createdMap.boxZoom.disable()
    createdMap.touchZoomRotate.disable()
    createdMap.keyboard.disable()
    createdMap.doubleClickZoom.disable()

    createdMap.on('load', () => {
      settle('ready')
      createdMap.resize()
      const point: MapPoint = { lat: coordinates.lat, lng: coordinates.lng, kind: 'tour' }
      new maplibregl.Marker({ element: maplibrePinEl(TOUR_PIN_COLOR), anchor: 'bottom' })
        .setLngLat([point.lng, point.lat])
        .addTo(createdMap)
    })
    createdMap.on('error', () => settle('error'))

    return () => {
      if (el.isConnected) return
      window.clearTimeout(timeout)
      createdMap.remove()
      mapRef.current = null
    }
  }, [coordinates.lat, coordinates.lng, hasCoords])

  return (
    <section className="tour-location-map" id="tour-location">
      <h2 className="tour-section-title">{t('tourDetail.tourLocation')}</h2>

      <div className="location-info">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span>{location}</span>
      </div>

      <div className="map-container">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="map-link"
          aria-label={`View ${title} location on Google Maps`}
        >
          {hasCoords ? (
            <div className="map-canvas">
              <div ref={containerRef} className="map-canvas-inner" />
              {mapState === 'loading' && (
                <div className="map-overlay">
                  <span className="map-spinner" />
                </div>
              )}
              {mapState === 'error' && (
                <div className="map-overlay">
                  <svg className="map-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className="map-overlay-text">{t('tourDetail.clickForGoogleMaps')}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="map-placeholder">
              <svg className="map-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="map-overlay-text">{t('tourDetail.clickForGoogleMaps')}</span>
            </div>
          )}
        </a>

        <div className="map-details">
          <p>{t('tourDetail.mapDirections')}</p>
        </div>
      </div>
    </section>
  )
}