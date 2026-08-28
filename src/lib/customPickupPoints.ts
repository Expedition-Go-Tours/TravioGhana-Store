import { distanceMeters, hasDrawnShape, hasLocationOnlyAreas, pickupZoneStatus, type PickupAreaShape } from './pickupZone'

/**
 * Pure helpers for the "double-click to add a pickup spot" feature. The
 * booking map (Google/Mapbox/MapLibre) fires a double-click at a spot inside a
 * pickup zone; these helpers decide whether the spot is admissible (inside a
 * drawn zone — or a location-only area's geofence circle — respecting
 * exclusions) and whether it duplicates an already added custom point.
 */

export type CustomPointStatus = 'in_zone' | 'outside' | 'no_zones'

/**
 * Whether a double-clicked spot may be added as a custom pickup location.
 *
 * Tours with a drawn geoshape require the spot to fall inside a pickup zone
 * (and outside every exclusion); location-only areas (a saved point, no
 * polygon) are geofenced to their LOCATION_AREA_RADIUS_M circle, matching the
 * green area the map draws. Tours with no geographic data at all allow any
 * spot.
 */
export function customPointStatus(lat: number, lng: number, areas: PickupAreaShape[]): CustomPointStatus {
  const list = Array.isArray(areas) ? areas : []
  const zonesDrawn = list.some(hasDrawnShape)
  if (!zonesDrawn && !hasLocationOnlyAreas(list)) return 'no_zones'
  const status = pickupZoneStatus({ name: '', lat, lng }, list)
  return status === 'in_area' ? 'in_zone' : 'outside'
}

/** Radius (meters) within which a double-click counts as an existing custom point. */
export const CUSTOM_POINT_DEDUPE_RADIUS_M = 50

/**
 * True when a spot is within `radiusM` of an already-added custom point
 * (prevents stacking identical pins from repeat double-clicks).
 */
export function isDuplicateCustomPoint(
  lat: number,
  lng: number,
  points: { lat: number | null; lng: number | null }[],
  radiusM = CUSTOM_POINT_DEDUPE_RADIUS_M,
): boolean {
  return (Array.isArray(points) ? points : []).some(
    (p) =>
      typeof p?.lat === 'number' &&
      typeof p?.lng === 'number' &&
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng) &&
      distanceMeters(lat, lng, p.lat, p.lng) <= radiusM,
  )
}
