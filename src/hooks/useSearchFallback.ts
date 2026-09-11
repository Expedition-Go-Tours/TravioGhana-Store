import { useQuery } from '@tanstack/react-query'
import { fetchWithAuth } from '../lib/api'
import { mapRawTourToListing, type TourCardData } from './useExpeditionTours'
import { mergeOffersIntoTours } from './useHomepageSections'

export interface NearbyLocation {
  city: string
  country: string | null
  tourCount: number
  coverPhoto: string | null
  distanceKm: number
}

export interface SearchFallback {
  query: string
  resolvedLocation: { city: string; country: string | null } | null
  nearbyLocations: NearbyLocation[]
  recommended: TourCardData[]
  youMayAlsoLike: TourCardData[]
}

const EMPTY: SearchFallback = {
  query: '',
  resolvedLocation: null,
  nearbyLocations: [],
  recommended: [],
  youMayAlsoLike: [],
}

async function fetchSearchFallback(q: string): Promise<SearchFallback> {
  const params = new URLSearchParams({ q, limit: '8' })
  const res = await fetchWithAuth(`/tours/search-fallback?${params.toString()}`)
  if (!res.ok) return { ...EMPTY, query: q }
  const payload = await res.json().catch(() => ({}))
  const data = payload.data ?? {}
  const map = (arr: any[]) => mergeOffersIntoTours((arr ?? []).map(mapRawTourToListing))
  return {
    query: q,
    resolvedLocation: data.resolvedLocation ?? null,
    nearbyLocations: Array.isArray(data.nearbyLocations) ? data.nearbyLocations : [],
    recommended: await map(data.recommended),
    youMayAlsoLike: await map(data.youMayAlsoLike),
  }
}

/**
 * Powers the "no experiences here yet" empty state: close-by destinations plus
 * two curated rails. Only fetches for a real query.
 */
export function useSearchFallback(q: string | null | undefined) {
  const query = (q || '').trim()
  return useQuery({
    queryKey: ['search-fallback', query],
    queryFn: () => fetchSearchFallback(query),
    enabled: query.length >= 2,
    staleTime: 5 * 60_000,
  })
}
