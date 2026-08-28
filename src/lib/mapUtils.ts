import * as maplibregl from 'maplibre-gl'

// maplibre resolves its render worker from `import.meta.url` at runtime
// (new URL('./maplibre-gl-worker.mjs', import.meta.url)), which bundlers
// cannot statically detect — the worker would never be emitted in production
// and every map would hang on a silent 404. The worker + its shared chunk are
// copied verbatim to `public/maplibre-gl/` by the `copy-maplibre-worker` Vite
// plugin; pinning that same-origin URL here (before any map is created) makes
// both environments load the same worker file.
maplibregl.setWorkerUrl('/maplibre-gl/maplibre-gl-worker.mjs')

/**
 * Shared helpers for the storefront maps (booking-page pickup map, pickup
 * map modal, tour-detail location map). Maps are rendered with MapLibre GL
 * using OpenFreeMap's "Liberty" style — free, keyless OSM vector tiles — the
 * same style the supplier platform's maps use, so both platforms match.
 * The Mapbox GL map remains available as a token-gated fallback layer.
 */

/** OpenFreeMap "Liberty" vector style (keyless OSM tiles). */
export const TILE_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

const TILE_ORIGIN = 'https://tiles.openfreemap.org'

/** Default camera fallback — Accra, the platform's origin market. */
export const DEFAULT_CENTER: [number, number] = [-0.187, 5.6037]

let warmResourcesStarted = false

/**
 * Idempotent warm-up for the tile style: a preconnect hint to the tile host
 * plus a force-cached style fetch so the first map opens fast instead of
 * cold-starting against the CDN. Runs once per page load; best-effort.
 */
export function warmMapResources(): void {
  if (warmResourcesStarted || typeof document === 'undefined') return
  warmResourcesStarted = true
  try {
    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = TILE_ORIGIN
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  } catch {
    /* warm-up is best-effort */
  }
  if (typeof window !== 'undefined') {
    window
      .fetch(TILE_STYLE, { cache: 'force-cache', mode: 'cors' })
      .catch(() => {
        /* best-effort warm-up; a failed prefetch must never break the app */
      })
  }
}

/** Supplier's default pin colour (green) for pickup / meeting points. */
export const TOUR_PIN_COLOR = '#047857'
/** Brighter green used when a pickup point is the traveller's selection. */
export const SELECTED_PIN_COLOR = '#179237'
/** Green draggable pin for the traveller's chosen pickup location. */
export const DRAGGABLE_PIN_COLOR = '#179237'
/** Red pin for the traveller's chosen pickup location. */
export const USER_PIN_COLOR = '#dc2626'
/** Violet pin for traveller-added (double-clicked) pickup spots. */
export const CUSTOM_PIN_COLOR = '#7c3aed'

export interface MapPoint {
  lat: number
  lng: number
  label?: string
  kind: 'tour' | 'user'
  /** Google place id — enables Place Details in the pin's info window. */
  placeId?: string | null
  rating?: number | null
  category?: string | null
}

/** The slice of the tour's meeting/pickup config the map builders need. */
export interface PickupMapSource {
  meetingMode?: 'meeting_point' | 'pickup' | 'none'
  meetingPoint?: string
  meetingPointLat?: number | null
  meetingPointLng?: number | null
  pickupAreas?: { name?: string; address?: string; lat?: number | null; lng?: number | null }[]
  pickupLocations?: { name?: string; address?: string; lat?: number | null; lng?: number | null }[]
}

