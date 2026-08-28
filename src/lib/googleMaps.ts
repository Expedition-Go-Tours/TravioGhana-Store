/**
 * Promise-based loader for the Google Maps JavaScript API.
 *
 * The booking-area pickup map renders with Google Maps when a valid
 * VITE_GOOGLE_MAPS_API_KEY is present. Any load/auth failure rejects with a
 * typed reason so the caller can degrade to the free MapLibre + OSM raster
 * tiles (then a text + Google Maps link) instead of leaving a blank box.
 *
 * The loader also backs the Google-enhanced booking features (Place
 * Autocomplete on the pickup input, device-location reverse geocoding, ETA
 * directions and Places Nearby Search) via loadGoogleMapsLibrary. When the
 * Maps JS API was already loaded by the @vis.gl/react-google-maps APIProvider
 * (the booking map's primary renderer), the loader reuses that namespace and
 * lazily imports the extra library instead of injecting a second script.
 */

export type GoogleMapsFailureReason = 'NO_KEY' | 'SCRIPT_ERROR' | 'AUTH_FAILURE' | 'TIMEOUT'

export class GoogleMapsLoadError extends Error {
  reason: GoogleMapsFailureReason

  constructor(reason: GoogleMapsFailureReason) {
    super(`Google Maps failed to load (${reason})`)
    this.name = 'GoogleMapsLoadError'
    this.reason = reason
  }
}

const API_URL = 'https://maps.googleapis.com/maps/api/js'
const LOAD_TIMEOUT_MS = 10000
const CALLBACK_KEY = '__travioGhanaMapsCallback'
/** localStorage key remembering the last Google Maps load outcome. */
export const GOOGLE_MAPS_OUTCOME_KEY = 'travioGhana:googleMapsOutcome'
/**
 * After a failed attempt (e.g. billing not enabled), stop re-injecting the
 * Google script for this long so the console doesn't re-log the API error on
 * every page load. Bounded retry lets the map come back automatically once
 * the key/billing is fixed.
 */
const FAIL_RETRY_MS = 24 * 60 * 60 * 1000

interface GoogleWindow {
  google?: { maps?: typeof google.maps }
  [CALLBACK_KEY]?: () => void
  gm_authFailure?: () => void
}

interface StoredOutcome {
  ok: boolean
  ts: number
  /** API key the outcome belongs to — a swapped key always gets a fresh attempt. */
  key: string
}

/** Reads the Maps JavaScript API key exposed by Vite (VITE_* env only). */
export function getGoogleMapsApiKey(): string {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || ''
}

/**
 * Optional real Map ID (for cloud-styled maps). When empty, the map uses
 * `google.maps.Map.DEMO_MAP_ID`, which enables advanced markers without
 * creating a Map ID in the Google Cloud console.
 */
export function getGoogleMapsMapId(): string {
  return (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined)?.trim() || ''
}

let loadPromise: Promise<typeof google.maps> | null = null
let authFailed = false

/** True once the API rejected because the key/project cannot use Maps JS. */
export function isGoogleMapsAuthFailed(): boolean {
  return authFailed
}

