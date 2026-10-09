/**
 * Client wrapper for the storefront's own `/api/maps-search` route (SerpApi
 * Google Maps search, Ghana-only). The SerpApi key lives server-side in the
 * Vercel middleware — the browser never talks to SerpApi directly (it has no
 * CORS support).
 *
 * Results are LRU-cached per query + tour area so re-running the same search
 * (or re-opening the dropdown) never spends another SerpApi credit.
 */

export interface GhanaMapPlace {
  title: string
  address: string
  lat: number
  lng: number
  placeId: string | null
}

export type GhanaSearchStatus = 'ok' | 'empty' | 'not_configured' | 'quota' | 'unavailable'

export interface GhanaSearchOutcome {
  status: GhanaSearchStatus
  results: GhanaMapPlace[]
}

const MAX_CACHE_SIZE = 50
const cache = new Map<string, GhanaMapPlace[]>()

/** Clears the in-memory cache (tests, sign-out, forced refresh). */
export function clearSerpApiMapsCache(): void {
  cache.clear()
}

function cacheKey(query: string, origin?: { lat: number; lng: number } | null): string {
  const area = origin ? `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}` : ''
  return `${query.trim().toLowerCase()}|${area}`
}

function getCached(key: string): GhanaMapPlace[] | null {
  const hit = cache.get(key)
  if (!hit) return null
  // Refresh LRU position.
  cache.delete(key)
  cache.set(key, hit)
  return hit
}

function setCached(key: string, places: GhanaMapPlace[]): void {
  if (cache.has(key)) {
    cache.delete(key)
  } else if (cache.size >= MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(key, places)
}

function isPlace(value: unknown): value is GhanaMapPlace {
  if (!value || typeof value !== 'object') return false
  const place = value as Record<string, unknown>
  return (
    typeof place.title === 'string' &&
    typeof place.lat === 'number' &&
    typeof place.lng === 'number' &&
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lng)
  )
}

/**
 * Searches Google Maps (via our server route) for places matching `query`,
 * biased to the tour's area. Never throws — callers switch on `status` to
 * show results or a graceful fallback message.
 */
export async function searchGhanaLocations(
  query: string,
  origin?: { lat: number; lng: number } | null,
): Promise<GhanaSearchOutcome> {
  const q = query.trim()
  if (q.length < 3) return { status: 'empty', results: [] }

  const key = cacheKey(q, origin)
  const cached = getCached(key)
  if (cached) return { status: cached.length > 0 ? 'ok' : 'empty', results: cached }

  const params = new URLSearchParams({ q })
  if (origin) {
    params.set('lat', String(origin.lat))
    params.set('lng', String(origin.lng))
  }

  let response: Response
  try {
    response = await fetch(`/api/maps-search?${params.toString()}`, {
      headers: { accept: 'application/json' },
    })
  } catch {
    return { status: 'unavailable', results: [] }
  }

  if (!response.ok) {
    return { status: response.status === 429 ? 'quota' : 'unavailable', results: [] }
  }

  const body = (await response.json().catch(() => null)) as
    | { ok?: boolean; reason?: string; results?: unknown }
    | null
  if (!body || body.ok !== true) {
    const reason = typeof body?.reason === 'string' ? body.reason : ''
    const status: GhanaSearchStatus =
      reason === 'quota' ? 'quota' : reason === 'not_configured' ? 'not_configured' : 'unavailable'
    return { status, results: [] }
  }

  const results = Array.isArray(body.results) ? body.results.filter(isPlace) : []
  setCached(key, results)
  return { status: results.length > 0 ? 'ok' : 'empty', results }
}
