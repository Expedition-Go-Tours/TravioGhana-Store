/**
 * Analytics Client — Frontend event tracking
 *
 * Captures user behavior signals and sends them to the backend
 * for homepage recommendation algorithms.
 *
 * Events tracked:
 *  - page_viewed: UTM params, referrer, page path
 *  - search_bar_used: search queries from the SearchBar component
 *  - tour_card_clicked: which tour card was clicked and from which section
 *  - mood_keyword_clicked: which mood keyword was clicked
 *  - section_impressed: which homepage section became visible
 *  - location_shared: user's geolocation coordinates
 *  - external_referrer_captured: Google/Bing search terms from referrer
 *
 * @version 1.0.0
 */

import { getApiBaseUrl, getAuthToken } from './auth'

// ─── Event queue (batched sends) ──────────────────────────────────────
interface PendingEvent {
  name: string
  properties?: Record<string, unknown>
  resourceId?: string
  resource?: string
}

const queue: PendingEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
const FLUSH_INTERVAL = 5000 // 5 seconds
const MAX_QUEUE_SIZE = 10

function flush() {
  if (queue.length === 0) return
  const events = queue.splice(0, MAX_QUEUE_SIZE)

  const base = getApiBaseUrl()
  getAuthToken().then(token => {
    fetch(`${base}/analytics/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ events }),
      keepalive: true,
    }).catch(() => {
      // Silently fail — analytics should never break the app
    })
  })

  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
}

function enqueue(event: PendingEvent) {
  queue.push(event)
  if (queue.length >= MAX_QUEUE_SIZE) {
    flush()
  } else if (!flushTimer) {
    flushTimer = setInterval(flush, FLUSH_INTERVAL)
  }
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flush)
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}

// ─── UTM + Referrer Extraction ────────────────────────────────────────

function extractUTMParams(): Record<string, string | null> {
  if (typeof window === 'undefined') return {}
  const params = new URLSearchParams(window.location.search)
  return {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_term: params.get('utm_term'),
    utm_content: params.get('utm_content'),
  }
}

function extractGoogleSearchTerm(referrer: string): string | null {
  try {
    const url = new URL(referrer)
    if (url.hostname.includes('google')) {
      return url.searchParams.get('q')
    }
    if (url.hostname.includes('bing')) {
      return url.searchParams.get('q')
    }
    if (url.hostname.includes('yahoo')) {
      return url.searchParams.get('p')
    }
  } catch {
    // Invalid URL
  }
  return null
}

// ─── Location Persistence ─────────────────────────────────────────────

const LOCATION_KEY = 'eg_user_location'
const LOCATION_TTL = 24 * 60 * 60 * 1000 // 24 hours

export interface UserLocation {
  lat: number
  lng: number
  timestamp: number
}

export function getStoredLocation(): UserLocation | null {
  try {
    const stored = localStorage.getItem(LOCATION_KEY)
    if (!stored) return null
    const loc = JSON.parse(stored) as UserLocation
    if (Date.now() - loc.timestamp > LOCATION_TTL) {
      localStorage.removeItem(LOCATION_KEY)
      return null
    }
    return loc
  } catch {
    return null
  }
}

export function storeLocation(lat: number, lng: number): void {
  try {
    localStorage.setItem(LOCATION_KEY, JSON.stringify({
      lat,
      lng,
      timestamp: Date.now(),
    }))
  } catch {
    // localStorage full or unavailable
  }
}

export function requestLocation(): Promise<UserLocation | null> {
  return new Promise((resolve) => {
    const stored = getStoredLocation()
    if (stored) {
      resolve(stored)
      return
    }

    if (!navigator.geolocation) {
      // No browser geolocation — try IP fallback
      resolve(fetchIPLocation())
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: UserLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: Date.now(),
        }
        storeLocation(loc.lat, loc.lng)
        trackLocationShared(loc.lat, loc.lng)
        resolve(loc)
      },
      () => {
        // Browser geolocation denied — try IP fallback
        resolve(fetchIPLocation())
      },
      { timeout: 5000, maximumAge: 300000 }
    )
  })
}

/**
 * Fetch approximate location from the backend using IP geolocation.
 * City-level accuracy (~25km), no permission required.
 */
async function fetchIPLocation(): Promise<UserLocation | null> {
  try {
    const base = getApiBaseUrl()
    const res = await fetch(`${base}/locations/my-location`)
    const payload = await res.json().catch(() => ({}))
    const loc = payload?.data?.location
    if (loc?.lat && loc?.lng) {
      const userLoc: UserLocation = {
        lat: loc.lat,
        lng: loc.lng,
        timestamp: Date.now(),
      }
      storeLocation(userLoc.lat, userLoc.lng)
      return userLoc
    }
  } catch {
    // Silently fail — IP geolocation is best-effort
  }
  return null
}

// ─── Tracking Functions ───────────────────────────────────────────────

/**
 * Track a page view with UTM params and referrer.
 * Call this on every route change (or in a useEffect in App.tsx).
 */
export function trackPageView(path: string): void {
  const utm = extractUTMParams()
  const referrer = document.referrer || null

  enqueue({
    name: 'page_viewed',
    properties: {
      path,
      ...utm,
      referrer,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
    },
  })

  // If user came from Google/Bing, capture the search term
  if (referrer) {
    const searchTerm = extractGoogleSearchTerm(referrer)
    if (searchTerm) {
      enqueue({
        name: 'external_referrer_captured',
        properties: {
          referrer,
          searchTerm,
          source: referrer.includes('google') ? 'google' : referrer.includes('bing') ? 'bing' : 'other',
        },
      })
    }
  }
}

/**
 * Track a search query from the SearchBar component.
 */
export function trackSearch(query: string, resultCount?: number): void {
  enqueue({
    name: 'search_bar_used',
    properties: {
      query,
      resultCount: resultCount ?? null,
    },
  })
}

/**
 * Track a tour card click from any section.
 */
export function trackTourClick(tourId: string, section: string, position: number): void {
  enqueue({
    name: 'tour_card_clicked',
    properties: {
      section,
      position,
    },
    resourceId: tourId,
    resource: 'Tour',
  })
}

/**
 * Track a mood keyword click.
 */
export function trackMoodClick(keyword: string, position: number): void {
  enqueue({
    name: 'mood_keyword_clicked',
    properties: {
      keyword,
      position,
    },
  })
}

/**
 * Track a section impression (when it becomes visible).
 */
export function trackSectionImpression(section: string, itemCount: number): void {
  enqueue({
    name: 'section_impressed',
    properties: {
      section,
      itemCount,
    },
  })
}

/**
 * Track when the user shares their location.
 */
export function trackLocationShared(lat: number, lng: number): void {
  enqueue({
    name: 'location_shared',
    properties: {
      lat,
      lng,
    },
  })
}
