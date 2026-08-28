/**
 * Geographic helpers for pickup geoshapes (GetYourGuide-style service zones).
 *
 * A pickup geoshape is a closed polygon (ordered [lat, lng] vertices) that
 * defines where a supplier offers area-based pickup. Customers pick an
 * address at checkout; the address is valid only if it falls inside one of
 * the supplier's polygons and outside every exclusion zone.
 *
 * This is a 1:1 TypeScript port of the backend's
 * Travio Ghana-Backend-v2/utils/geoUtils.js — client feedback and the
 * server verdict must never disagree.
 */

/**
 * Radius (meters) around a location-only pickup area (saved as a point, no
 * drawn geoshape) within which a customer address is considered inside the
 * area. Must match the backend's LOCATION_AREA_RADIUS_M in geoUtils.js
 * (1000 m) — it is the DEFAULT used when the area doesn't carry its own
 * radiusKm. The storefront verdict and the server verdict must never
 * disagree: a client-side 5 km default would bless addresses the server
 * rejects at booking.
 */
export const LOCATION_AREA_RADIUS_M = 1000

/**
 * The effective geofence radius for a location-only area: the supplier's
 * configured `radiusKm` when present (e.g. "Oasis Park Residences, 15" is a
 * 15km zone), falling back to LOCATION_AREA_RADIUS_M for areas without one.
 * Mirrors the backend exactly (Number.isFinite(radiusKm) ? radiusKm * 1000
 * : LOCATION_AREA_RADIUS_M) so the checkout verdict never disagrees with
 * the server's.
 */
export function locationAreaRadiusM(area: PickupAreaShape): number {
  const km = area?.radiusKm
  return Number.isFinite(km) ? (km as number) * 1000 : LOCATION_AREA_RADIUS_M
}

export type LatLng = [number, number]

export interface PickupAreaShape {
  name?: string
  /** Pickup reference window for this area, e.g. '0-45'. */
  time?: string
  address?: string
  lat?: number | null
  lng?: number | null
  /** Ordered [lat, lng] vertices of the drawn service zone. */
  polygon?: LatLng[] | null
  /** Drawn exclusion zones (each an ordered [lat, lng] polygon). */
  exclusions?: LatLng[][] | null
  /** Geofence radius (km) for a location-only area (no drawn geoshape). */
  radiusKm?: number | null
}

export interface PickupLocationShape {
  name?: string
  address?: string
  lat?: number | null
  lng?: number | null
}

/** A matched area, flagged when the address falls inside one of its exclusion zones. */
export type PickupZoneMatch = PickupAreaShape & { _excluded?: true }

/**
 * Generates a closed [lat, lng] ring approximating a circle of `radiusM`
 * metres around a centre point (destination-point formula, so the ring stays
 * accurate at any latitude). Used to visualise the geofence of location-only
 * pickup areas, which are validated as a circle of LOCATION_AREA_RADIUS_M.
 */
export function circleRing(lat: number, lng: number, radiusM: number, segments = 64): LatLng[] {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI
  const angular = radiusM / R
  const lat1 = toRad(lat)
  const lng1 = toRad(lng)
  const ring: LatLng[] = []
  for (let i = 0; i < segments; i += 1) {
    const bearing = (2 * Math.PI * i) / segments
    const sinLat = Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing)
    const pLat = Math.asin(sinLat)
    const pLng = lng1 + Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * sinLat,
    )
    ring.push([toDeg(pLat), toDeg(pLng)])
  }
  // Close the ring so GeoJSON polygon rendering never leaves a gap.
  ring.push(ring[0])
  return ring
}

/**
 * All drawable pickup-zone rings for a tour: the drawn polygons, plus a
 * LOCATION_AREA_RADIUS_M circle around a location-only area (saved as a point
 * with coordinates but no drawn geoshape). The circle is only drawn when the
 * location-only area is the tour's ONE pickup spot — i.e. there are no other
 * pickup areas and no separate pickup locations (pass their count via
 * `locationSpots`). With multiple pickup locations the green pins represent
 * each spot and a geofence blob around one of them would be misleading.
 * Drawn polygons always render.
 */
export function pickupZoneRings(
  areas?: (PickupAreaShape | null | undefined)[],
  locationSpots = 0,
): LatLng[][] {
  const list = Array.isArray(areas) ? areas.filter((a): a is PickupAreaShape => !!a) : []
  const rings: LatLng[][] = []
  for (const area of list) {
    if (hasDrawnShape(area)) {
      rings.push(area.polygon as LatLng[])
    }
  }
  const totalSpots = list.length + locationSpots
  if (totalSpots === 1 && hasLocationOnlyAreas(list)) {
    const area = list[0]
    // Draw the circle at the area's configured radius (radiusKm) so the map
    // matches the validation verdict — never a mismatched fixed size.
    rings.push(circleRing(area.lat as number, area.lng as number, locationAreaRadiusM(area)))
  }
  return rings
}

/**
 * Ray-casting point-in-polygon test.
 * @param lat point latitude
 * @param lng point longitude
 * @param polygon ordered [lat, lng] vertices
 */
