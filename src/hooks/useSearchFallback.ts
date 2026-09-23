import { useQuery } from '@tanstack/react-query'
import { fetchWithAuth } from '../lib/api'
import { enrichTourBadgeFields, mapRawTourToListing, type TourCardData } from './useExpeditionTours'
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
  attraction?: string | null
  region?: string | null
  resolvedLocation: { city: string; country: string | null } | null
  nearbyLocations: NearbyLocation[]
  recommended: TourCardData[]
  youMayAlsoLike: TourCardData[]
}

const EMPTY: SearchFallback = {
  query: '',
  attraction: null,
  region: null,
  resolvedLocation: null,
  nearbyLocations: [],
  recommended: [],
  youMayAlsoLike: [],
}

async function fetchSearchFallback(
  q: string,
  attraction?: string | null,
  region?: string | null,
): Promise<SearchFallback> {
  const params = new URLSearchParams({ q, limit: '8' })
  if (attraction) params.set('attraction', attraction)
  if (region) params.set('region', region)
  const res = await fetchWithAuth(`/tours/search-fallback?${params.toString()}`)
  if (!res.ok) return { ...EMPTY, query: q }
  const payload = await res.json().catch(() => ({}))
  const data = payload.data ?? {}
  const map = async (arr: any[]) =>
    mergeOffersIntoTours(await enrichTourBadgeFields((arr ?? []).map(mapRawTourToListing)))
  return {
    query: q,
    attraction: data.attraction ?? null,
    region: data.region ?? null,
    resolvedLocation: data.resolvedLocation ?? null,
    nearbyLocations: Array.isArray(data.nearbyLocations) ? data.nearbyLocations : [],
    recommended: await map(data.recommended),
    youMayAlsoLike: await map(data.youMayAlsoLike),
  }
}

/**
 * Powers the "no experiences here yet" empty state: close-by destinations plus
 * two curated rails. Supports attraction/region fallback params.
 */
export function useSearchFallback(
  q: string | null | undefined,
  attraction?: string | null,
  region?: string | null,
) {
  const query = (q || '').trim()
  return useQuery({
    queryKey: ['search-fallback', query, attraction ?? null, region ?? null],
    queryFn: () => fetchSearchFallback(query, attraction, region),
    enabled: query.length >= 2,
    staleTime: 5 * 60_000,
  })
}
