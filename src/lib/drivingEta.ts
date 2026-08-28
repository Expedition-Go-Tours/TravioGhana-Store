import { getMapboxToken } from './mapbox'
import { distanceMeters } from './pickupZone'

export interface DrivingEta {
  minutes: number
  km: number
}

export interface LatLng {
  lat: number
  lng: number
}

/** Driving time/distance between two points via the Mapbox Directions API
    (uses the configured VITE_MAPBOX_ACCESS_TOKEN). Returns null when the
    token is missing, the request fails, or no route is returned. */
export async function fetchDrivingEta(from: LatLng, to: LatLng): Promise<DrivingEta | null> {
  const token = getMapboxToken()
  if (!token) return null
  try {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?access_token=${encodeURIComponent(token)}&overview=false&steps=false`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    const route = data?.routes?.[0]
    if (!route) return null
    return {
      minutes: Math.max(1, Math.round((Number(route.duration) || 0) / 60)),
      km: (Number(route.distance) || 0) / 1000,
    }
  } catch {
    return null
  }
}

/** Straight-line (haversine) distance in kilometres between two points. */
export function straightLineKm(from: LatLng, to: LatLng): number {
  return distanceMeters(from.lat, from.lng, to.lat, to.lng) / 1000
}

/** Rough driving-time estimate from straight-line distance (~35 km/h average
    city driving), used as a fallback when the routing API is unavailable. */
export function estimateDrivingMinutes(km: number): number {
  return Math.max(1, Math.round((km / 35) * 60))
}

/** "45 min" / "1 h 15 min" / "2 h" — travel time in hours and minutes. */
export function formatDurationHM(minutes: number): string {
  const total = Math.max(1, Math.round(minutes))
  if (total < 60) return `${total} min`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}
