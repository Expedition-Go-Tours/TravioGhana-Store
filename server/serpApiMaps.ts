/**
 * Server-side SerpApi Google Maps search for the booking pickup picker.
 *
 * SerpApi blocks browser calls (it does not send CORS headers) and the API key
 * must stay server-side, so this module runs inside the storefront's Vercel
 * middleware (see `middleware.ts`) and inside the Vite dev-server route
 * (`vite.config.ts`). The browser only ever talks to our own
 * `/api/maps-search` route.
 *
 * Everything here is dependency-free and works in both the DOM and Node type
 * environments, so the module can be imported from either runtime.
 *
 * SerpApi response notes (https://serpapi.com/google-maps-api):
 *  - a list query returns `local_results[]` with `gps_coordinates`, `address`,
 *    `country` and `place_id` per place;
 *  - a query that resolves to one specific place (e.g. a business name) comes
 *    back as a single `place_results` object instead — both shapes are read;
 *  - an empty Google Maps result set is still HTTP 200, with
 *    `search_information.local_results_state: "Fully empty"`;
 *  - errors surface as `search_metadata.status: "Error"` + a top-level
 *    `error` string, or as 401 (bad key) / 429 (quota or throughput).
 */

export interface GhanaMapPlace {
  title: string
  address: string
  lat: number
  lng: number
  placeId: string | null
}

export type MapsSearchFailure = 'not_configured' | 'quota' | 'upstream'

export type MapsSearchResult =
  | { ok: true; results: GhanaMapPlace[] }
  | { ok: false; reason: MapsSearchFailure }

export const SERPAPI_SEARCH_ENDPOINT = 'https://serpapi.com/search.json'

/** Fallback search origin (Accra) when a tour has no coordinates of its own. */
export const DEFAULT_GHANA_ORIGIN = { lat: 5.6037, lng: -0.187 } as const
const MAPS_ZOOM = 12
const TIMEOUT_MS = 8000
const MAX_RESULTS = 5

interface SerpApiLocalResult {
  title?: string
  address?: string
  country?: string
  gps_coordinates?: { latitude?: number; longitude?: number }
  place_id?: string
}

interface SerpApiResponse {
  error?: string
  local_results?: SerpApiLocalResult[]
  /** A query that resolves to one specific place returns this instead. */
  place_results?: SerpApiLocalResult
  search_information?: { local_results_state?: string }
  search_metadata?: { status?: string }
}

/** Ghana-only filter: keep Ghana-labelled results and unlabelled ones. */
export function isGhanaResult(result: SerpApiLocalResult): boolean {
  const country = (result.country || '').trim().toLowerCase()
  return country.length === 0 || country === 'ghana'
}

/**
 * Normalizes SerpApi results into the picker's place shape — reading the
 * `local_results` list, or the single `place_results` object Google returns
 * when the query names one specific place.
 */
export function normalizeResults(body: SerpApiResponse | null | undefined): GhanaMapPlace[] {
  const local = Array.isArray(body?.local_results) ? body.local_results : []
  const list = local.length > 0 ? local : body?.place_results ? [body.place_results] : local
  const places: GhanaMapPlace[] = []
  for (const result of list) {
    const lat = result?.gps_coordinates?.latitude
    const lng = result?.gps_coordinates?.longitude
    if (typeof lat !== 'number' || typeof lng !== 'number') continue
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    if (!isGhanaResult(result)) continue
    const title = (result.title || result.address || '').trim()
    if (!title) continue
    places.push({
      title,
      address: (result.address || '').trim(),
      lat,
      lng,
      placeId: typeof result.place_id === 'string' && result.place_id ? result.place_id : null,
    })
    if (places.length >= MAX_RESULTS) break
  }
  return places
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Searches Google Maps (via SerpApi) for `query`, biased to `origin` and
 * hard-filtered to Ghana. Returns a discriminated result so callers can map
 * "not configured" / "quota exhausted" to friendly UI states without ever
 * leaking the API key or raw upstream errors.
 */
export async function searchGhanaPlaces(
  query: string,
  origin: { lat: number; lng: number } | null | undefined,
  apiKey: string,
): Promise<MapsSearchResult> {
  if (!apiKey) return { ok: false, reason: 'not_configured' }
  const q = query.trim().slice(0, 120)
  if (q.length < 3) return { ok: true, results: [] }

  const lat = origin && Number.isFinite(origin.lat) ? origin.lat : DEFAULT_GHANA_ORIGIN.lat
  const lng = origin && Number.isFinite(origin.lng) ? origin.lng : DEFAULT_GHANA_ORIGIN.lng
  const params = new URLSearchParams({
    engine: 'google_maps',
    q,
    ll: `@${lat},${lng},${MAPS_ZOOM}z`,
    google_domain: 'google.com.gh',
    hl: 'en',
    gl: 'gh',
    api_key: apiKey,
  })

  let response: Response
  try {
    response = await fetchWithTimeout(`${SERPAPI_SEARCH_ENDPOINT}?${params.toString()}`)
  } catch {
    return { ok: false, reason: 'upstream' }
  }

  if (!response.ok) {
    if (response.status === 429) return { ok: false, reason: 'quota' }
    if (response.status === 401 || response.status === 403) return { ok: false, reason: 'not_configured' }
    return { ok: false, reason: 'upstream' }
  }

  const body = (await response.json().catch(() => null)) as SerpApiResponse | null
  if (!body || body.search_metadata?.status === 'Error') return { ok: false, reason: 'upstream' }
  return { ok: true, results: normalizeResults(body) }
}
