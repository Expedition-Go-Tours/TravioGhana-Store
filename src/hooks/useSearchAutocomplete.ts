import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchWithAuth } from '../lib/api'
import { extractStartingPriceFromRaw, formatDuration } from './useExpeditionTours'

export interface SearchSuggestion {
  id: string
  type: 'destination' | 'attraction' | 'tour'
  title: string
  subtitle: string
  image?: string
  price?: string
  slug?: string
  /** Canonical city of a tour suggestion — used to personalize the homepage
   *  when the suggestion is selected from the search bar. */
  city?: string
  /** Number of tours a place suggestion has (shown as "N experiences"). */
  tourCount?: number
}

interface BackendTourResult {
  id: string
  title: string
  slug: string
  coverPhoto: string | null
  photos: string[]
  city: string | null
  country: string | null
  category: string | null
  durationMinutes: number | null
  schedulesAndPricing: unknown
}

async function fetchBackendTourSuggestions(query: string): Promise<SearchSuggestion[]> {
  const params = new URLSearchParams({ search: query, limit: '8' })
  const res = await fetchWithAuth(`/tours?${params.toString()}`)
  if (!res.ok) return []

  const payload = await res.json().catch(() => ({}))
  const tours: BackendTourResult[] = payload.data?.tours ?? payload.tours ?? []

  return tours.map((t) => {
    const price = extractStartingPriceFromRaw(t.schedulesAndPricing)
    const location = [t.city, t.country].filter(Boolean).join(', ')
    const durationLabel = formatDuration(t.durationMinutes)

    return {
      id: `tour-${t.id}`,
      type: 'tour' as const,
      title: t.title,
      subtitle: [location, durationLabel].filter(Boolean).join(' • ') || t.category || '',
      image: t.coverPhoto || t.photos?.[0] || '',
      price: price != null ? `$${price}` : undefined,
      slug: t.slug,
      city: t.city || undefined,
    }
  })
}

/** "Places to see" — destinations + attractions, grouped the GYG way. */
async function fetchPlaceSuggestions(query: string): Promise<SearchSuggestion[]> {
  const res = await fetchWithAuth(`/places/suggest?q=${encodeURIComponent(query)}&limit=5`)
  if (!res.ok) return []
  const payload = await res.json().catch(() => ({}))
  const places: any[] = payload.data?.placesToSee ?? []

  return places.map((p) => {
    const isAttraction = p.type === 'attraction'
    const count = Number(p.tourCount) || 0
    return {
      id: p.id,
      type: (isAttraction ? 'attraction' : 'destination') as 'attraction' | 'destination',
      title: p.name,
      subtitle: isAttraction
        ? (count ? `${count} experience${count === 1 ? '' : 's'}` : 'Attraction')
        : (p.country || 'Destination'),
      image: p.image || undefined,
      city: p.city || undefined,
      tourCount: count,
    }
  })
}

export function useSearchAutocomplete(inputValue: string) {
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(inputValue), 250)
    return () => clearTimeout(t)
  }, [inputValue])

  const trimmed = debounced.trim()
  const isQueryLongEnough = trimmed.length >= 2

  const placesQuery = useQuery({
    queryKey: ['place-suggest', trimmed],
    queryFn: () => fetchPlaceSuggestions(trimmed),
    enabled: isQueryLongEnough,
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  })

  const tourQuery = useQuery({
    queryKey: ['search-autocomplete', 'tours', trimmed],
    queryFn: () => fetchBackendTourSuggestions(trimmed),
    enabled: isQueryLongEnough,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  })

  const suggestions = useMemo<SearchSuggestion[]>(() => {
    if (!isQueryLongEnough) return []

    const places = placesQuery.data ?? []
    const tours = tourQuery.data ?? []
    const lq = trimmed.toLowerCase()

    const seenTitles = new Set(places.map((p) => p.title.toLowerCase()))
    const dedupedTours = tours.filter((t) => {
      const key = t.title.toLowerCase()
      if (seenTitles.has(key)) return false
      seenTitles.add(key)
      return true
    })

    const results = [...places, ...dedupedTours]

    results.sort((a, b) => {
      // Places first, then tours — matching GYG's "Places to see" / "Things to do".
      const aPlace = a.type !== 'tour' ? 0 : 1
      const bPlace = b.type !== 'tour' ? 0 : 1
      if (aPlace !== bPlace) return aPlace - bPlace
      const aStarts = a.title.toLowerCase().startsWith(lq) ? 0 : 1
      const bStarts = b.title.toLowerCase().startsWith(lq) ? 0 : 1
      if (aStarts !== bStarts) return aStarts - bStarts
      return a.title.length - b.title.length
    })

    return results.slice(0, 8)
  }, [placesQuery.data, tourQuery.data, trimmed, isQueryLongEnough])

  // True while the user is actively searching but results aren't ready yet —
  // covers both the 250ms debounce window and the in-flight backend requests.
  const inputTrim = inputValue.trim()
  const isSearching = inputTrim.length >= 2 && (
    inputTrim !== debounced || placesQuery.isFetching || tourQuery.isFetching
  )

  return { suggestions, isSearching }
}
