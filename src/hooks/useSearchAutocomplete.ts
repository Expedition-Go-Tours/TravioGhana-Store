import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchWithAuth } from '../lib/api'

export interface SearchSuggestion {
  id: string
  kind: 'tour' | 'place' | 'attraction' | 'region'
  name: string
  subtitle: string
  meta: string
  icon: string
  badge: string
  score: number
  slug?: string
  /** Real tour id — the stable half of /tour/{id}/{slug}. */
  tourId?: string
  city?: string
  image?: string
  region?: string
}

interface SearchStats {
  places: number
  attractions: number
  regions: number
  tours: number
}

interface SearchApiResponse {
  query: string
  results: Array<{
    kind: string
    name: string
    region?: string
    subtitle: string
    meta: string
    icon: string
    badge: string
    score: number
    entity: {
      slug?: string
      id?: string
      city?: string
      heroImage?: string
      coverPhoto?: string
      tourCount?: number
      attractionCount?: number
    }
  }>
  stats: SearchStats
}

async function fetchUnifiedSearch(query: string): Promise<{ suggestions: SearchSuggestion[]; stats: SearchStats }> {
  const params = new URLSearchParams({ q: query, limit: '14' })
  const res = await fetchWithAuth(`/search?${params.toString()}`)
  if (!res.ok) return { suggestions: [], stats: { places: 0, attractions: 0, regions: 0, tours: 0 } }

  const payload = await res.json().catch(() => ({}))
  const data: SearchApiResponse = payload.data ?? { results: [], stats: { places: 0, attractions: 0, regions: 0, tours: 0 } }

  const suggestions: SearchSuggestion[] = data.results.map((r) => ({
    id: `${r.kind}-${r.name}`,
    kind: r.kind as SearchSuggestion['kind'],
    name: r.name,
    subtitle: r.subtitle,
    meta: r.meta,
    icon: r.icon,
    badge: r.badge,
    score: r.score,
    slug: r.entity?.slug,
    tourId: r.kind === 'tour' ? r.entity?.id : undefined,
    city: r.entity?.city,
    image: r.entity?.heroImage || r.entity?.coverPhoto,
    region: r.region,
  }))

  return { suggestions, stats: data.stats }
}

export function useSearchAutocomplete(inputValue: string) {
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(inputValue), 250)
    return () => clearTimeout(t)
  }, [inputValue])

  const trimmed = debounced.trim()
  const isQueryLongEnough = trimmed.length >= 2

  const { data, isFetching } = useQuery({
    queryKey: ['unified-search', trimmed],
    queryFn: () => fetchUnifiedSearch(trimmed),
    enabled: isQueryLongEnough,
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  })

  const suggestions = data?.suggestions ?? []
  const stats: SearchStats = data?.stats ?? { places: 0, attractions: 0, regions: 0, tours: 0 }

  const inputTrim = inputValue.trim()
  const isSearching = inputTrim.length >= 2 && (
    inputTrim !== debounced || isFetching
  )

  return { suggestions, isSearching, stats }
}
