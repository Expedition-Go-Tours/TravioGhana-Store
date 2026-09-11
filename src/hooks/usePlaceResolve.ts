import { useQuery } from '@tanstack/react-query'
import { fetchWithAuth } from '../lib/api'

export interface ResolvedPlace {
  name: string
  displayName: string
  type: 'city' | 'region' | 'attraction' | 'locality' | 'country' | string
  city: string | null
  region: string | null
  country: string | null
  lat: number | null
  lng: number | null
  matchedBy?: string
}

async function fetchPlace(q: string, scope?: string): Promise<ResolvedPlace | null> {
  const params = new URLSearchParams({ q })
  if (scope) params.set('scope', scope)
  const res = await fetchWithAuth(`/places/resolve?${params.toString()}`)
  if (!res.ok) return null
  const payload = await res.json().catch(() => ({}))
  return payload.data?.place ?? null
}

/**
 * Resolve a search query to a place (city / region / attraction / locality) so
 * the listing can be scoped to it the way GetYourGuide scopes a destination
 * search. Returns null when the query isn't a place (the caller then keeps a
 * plain text search).
 */
export function usePlaceResolve(q: string | null | undefined, scope?: 'expedition' | 'ghana') {
  const query = (q || '').trim()
  return useQuery({
    queryKey: ['place-resolve', query, scope ?? 'all'],
    queryFn: () => fetchPlace(query, scope),
    enabled: query.length >= 2,
    staleTime: 10 * 60_000,
  })
}
