import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { RestaurantVenue } from './useRestaurantVenues'

const MIN_QUERY_LENGTH = 2

export interface RestaurantPlaceSuggestion {
  name: string
  subtitle: string
  region: string | null
  latitude: number | null
  longitude: number | null
  restaurantCount: number
  radiusKm: number | null
  source: 'directory' | 'map'
}

interface RestaurantSearchResponse {
  restaurants: RestaurantVenue[]
  places: RestaurantPlaceSuggestion[]
}

function useDebouncedValue(value: string, delayMs = 260) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

/**
 * Restaurant search combines the venue index with the same location service
 * the tours search uses. The server drops map places with no restaurants in
 * range, so a namesake town cannot produce an empty result page.
 */
export function useRestaurantSearch(inputValue: string) {
  const trimmed = inputValue.trim()
  const debounced = useDebouncedValue(trimmed)
  const query = debounced.length >= MIN_QUERY_LENGTH ? debounced : ''

  const { data, isFetching } = useQuery({
    queryKey: ['restaurant-search', query],
    queryFn: () =>
      apiFetch<RestaurantSearchResponse>(
        `/v1/restaurant-venues/suggest?${new URLSearchParams({
          brand: 'ghana',
          q: query,
          limit: '6',
        }).toString()}`,
      ),
    enabled: query.length >= MIN_QUERY_LENGTH,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  })

  const restaurants = data?.restaurants ?? []
  const places = data?.places ?? []

  return {
    restaurants,
    places,
    isSearching:
      trimmed.length >= MIN_QUERY_LENGTH && (trimmed !== debounced || isFetching),
    hasQuery: trimmed.length >= MIN_QUERY_LENGTH,
  }
}
