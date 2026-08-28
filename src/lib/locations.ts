import { fetchWithAuth } from './api'

export interface ReverseGeocodeResult {
  formatted: string
  latitude: number | null
  longitude: number | null
  city: string
  country: string
  region: string
}

export interface NearbyPlace {
  name: string
  lat: number | null
  lng: number | null
  category: string | null
}

/**
 * Reverse-geocodes a [lat, lng] pair through the backend location service
 * (GET /api/locations/reverse — geoapify → nominatim → photon fallback),
 * mirroring the supplier platform's LocationMapPicker.
 *
 * Returns the first normalized result, or null when the lookup fails or
 * returns nothing. Callers fall back to a bare coordinate string.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  try {
    const res = await fetchWithAuth(
      `/locations/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
    )
    if (!res.ok) return null
    const body = await res.json().catch(() => null)
    const first = body?.data?.results?.[0]
    if (!first) return null
    return {
      formatted: typeof first.formatted === 'string' ? first.formatted : '',
      latitude: typeof first.latitude === 'number' ? first.latitude : null,
      longitude: typeof first.longitude === 'number' ? first.longitude : null,
      city: typeof first.city === 'string' ? first.city : '',
      country: typeof first.country === 'string' ? first.country : '',
      region: typeof first.region === 'string' ? first.region : '',
    }
  } catch {
    return null
  }
}

/**
 * Finds named places (cafes, hotels, monuments, ...) around a coordinate via
 * the backend location service (GET /api/locations/nearby — Geoapify → Overpass
 * fallback). Used to anchor a traveller's exact pickup spot on the map.
 */
export async function fetchNearbyPlaces(
  lat: number,
  lng: number,
  radiusKm = 3,
): Promise<NearbyPlace[]> {
  try {
    const res = await fetchWithAuth(
      `/locations/nearby?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}` +
        `&radius=${encodeURIComponent(String(radiusKm))}&categories=cafe,hotel,monument,restaurant`,
    )
    if (!res.ok) return []
    const body = await res.json().catch(() => null)
    const results = Array.isArray(body?.data?.results) ? body.data.results : []
    return results
      .map((r: Record<string, unknown>) => ({
        name: typeof r?.formatted === 'string' ? r.formatted : '',
        lat: typeof r?.latitude === 'number' ? r.latitude : null,
        lng: typeof r?.longitude === 'number' ? r.longitude : null,
        category: typeof r?.category === 'string' ? r.category : null,
      }))
      .filter((p: NearbyPlace) => p.name && p.lat != null && p.lng != null)
      .slice(0, 10)
  } catch {
    return []
  }
}