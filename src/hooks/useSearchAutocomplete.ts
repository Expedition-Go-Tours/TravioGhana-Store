import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchWithAuth } from '../lib/api'
import { usePopularDestinations } from './useHomepageSections'
import { extractStartingPriceFromRaw, formatDuration } from './useExpeditionTours'

export interface SearchSuggestion {
  id: string
  type: 'destination' | 'tour'
  title: string
  subtitle: string
  image?: string
  price?: string
  slug?: string
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

  const { data: destinationList } = usePopularDestinations(20)

  const destinationSuggestions = useMemo<SearchSuggestion[]>(() => {
    if (!isQueryLongEnough) return []
    const lq = trimmed.toLowerCase()
    return (destinationList ?? [])
      .filter((d) => d.city.toLowerCase().includes(lq))
      .map((d) => ({
        id: `dest-${d.city}`,
        type: 'destination' as const,
        title: d.city,
        subtitle: d.country ?? '',
      }))
  }, [trimmed, isQueryLongEnough, destinationList])

  const tourQuery = useQuery({
    queryKey: ['search-autocomplete', 'tours', trimmed],
    queryFn: () => fetchBackendTourSuggestions(trimmed),
    enabled: isQueryLongEnough,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  })

  const suggestions = useMemo<SearchSuggestion[]>(() => {
    if (!isQueryLongEnough) return []

    const tourSuggestions = tourQuery.data ?? []
    const lq = trimmed.toLowerCase()
    const seenTitles = new Set(destinationSuggestions.map((d) => d.title))
    const dedupedTours = tourSuggestions.filter((t) => {
      if (seenTitles.has(t.title)) return false
      seenTitles.add(t.title)
      return true
    })

    const results = [...destinationSuggestions, ...dedupedTours]

    results.sort((a, b) => {
      // Destinations first, then tours, matching prior UX ordering
      if (a.type !== b.type) return a.type === 'destination' ? -1 : 1
      const aStarts = a.title.toLowerCase().startsWith(lq) ? 0 : 1
      const bStarts = b.title.toLowerCase().startsWith(lq) ? 0 : 1
      if (aStarts !== bStarts) return aStarts - bStarts
      return a.title.length - b.title.length
    })

    return results.slice(0, 8)
  }, [destinationSuggestions, tourQuery.data, trimmed, isQueryLongEnough])

  // True while the user is actively searching but results aren't ready yet —
  // covers both the 250ms debounce window and the in-flight backend request.
  const inputTrim = inputValue.trim()
  const isSearching = inputTrim.length >= 2 && (inputTrim !== debounced || tourQuery.isFetching)

  return { suggestions, isSearching }
}
