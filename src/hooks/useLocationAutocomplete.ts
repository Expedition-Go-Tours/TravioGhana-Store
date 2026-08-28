import { useState, useRef, useCallback } from 'react'
import { fetchWithAuth } from '../lib/api'
import { geoapifyAutocomplete } from '../lib/geoapify'

export interface LocationResult {
  formatted: string
  latitude: number | null
  longitude: number | null
  city: string
  country: string
  countryCode: string
  region: string
  postcode: string | null
  street: string
  housenumber: string | null
  category: string | null
  source: string
  confidence: number | null
}

export interface LocationSuggestion {
  formatted: string
  latitude: number | null
  longitude: number | null
  city: string
  country: string
  region: string
}

const MAX_CACHE_SIZE = 100
const cache = new Map<string, LocationResult[]>()

function getCached(query: string): LocationResult[] | null {
  const key = query.trim().toLowerCase()
  if (cache.has(key)) {
    const entry = cache.get(key)!
    cache.delete(key)
    cache.set(key, entry)
    return entry
  }
  return null
}

function setCached(query: string, data: LocationResult[]) {
  const key = query.trim().toLowerCase()
  if (cache.has(key)) {
    cache.delete(key)
  } else if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value
    if (oldestKey) cache.delete(oldestKey)
  }
  cache.set(key, data)
}

async function fetchLocationResults(path: string): Promise<LocationResult[]> {
  const res = await fetchWithAuth(path)
  if (!res.ok) throw new Error(`Location API HTTP ${res.status}`)
  const body = await res.json()
  return body?.data?.results || []
}

/**
 * Debounced location autocomplete — Geoapify FIRST (client-side, uses the
 * frontend VITE_GEOAPIFY_API_KEY so the search works even when the backend
 * is slow or down), falling back to the backend location service
 * (GET /api/locations/autocomplete — Geoapify → Nominatim → Photon).
 * 400ms debounce, LRU cache, request cancellation.
 */
export function useLocationAutocomplete() {
  const [results, setResults] = useState<LocationResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastQueryRef = useRef('')

  const executeSearch = useCallback(async (query: string) => {
    const controller = new AbortController()
    abortRef.current = controller

    try {
      // 1. Primary — Geoapify straight from the browser.
      const geoapifyResults = await geoapifyAutocomplete(query, 5)
      if (controller.signal.aborted) return
      if (geoapifyResults.length > 0) {
        setCached(query, geoapifyResults)
        setResults(geoapifyResults)
        setError(null)
        return
      }

      // 2. Fallback — backend location service (Geoapify → Nominatim → Photon).
      const backendResults = await fetchLocationResults(
        `/locations/autocomplete?q=${encodeURIComponent(query)}&limit=5`,
      )
      if (controller.signal.aborted) return
      setCached(query, backendResults)
      setResults(backendResults)
      setError(null)
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message || 'Failed to fetch location suggestions')
        setResults([])
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  const search = useCallback((query: string) => {
    if (abortRef.current) abortRef.current.abort()
    if (timerRef.current) clearTimeout(timerRef.current)

    const trimmed = query.trim()
    lastQueryRef.current = trimmed

    if (!trimmed) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }

    const cached = getCached(trimmed)
    if (cached) {
      setResults(cached)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    timerRef.current = setTimeout(() => {
      executeSearch(trimmed)
    }, 500)
  }, [executeSearch])

  const retry = useCallback(() => {
    const query = lastQueryRef.current
    if (!query) return
    setLoading(true)
    setError(null)
    executeSearch(query)
  }, [executeSearch])

  const clear = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    if (timerRef.current) clearTimeout(timerRef.current)
    setResults([])
    setLoading(false)
    setError(null)
    lastQueryRef.current = ''
  }, [])

  return { search, retry, clear, results, loading, error }
}

