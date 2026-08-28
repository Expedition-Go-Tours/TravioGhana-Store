import type { LocationResult } from '../hooks/useLocationAutocomplete'

/** The Geoapify geocoding API key — VITE_GEOAPIFY_API_KEY from .env. */
export function getGeoapifyApiKey(): string {
  return (import.meta.env.VITE_GEOAPIFY_API_KEY as string | undefined)?.trim() || ''
}

interface GeoapifyFeature {
  properties?: {
    formatted?: string
    name?: string
    city?: string
    town?: string
    village?: string
    county?: string
    country?: string
    country_code?: string
    state?: string
    district?: string
    region?: string
    postcode?: string
    street?: string
    address_line1?: string
    housenumber?: string
    category?: string
    rank?: { confidence?: number }
  }
  geometry?: { coordinates?: [number, number] }
}

function fromGeoapify(feature: GeoapifyFeature | null | undefined): LocationResult | null {
  if (!feature || !feature.properties) return null
  const p = feature.properties
  const coords = feature.geometry?.coordinates
  // A suggestion without coordinates is useless for the picker (it must pin
  // on the map) — drop it.
  if (!coords || coords[0] == null || coords[1] == null) return null
  return {
    formatted: p.formatted || p.name || '',
    latitude: coords[1],
    longitude: coords[0],
    city: p.city || p.town || p.village || p.county || '',
    country: p.country || '',
    countryCode: p.country_code || '',
    region: p.state || p.district || p.region || '',
    postcode: p.postcode || null,
    street: p.street || p.address_line1 || '',
    housenumber: p.housenumber || null,
    category: p.category || null,
    source: 'geoapify',
    confidence: p.rank?.confidence ?? null,
  }
}

/**
 * Client-side Geoapify autocomplete for the booking location picker —
 * the PRIMARY search source (Geoapify first). The API is CORS-enabled
 * (Access-Control-Allow-Origin: *) so it works straight from the browser.
 *
 * Returns [] on any failure (no key, network, rate limit) so the caller can
 * fall back to the backend location service.
 */
export async function geoapifyAutocomplete(query: string, limit = 5): Promise<LocationResult[]> {
  const apiKey = getGeoapifyApiKey()
  if (!apiKey) return []

  const url =
    'https://api.geoapify.com/v1/geocode/autocomplete' +
    `?text=${encodeURIComponent(query)}&apiKey=${encodeURIComponent(apiKey)}` +
    `&limit=${limit}&format=geojson`

  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const body = (await res.json()) as { features?: GeoapifyFeature[] } | null
    if (!body || !Array.isArray(body.features)) return []
    return body.features.map(fromGeoapify).filter((r): r is LocationResult => r !== null)
  } catch {
    return []
  }
}