export function pointInPolygon(lat: number, lng: number, polygon: LatLng[]): boolean {
  if (!Array.isArray(polygon) || polygon.length < 3) return false

  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [, lngI] = polygon[i]
    const [latI] = polygon[i]
    const [, lngJ] = polygon[j]
    const [latJ] = polygon[j]
    const intersect =
      latI > lat !== latJ > lat &&
      lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI
    if (intersect) inside = !inside
  }
  return inside
}

/**
 * Haversine distance in meters between two points.
 */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

const NORMALIZE_NAME = (v: unknown) => String(v || '').trim().toLowerCase()

export function hasDrawnShape(area: PickupAreaShape): boolean {
  return Array.isArray(area.polygon) && area.polygon.length >= 3
}

/**
 * Resolve whether an address falls inside any area of a geoshape and outside
 * all of its exclusion zones.
 *
 * Mirrors the backend precedence exactly: areas are evaluated in array
 * order and the first match wins; an address inside an exclusion zone of a
 * matching area returns that area flagged `_excluded`.
 *
 * @returns matching area, or null when no area matches
 */
export function findPickupAreaForAddress(
  address: { lat: number; lng: number; name?: string },
  pickupAreas: PickupAreaShape[],
): PickupZoneMatch | null {
  if (!Array.isArray(pickupAreas) || !address || !Number.isFinite(address.lat) || !Number.isFinite(address.lng)) {
    return null
  }

  for (const area of pickupAreas) {
    if (!hasDrawnShape(area)) {
      // Legacy area without a drawn geoshape: match the saved location
      // point by proximity (honouring the area's configured radiusKm), or
      // fall back to the old exact-name match for areas without coordinates
      // so pre-geoshape products keep working.
      const aLat = typeof area.lat === 'number' ? area.lat : NaN
      const aLng = typeof area.lng === 'number' ? area.lng : NaN
      if (Number.isFinite(aLat) && Number.isFinite(aLng) && distanceMeters(address.lat, address.lng, aLat, aLng) <= locationAreaRadiusM(area)) {
        return area
      }
      if (NORMALIZE_NAME(address.name) === NORMALIZE_NAME(area.name)) return area
      continue
    }

    if (!pointInPolygon(address.lat, address.lng, area.polygon as LatLng[])) continue

    // Inside the service zone — reject addresses inside any exclusion zone.
    const excludedBy = (area.exclusions || []).find(
      (exclusion) => Array.isArray(exclusion) && pointInPolygon(address.lat, address.lng, exclusion),
    )
    if (excludedBy) return { ...area, _excluded: true }

    return area
  }

  return null
}

export type PickupZoneStatus = 'in_area' | 'excluded' | 'outside' | 'no_coords' | 'no_zones' | 'none'

/**
 * Status of a customer address against the tour's pickup areas, for live
 * checkout feedback.
 */
export function pickupZoneStatus(
  address: { name?: string; lat: number | null; lng: number | null } | null | undefined,
  pickupAreas: PickupAreaShape[],
): PickupZoneStatus {
  const areas = Array.isArray(pickupAreas) ? pickupAreas : []
  if (!address || address.lat == null || address.lng == null || !Number.isFinite(address.lat) || !Number.isFinite(address.lng)) {
    return 'no_coords'
  }
  if (areas.length === 0) return 'no_zones'
  const match = findPickupAreaForAddress({ lat: address.lat, lng: address.lng, name: address.name }, areas)
  if (!match) return 'outside'
  return match._excluded ? 'excluded' : 'in_area'
}

/**
 * True when the tour has any location-only pickup area — saved as a point
 * with coordinates but no drawn geoshape (the proximity-match mode).
 */
export function hasLocationOnlyAreas(areas: PickupAreaShape[]): boolean {
  return Array.isArray(areas) && areas.some(
    (a) => !hasDrawnShape(a) && typeof a.lat === 'number' && typeof a.lng === 'number' &&
      Number.isFinite(a.lat) && Number.isFinite(a.lng),
  )
}

/**
 * The checkout "pickup location" completeness rule, shared by the step UI
 * and its validation gate.
 *
 * A location is satisfied when the traveller defers it, picks a named zone,
 * or their address resolves in a pickup area. Tours with no geographic data
 * at all (no drawn zones, no location-only points) keep the legacy rule
 * where any typed text of 3+ characters counts, so old name-only products
 * keep working.
 */
export interface PickupLocationInputState {
  pickupLater: boolean
  pickedArea: string
  typed: string
  status: PickupZoneStatus
  zonesDrawn: boolean
  hasLocationOnlyAreas: boolean
}

export function isPickupLocationSatisfied(state: PickupLocationInputState): boolean {
  if (state.pickupLater) return true
  if (state.pickedArea.trim().length > 0) return true
  if (state.status === 'in_area') return true
  if (!state.zonesDrawn && !state.hasLocationOnlyAreas && state.typed.trim().length >= 3) return true
  return false
}