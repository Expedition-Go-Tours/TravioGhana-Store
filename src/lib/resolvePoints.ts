import { fetchWithAuth } from './api'
import { toNumber } from './mapUtils'
import type { PickupAreaShape } from './pickupZone'

/**
 * Resolves every meeting/pickup coordinate of a tour into exact lat/lng —
 * the "geocode pipeline". Supplier configs frequently carry only a name or
 * address for pickup points/areas/meeting points; the map needs coordinates.
 *
 * Missing coordinates are forward-geocoded through the backend location
 * service (GET /api/locations/search — Nominatim-backed), never by calling
 * Nominatim directly from the client. Results are LRU-cached so re-opening
 * the modal or re-rendering the step never re-queries.
 */

export interface ResolvedTourPoint {
  id: string
  kind: 'meeting' | 'zone' | 'point'
  name: string
  address: string
  lat: number | null
  lng: number | null
  time?: string
  polygon?: [number, number][]
  exclusions?: [number, number][][]
  /** Geofence radius (km) for a location-only pickup area (no drawn geoshape). */
  radiusKm?: number | null
  /** True when the point has no coordinates and geocoding failed/returned nothing. */
  unresolved?: boolean
  /** The name/address string used for geocoding (shown with the retry affordance). */
  query: string
}

/** The slice of the tour the resolver needs (structural subset of PickupZoneMapTour). */
export interface ResolveTourSource {
  meetingMode?: 'meeting_point' | 'pickup' | 'none'
  meetingPoint?: string
  meetingPointAddress?: string
  meetingPointLat?: number | null
  meetingPointLng?: number | null
  pickupAreas?: (PickupAreaShape | null | undefined)[]
  pickupLocations?: { name?: string; address?: string; lat?: number | null; lng?: number | null }[]
}

interface GeocodeEntry {
  lat: number | null
  lng: number | null
  formatted: string
}

const MAX_CACHE_SIZE = 100
const cache = new Map<string, GeocodeEntry>()

function getCached(query: string): GeocodeEntry | undefined {
  const key = query.trim().toLowerCase()
  if (!cache.has(key)) return undefined
  const entry = cache.get(key)!
  cache.delete(key)
  cache.set(key, entry)
  return entry
}

function setCached(query: string, entry: GeocodeEntry): void {
  const key = query.trim().toLowerCase()
  if (cache.has(key)) {
    cache.delete(key)
  } else if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value
    if (oldestKey) cache.delete(oldestKey)
  }
  cache.set(key, entry)
}

/** Clears the in-memory geocode cache (tests, sign-out, forced refresh). */
export function clearResolvedPointCache(): void {
  cache.clear()
}

async function fetchGeocode(query: string): Promise<GeocodeEntry | null> {
  const trimmed = query.trim()
  if (!trimmed) return null
  const cached = getCached(trimmed)
  if (cached) return cached

  try {
    const res = await fetchWithAuth(
      `/locations/search?q=${encodeURIComponent(trimmed)}&limit=1`,
    )
    if (!res.ok) return null
    const body = await res.json().catch(() => null)
    const first = body?.data?.results?.[0]
    const entry: GeocodeEntry = {
      lat: toNumber(first?.latitude),
      lng: toNumber(first?.longitude),
      formatted: typeof first?.formatted === 'string' ? first.formatted : trimmed,
    }
    setCached(trimmed, entry)
    return entry
  } catch {
    return null
  }
}

const pointQuery = (name: string, address: string): string => address?.trim() || name?.trim() || ''

function resolvePoint(
  kind: ResolvedTourPoint['kind'],
  index: number,
  name: string,
  address: string,
  latRaw: number | null | undefined,
  lngRaw: number | null | undefined,
  extra: Partial<ResolvedTourPoint> = {},
  geocoded?: GeocodeEntry | null,
): ResolvedTourPoint {
  const query = pointQuery(name || '', address || '')
  const lat = toNumber(latRaw)
  const lng = toNumber(lngRaw)
  const resolvedLat = lat ?? geocoded?.lat ?? null
  const resolvedLng = lng ?? geocoded?.lng ?? null
  return {
    id: `${kind}-${index}`,
    kind,
    name: name || '',
    address: geocoded?.formatted || address || '',
    lat: resolvedLat,
    lng: resolvedLng,
    unresolved: resolvedLat == null || resolvedLng == null,
    query,
    ...extra,
  }
}

/**
 * Builds the full list of meeting/pickup points for a tour, geocoding every
 * entry that lacks coordinates. Points with coordinates are returned as-is;
 * failed lookups stay in the list flagged `unresolved` so the UI can offer a
 * retry instead of silently dropping the point.
 */