function readOutcome(key: string): StoredOutcome | null {
  try {
    const raw = window.localStorage.getItem(GOOGLE_MAPS_OUTCOME_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredOutcome
    return parsed && typeof parsed.ok === 'boolean' && typeof parsed.ts === 'number' && parsed.key === key
      ? parsed
      : null
  } catch {
    return null
  }
}

function writeOutcome(ok: boolean, key: string): void {
  try {
    window.localStorage.setItem(GOOGLE_MAPS_OUTCOME_KEY, JSON.stringify({ ok, ts: Date.now(), key }))
  } catch {
    /* storage unavailable — best-effort */
  }
}

/**
 * Loads the Google Maps JS API exactly once (per page load) and resolves with
 * the `google.maps` namespace. The outcome — success or failure — is cached in
 * memory and in localStorage, so a later mount (or a full page reload) reuses
 * it instead of re-injecting the script. A recent failure (e.g. billing not
 * enabled) short-circuits without touching the network, so the Maps API's own
 * console error stops repeating on every navigation.
 *
 * `libraries` lists the import libraries requested from the API (preload
 * hints). When the API is already present on the page (loaded by the
 * @vis.gl APIProvider), no script tag is injected at all — extra libraries
 * are fetched lazily by loadGoogleMapsLibrary.
 */
export function loadGoogleMaps(libraries: string[] = ['marker']): Promise<typeof google.maps> {
  if (authFailed) return Promise.reject(new GoogleMapsLoadError('AUTH_FAILURE'))
  const key = getGoogleMapsApiKey()
  if (!key) return Promise.reject(new GoogleMapsLoadError('NO_KEY'))
  if (loadPromise) return loadPromise

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new GoogleMapsLoadError('SCRIPT_ERROR'))
  }

  const win = window as unknown as GoogleWindow
  if (win.google?.maps) {
    loadPromise = Promise.resolve(win.google.maps)
    return loadPromise
  }

  // The last attempt with THIS key failed recently (bad key, API not enabled,
  // billing off): skip the script entirely so the API's error doesn't re-log
  // on this load. A swapped key always gets a fresh attempt.
  const outcome = readOutcome(key)
  if (outcome && !outcome.ok && Date.now() - outcome.ts < FAIL_RETRY_MS) {
    authFailed = true
    return Promise.reject(new GoogleMapsLoadError('AUTH_FAILURE'))
  }

  loadPromise = new Promise<typeof google.maps>((resolve, reject) => {
    let settled = false
    const settle = (fn: () => void): void => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      fn()
    }
    const timeout = window.setTimeout(() => {
      settle(() => {
        writeOutcome(false, key)
        reject(new GoogleMapsLoadError('TIMEOUT'))
      })
    }, LOAD_TIMEOUT_MS)

    win[CALLBACK_KEY] = () => {
      settle(() => {
        if (win.google?.maps) {
          writeOutcome(true, key)
          resolve(win.google.maps)
        } else {
          writeOutcome(false, key)
          reject(new GoogleMapsLoadError('SCRIPT_ERROR'))
        }
      })
    }
    // A key restricted to the wrong domains, or an API/billing problem,
    // triggers this global handler instead of the script callback.
    win.gm_authFailure = () => {
      authFailed = true
      writeOutcome(false, key)
      settle(() => reject(new GoogleMapsLoadError('AUTH_FAILURE')))
    }

    const script = document.createElement('script')
    // loading=async + the marker library: the documented best-practice load
    // pattern, and the import library required for AdvancedMarkerElement
    // (google.maps.Marker is deprecated).
    script.src = `${API_URL}?key=${encodeURIComponent(key)}&v=weekly&loading=async&libraries=${libraries.join(',')}&callback=${CALLBACK_KEY}`
    script.async = true
    script.onerror = () => {
      writeOutcome(false, key)
      settle(() => reject(new GoogleMapsLoadError('SCRIPT_ERROR')))
    }
    document.head.appendChild(script)
  })

  return loadPromise
}

/** Test hook: clears the cached outcome so the next call re-loads. */
export function resetGoogleMapsLoader(): void {
  loadPromise = null
  authFailed = false
  try {
    window.localStorage.removeItem(GOOGLE_MAPS_OUTCOME_KEY)
  } catch {
    /* best-effort */
  }
}

/**
 * True when the app may attempt Google Maps right now: a key is configured and
 * the last attempt with this key did not fail recently. Non-blocking — used to
 * decide whether to render the Google map as primary, attach Place Autocomplete
 * to the pickup input, or show ETA directions, without loading the script.
 */
export function shouldAttemptGoogleMaps(): boolean {
  if (authFailed) return false
  const key = getGoogleMapsApiKey()
  if (!key) return false
  const outcome = readOutcome(key)
  if (outcome && !outcome.ok && Date.now() - outcome.ts < FAIL_RETRY_MS) return false
  return true
}

/**
 * Persists a Google Maps failure (e.g. an auth/billing error surfaced by the
 * @vis.gl APIProvider) so later mounts skip Google for the retry window —
 * mirroring the script-loader's own outcome bookkeeping.
 */
export function recordGoogleMapsFailure(): void {
  authFailed = true
  writeOutcome(false, getGoogleMapsApiKey())
}

/**
 * Lazily imports a Google Maps library (e.g. 'places', 'routes', 'geometry').
 * Works whether the base API was loaded by this loader or by the @vis.gl
 * APIProvider: once `google.maps` exists, importLibrary resolves on demand.
 */
export function loadGoogleMapsLibrary<K extends keyof google.maps.ImportLibraryMap>(
  name: K,
): Promise<google.maps.ImportLibraryMap[K]> {
  return loadGoogleMaps().then(() => window.google.maps.importLibrary(name))
}