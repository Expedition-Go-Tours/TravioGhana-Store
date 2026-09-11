import { useQuery } from '@tanstack/react-query'
import { fetchWithAuth } from '../lib/api'

export interface ResolvedPlace {
  name: string
  type: 'city' | 'attraction' | 'landmark' | string
  city: string | null
  country: string | null
  lat: number | null
  lng: number | null
}

async function fetchPlace(q: string): Promise<ResolvedPlace | null> {
  const res = await fetchWithAuth(`/places/resolve?q=${encodeURIComponent(q)}`)
  if (!res.ok) return null
  const payload = await res.json().catch(() => ({}))
  return payload.data?.place ?? null
}

/**
 * Resolve a search query to a place (city / attraction / landmark) so the
 * listing can be scoped to it the way GetYourGuide scopes a destination search.
 * Returns null when the query isn't a place (then the caller keeps text search).
 */
export function usePlaceResolve(q: string | null | undefined) {
  const query = (q || '').trim()
  return useQuery({
    queryKey: ['place-resolve', query],
    queryFn: () => fetchPlace(query),
    enabled: query.length >= 2,
    staleTime: 10 * 60_000,
  })
}