export function toNumber(v: unknown): number | null {
  // null/undefined/'' must stay null — Number(null) === 0, and a phantom
  // (0, 0) pin at the Gulf of Guinea broke the camera fit and map data gates.
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Coordinate pins from the supplier's config: the meeting point, or the
    specific pickup locations (zone-based pickup renders the zone circle
    instead, with no pin inside the designated area). */
export function buildTourPoints(tour: PickupMapSource): MapPoint[] {
  const pts: MapPoint[] = []

  // Infer the effective meeting mode when the backend doesn't set it.
  const hasMeetingData = !!(tour.meetingPoint || tour.meetingPointLat != null)
  const hasPickupData =
    (tour.pickupAreas?.length ?? 0) > 0 || (tour.pickupLocations?.length ?? 0) > 0
  const effectiveMode = tour.meetingMode
    ?? (hasMeetingData ? 'meeting_point' : hasPickupData ? 'pickup' : undefined)

  if (effectiveMode === 'meeting_point') {
    const lat = toNumber(tour.meetingPointLat)
    const lng = toNumber(tour.meetingPointLng)
    if (lat != null && lng != null) {
      pts.push({ lat, lng, label: tour.meetingPoint || '', kind: 'tour' })
    }
  }
  if (effectiveMode === 'pickup') {
    // Zone-based pickup draws the zone circle (pickupZoneRings) — no pin sits
    // at the area's saved point inside the designated area.
    // Area-based pickup supersedes leftover specific pickup locations — when
    // areas exist, the location pins are stale and must not render.
    if (!tour.pickupAreas?.length) {
      for (const l of tour.pickupLocations || []) {
        const lat = toNumber(l?.lat)
        const lng = toNumber(l?.lng)
        if (lat != null && lng != null) {
          pts.push({ lat, lng, label: l.name || l.address || '', kind: 'tour' })
        }
      }
    }
  }
  return pts
}

/** The classic map-pin SVG (filled body + white centre dot) — the supplier's
    shape, recoloured per marker. Returns the SVG markup for marker elements. */
export function pinSvg(color: string): string {
  return `<svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="${color}"/><circle cx="16" cy="16" r="6" fill="white" stroke="${color}" stroke-width="2"/></svg>`
}

/** The selected pickup-point pin: the same 32×40 shape in the brighter brand
    green with a white check mark inside — visually distinct from the plain
    green pickup pins on a multi-point map. */
export function selectedPinSvg(): string {
  return `<svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="${SELECTED_PIN_COLOR}"/><circle cx="16" cy="16" r="9" fill="white"/><path d="M11 16.5l3.2 3.2L21 13" stroke="${SELECTED_PIN_COLOR}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
}

/** "Location not included" pin: red body with a white × — shown when the
    traveller's searched/dragged pickup location falls outside the supplier's
    pickup zones or points. */
export function errorPinSvg(): string {
  return `<svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="#dc2626"/><circle cx="16" cy="16" r="7" fill="#fff"/><path d="M12.5 12.5l7 7M19.5 12.5l-7 7" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/></svg>`
}

/** Encodes a marker SVG into a data URI usable as a Google Maps Marker icon. */
export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** Builds a MapLibre marker element showing the pin in the given colour. */
export function maplibrePinEl(color: string): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'maplibregl-marker'
  el.innerHTML = pinSvg(color)
  el.style.cursor = 'pointer'
  return el
}

/**
 * Marker element for pickup/meeting point pins with a pulsating glow halo
 * (the `.pin-glow` animation from index.css, tinted with --pin-color).
 * Works as the `element` for both Mapbox GL and MapLibre markers.
 *
 * `variant: 'error'` renders the red "location not included" pin (with ×)
 * instead of the plain coloured pin, keeping the same glow halo.
 */
export function pulsingPinElement(color: string, cursor = 'pointer', variant: 'default' | 'error' = 'default'): HTMLDivElement {
  const el = document.createElement('div')
  // Both engine marker classes provide the same absolute positioning. The
  // position MUST be explicit inline: `relative` would keep each marker in
  // the canvas container's normal flow, so the 2nd+ markers stack below the
  // first (offset by a multiple of the pin's ~40px height) and every pin
  // lands displaced from its real coordinate, carrying its glow with it.
  el.className = 'maplibregl-marker mapboxgl-marker'
  el.style.cssText = `position: absolute; top: 0; left: 0; cursor: ${cursor};`
  const glow = document.createElement('span')
  glow.className = 'pin-glow'
  glow.style.setProperty('--pin-color', variant === 'error' ? '#dc2626' : color)
  const pin = document.createElement('div')
  pin.className = 'map-pin-body'
  pin.innerHTML = variant === 'error' ? errorPinSvg() : pinSvg(color)
  pin.style.cssText = 'position: relative; z-index: 1; pointer-events: auto;'
  el.appendChild(glow)
  el.appendChild(pin)
  return el
}

/**
 * Marker element for the SELECTED pickup point: the bright green check-mark
 * pin with the same pulsating glow halo (--pin-color = SELECTED_PIN_COLOR).
 * Used on multi-point maps so the traveller's choice stands out from the
 * plain green pickup pins. The `.map-pin-body` class lets the map swap the
 * pin artwork in place when the selection changes.
 */
export function selectedPinElement(cursor = 'pointer'): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'maplibregl-marker mapboxgl-marker'
  el.style.cssText = `position: absolute; top: 0; left: 0; cursor: ${cursor};`
  const glow = document.createElement('span')
  glow.className = 'pin-glow'
  glow.style.setProperty('--pin-color', SELECTED_PIN_COLOR)
  const pin = document.createElement('div')
  pin.className = 'map-pin-body'
  pin.innerHTML = selectedPinSvg()
  pin.style.cssText = 'position: relative; z-index: 1; pointer-events: auto;'
  el.appendChild(glow)
  el.appendChild(pin)
  return el
}

/** Creates a MapLibre map in the given container, or null if WebGL/style
    initialization throws synchronously (the caller then shows a fallback). */
export function createMapLibreMap(
  container: HTMLElement,
  options: Omit<maplibregl.MapOptions, 'container'> = {},
): maplibregl.Map | null {
  try {
    return new maplibregl.Map({ container, ...options })
  } catch {
    return null
  }
}

/** Pans/zooms the map so every point is visible; falls back to Accra. */
export function fitMapToPoints(map: maplibregl.Map, points: MapPoint[], padding = 48): void {
  if (points.length === 0) {
    map.setCenter([-0.187, 5.6037])
    map.setZoom(6)
    return
  }
  if (points.length === 1) {
    map.setCenter([points[0].lng, points[0].lat])
    map.setZoom(13)
    return
  }
  const bounds = new maplibregl.LngLatBounds()
  for (const p of points) bounds.extend([p.lng, p.lat])
  map.fitBounds(bounds, { padding, maxZoom: 15 })
}

/** GeoJSON FeatureCollection for a route polyline ([lon, lat] pairs — the
    GeoJSON coordinate order the Geoapify/Mapbox routing APIs return). */
export function routeToFeatureCollection(route: { geometry: [number, number][] }): {
  type: 'FeatureCollection'
  features: {
    type: 'Feature'
    properties: Record<string, never>
    geometry: { type: 'LineString'; coordinates: [number, number][] }
  }[]
} {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: route.geometry,
        },
      },
    ],
  }
}

/** Small blue dot for the route ORIGIN (the traveller's starting point),
    visually distinct from the destination's selected green pin. */
export function routeOriginMarkerElement(): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'maplibregl-marker mapboxgl-marker'
  el.style.cssText = 'position: absolute; top: 0; left: 0; cursor: default;'
  el.innerHTML =
    '<div style="width:16px;height:16px;border-radius:9999px;background:#2563eb;' +
    'border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);"></div>'
  return el
}

/** GeoJSON FeatureCollection from polygon rings ordered as [lat, lng]. */
export function ringsToFeatureCollection(rings: [number, number][][]): {
  type: 'FeatureCollection'
  features: {
    type: 'Feature'
    properties: Record<string, never>
    geometry: { type: 'Polygon'; coordinates: [number, number][][] }
  }[]
} {
  return {
    type: 'FeatureCollection',
    features: rings.map((ring) => ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [ring.map(([lat, lng]) => [lng, lat])],
      },
    })),
  }
}

export interface GeoCamera {
  center?: [number, number]
  zoom?: number
  bounds?: maplibregl.LngLatBounds
  padding?: number
  maxZoom?: number
}

/**
 * Camera for the booking pickup map: fits every zone/exclusion ring and point,
 * zooms to 13 for a lone coordinate, and falls back to the platform origin.
 * Mirrors the supplier dashboard's cameraFromGeoshape.
 */
export function cameraFromGeoData(options: {
  zones: [number, number][][]
  rings: [number, number][][]
  points: MapPoint[]
  userPoint?: { lat: number; lng: number } | null
}): GeoCamera {
  const coords: [number, number][] = []
  const push = (lat: number, lng: number): void => {
    if (Number.isFinite(lat) && Number.isFinite(lng)) coords.push([lat, lng])
  }
  for (const ring of options.zones) for (const [lat, lng] of ring) push(lat, lng)
  for (const ring of options.rings) for (const [lat, lng] of ring) push(lat, lng)
  for (const p of options.points) push(p.lat, p.lng)
  if (options.userPoint) push(options.userPoint.lat, options.userPoint.lng)

  if (coords.length === 0) return { center: DEFAULT_CENTER, zoom: 6 }
  const [firstLat, firstLng] = coords[0]
  const lone = coords.every(
    ([lat, lng]) => Math.abs(lat - firstLat) < 1e-6 && Math.abs(lng - firstLng) < 1e-6,
  )
  if (lone) return { center: [firstLng, firstLat], zoom: 13 }

  const bounds = new maplibregl.LngLatBounds()
  for (const [lat, lng] of coords) bounds.extend([lng, lat])
  return { bounds, padding: 50, maxZoom: 15 }
}

/** The traveller's chosen pickup point (a designated tour point). */
export interface SelectedPoint {
  lat: number
  lng: number
  label?: string | null
}

/**
 * True when a tour pin is the traveller's selected pickup point. Matches by
 * label first (what the pin tooltip shows), then falls back to a tight
 * coordinate check (~10 m) so selection still highlights the right pin even
 * when label strings drift (empty/whitespace names, address fallbacks).
 */
export function pinMatchesSelection(
  pin: { lat: number; lng: number; label?: string | null },
  selected?: SelectedPoint | null,
): boolean {
  if (!selected) return false
  if (pin.label && selected.label && pin.label === selected.label) return true
  const dLat = Math.abs(pin.lat - selected.lat)
  const dLng = Math.abs(pin.lng - selected.lng)
  return dLat < 1e-4 && dLng < 1e-4
}