export async function resolveTourPoints(tour: ResolveTourSource | null | undefined): Promise<ResolvedTourPoint[]> {
  const resolved: ResolvedTourPoint[] = []
  if (!tour || typeof tour !== 'object') return resolved

  // Infer the effective meeting mode from the data when the backend doesn't
  // set meetingMode explicitly.  This prevents the geocoding pipeline from
  // silently skipping every point when meetingMode is undefined.
  const hasMeetingData = !!(tour.meetingPoint || tour.meetingPointAddress || tour.meetingPointLat != null)
  const hasPickupData =
    (Array.isArray(tour.pickupAreas) && tour.pickupAreas.filter(Boolean).length > 0) ||
    (Array.isArray(tour.pickupLocations) && tour.pickupLocations.filter(Boolean).length > 0)
  const effectiveMode = tour.meetingMode
    ?? (hasMeetingData ? 'meeting_point' : hasPickupData ? 'pickup' : undefined)

  if (effectiveMode === 'meeting_point') {
    const name = tour.meetingPoint || ''
    const address = tour.meetingPointAddress || ''
    const geocoded = tour.meetingPointLat == null || tour.meetingPointLng == null
      ? await fetchGeocode(pointQuery(name, address))
      : undefined
    resolved.push(
      resolvePoint('meeting', 0, name, address, tour.meetingPointLat, tour.meetingPointLng, {}, geocoded),
    )
  }

  if (effectiveMode === 'pickup') {
    const areas = Array.isArray(tour.pickupAreas) ? tour.pickupAreas.filter(Boolean) : []
    const areaGeocodes = await Promise.all(
      areas.map((a) =>
        a!.lat == null || a!.lng == null
          ? fetchGeocode(pointQuery(a!.name || '', a!.address || ''))
          : Promise.resolve(undefined),
      ),
    )
    areas.forEach((area, i) => {
      if (!area) return
      const polygon = Array.isArray(area.polygon) && area.polygon.length >= 3
        ? (area.polygon as [number, number][])
        : undefined
      const exclusions = Array.isArray(area.exclusions)
        ? (area.exclusions as [number, number][][])
        : undefined
      resolved.push(
        resolvePoint('zone', i, area.name || '', area.address || '', area.lat, area.lng, {
          time: area.time,
          polygon,
          exclusions,
          radiusKm: area.radiusKm,
        }, areaGeocodes[i]),
      )
    })

    // Area-based pickup supersedes leftover specific pickup locations — when
    // areas exist, the location entries are stale and must not be resolved
    // (they'd otherwise render as extra pins / options alongside the zone).
    const locations = areas.length > 0
      ? []
      : Array.isArray(tour.pickupLocations) ? tour.pickupLocations.filter(Boolean) : []
    const locationGeocodes = await Promise.all(
      locations.map((l) =>
        l!.lat == null || l!.lng == null
          ? fetchGeocode(pointQuery(l!.name || '', l!.address || ''))
          : Promise.resolve(undefined),
      ),
    )
    locations.forEach((loc, i) => {
      if (!loc) return
      resolved.push(
        resolvePoint('point', i, loc.name || '', loc.address || '', loc.lat, loc.lng, {}, locationGeocodes[i]),
      )
    })
  }

  return resolved
}

/**
 * Merges the resolved points back into a tour-shaped object consumable by the
 * existing map components (buildTourPoints, PickupZoneMap, MapboxPickupMap) —
 * every entry now carries its exact lat/lng.
 */
export function resolvedPointsToTour(points: ResolvedTourPoint[], source: ResolveTourSource | null | undefined): ResolveTourSource {
  // Propagate the effective meeting mode so downstream consumers
  // (buildTourPoints, PickupZoneMap) don't need to re-infer it.
  const hasMeetingData = !!(source?.meetingPoint || source?.meetingPointAddress || source?.meetingPointLat != null)
  const hasPickupData =
    (Array.isArray(source?.pickupAreas) && source!.pickupAreas!.filter(Boolean).length > 0) ||
    (Array.isArray(source?.pickupLocations) && source!.pickupLocations!.filter(Boolean).length > 0)
  const effectiveMode = source?.meetingMode
    ?? (hasMeetingData ? 'meeting_point' : hasPickupData ? 'pickup' : undefined)

  const tour: ResolveTourSource = {
    meetingMode: effectiveMode,
    meetingPoint: source?.meetingPoint,
    meetingPointAddress: source?.meetingPointAddress,
  }
  for (const p of points) {
    if (p.kind === 'meeting') {
      tour.meetingPoint = p.name
      tour.meetingPointAddress = p.address
      tour.meetingPointLat = p.lat
      tour.meetingPointLng = p.lng
    }
  }
  const zones = points.filter((p) => p.kind === 'zone')
  const spots = points.filter((p) => p.kind === 'point')
  tour.pickupAreas = zones
    .filter((p) => p.lat != null || p.polygon)
    .map((p) => ({
      name: p.name || undefined,
      address: p.address || undefined,
      lat: p.lat,
      lng: p.lng,
      time: p.time,
      polygon: p.polygon,
      exclusions: p.exclusions,
      radiusKm: p.radiusKm,
    }))
  tour.pickupLocations = spots.map((p) => ({
    name: p.name || undefined,
    address: p.address || undefined,
    lat: p.lat,
    lng: p.lng,
  }))
  return tour
}
