import type { LatLng } from './drivingEta'
import { getGeoapifyApiKey } from './geoapify'

/** Direction mode supported by the Geoapify routing API. */
export type RouteMode = 'drive' | 'walk'

/** One turn-by-turn step of a route (Geoapify `instruction` is HTML). */
export interface RouteStep {
  instruction: string
  distanceM: number
  durationSec: number
  mode: string
}

/** A fetched route: polyline ([lon, lat] pairs) + summary + turn-by-turn steps. */
export interface GeoapifyRoute {
  geometry: [number, number][]
  distanceM: number
  durationSec: number
  steps: RouteStep[]
}

interface GeoapifyRouteStep {
  instruction?: unknown
  distance?: unknown
  time?: unknown
  mode?: unknown
}

/**
 * Fetches driving/walking directions between two points from the Geoapify
 * Routing API (`https://api.geoapify.com/v1/routing`). Geoapify returns a
 * GeoJSON Feature whose geometry is the route LineString ([lon, lat] pairs)
 * and whose properties carry the total distance/time plus per-leg turn-by-turn
 * steps — so the result renders natively on the MapLibre map.
 *
 * Returns null on any failure (no key, network error, non-OK response, or an
 * empty route) so the caller can degrade to the map deep-links.
 */
export async function fetchGeoapifyRoute(
  from: LatLng,
  to: LatLng,
  mode: RouteMode = 'drive',
): Promise<GeoapifyRoute | null> {
  const apiKey = getGeoapifyApiKey()
  if (!apiKey) return null
  const url =
    'https://api.geoapify.com/v1/routing' +
    `?waypoints=${from.lng},${from.lat}|${to.lng},${to.lat}` +
    `&mode=${mode}&format=geojson&apiKey=${encodeURIComponent(apiKey)}`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const body = await res.json().catch(() => null)
    const feature = body?.features?.[0]
    const coords = feature?.geometry?.coordinates
    if (!Array.isArray(coords) || coords.length < 2) return null
    const props = feature?.properties ?? {}
    const rawSteps: GeoapifyRouteStep[] = Array.isArray(props.legs)
      ? props.legs.flatMap((leg: unknown) => {
          const steps = (leg as { steps?: GeoapifyRouteStep[] })?.steps
          return Array.isArray(steps) ? steps : []
        })
      : []
    return {
      geometry: coords as [number, number][],
      distanceM: Number(props.distance) || 0,
      durationSec: Number(props.time) || 0,
      steps: rawSteps.map((s) => ({
        instruction: typeof s.instruction === 'string' ? s.instruction : '',
        distanceM: Number(s.distance) || 0,
        durationSec: Number(s.time) || 0,
        mode: typeof s.mode === 'string' ? s.mode : mode,
      })),
    }
  } catch {
    return null
  }
}

/** "45 min" / "1 h 15 min" — a route duration in seconds → readable label. */
export function formatRouteDuration(seconds: number): string {
  const total = Math.max(1, Math.round(seconds / 60))
  if (total < 60) return `${total} min`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/** "800 m" / "5.2 km" — a route distance in metres → readable label. */
export function formatRouteDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

/** Google Maps turn-by-turn deep link. Origin is optional (Maps then asks for
    a starting point when it is omitted). */
export function googleMapsDirectionsUrl(origin: LatLng | null, dest: LatLng, mode: RouteMode): string {
  const travelmode = mode === 'walk' ? 'walking' : 'driving'
  const base = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=${travelmode}`
  return origin ? `${base}&origin=${origin.lat},${origin.lng}` : base
}

/** Apple Maps turn-by-turn deep link. */
export function appleMapsDirectionsUrl(origin: LatLng | null, dest: LatLng): string {
  const base = `http://maps.apple.com/?daddr=${dest.lat},${dest.lng}`
  return origin ? `${base}&saddr=${origin.lat},${origin.lng}` : base
}
