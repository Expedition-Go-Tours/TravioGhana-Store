import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

export interface RestaurantVenueExternal {
  source: string
  rating: number | null
  reviewCount: number
}

export interface RestaurantVenueRank {
  position: number
  of: number | null
}

/**
 * Public restaurant venue shape. Internal ranking fields stay on the server:
 * the storefront only receives the Travio rating, attributed outside scores,
 * and the display rank.
 */
export interface RestaurantVenue {
  id: string
  slug: string
  name: string
  city: string | null
  region: string | null
  country: string | null
  neighbourhood: string | null
  addressLine: string | null
  cuisines: string[]
  dietary: string[]
  priceBand: number | null
  amenities: string[]
  coverPhoto: string | null
  photos: string[]
  rating: number | null
  reviewCount: number
  recentRating: number | null
  recentReviewCount: number
  external: RestaurantVenueExternal | null
  verifiedReviewCount: number
  rank: RestaurantVenueRank | null
  featured: boolean
  displayOrder: number
}

export interface RestaurantVenuePage {
  venues: RestaurantVenue[]
  pagination: {
    limit: number
    hasMore: boolean
    nextCursor: string | null
  }
}

export type RestaurantSort = 'rating' | 'reviews' | 'newest'

export interface RestaurantVenueFilters {
  q?: string
  city?: string
  cuisine?: string
  priceBand?: number
  minRating?: number
  featured?: boolean
  sort?: RestaurantSort
}

const PAGE_SIZE = 12

/** Exported for tests and for any server renderer that needs the same URL. */
export function buildRestaurantVenuePath(
  filters: RestaurantVenueFilters,
  cursor?: string | null,
): string {
  const params = new URLSearchParams()
  params.set('brand', 'ghana')
  params.set('limit', String(PAGE_SIZE))
  params.set('sort', filters.sort ?? 'rating')

  if (filters.q) params.set('q', filters.q)
  if (filters.city) params.set('city', filters.city)
  if (filters.cuisine) params.set('cuisine', filters.cuisine)
  if (filters.priceBand) params.set('priceBand', String(filters.priceBand))
  if (filters.minRating) params.set('minRating', String(filters.minRating))
  if (filters.featured) params.set('featured', 'true')
  if (cursor) params.set('cursor', cursor)

  return `/v1/restaurant-venues?${params.toString()}`
}

export function useRestaurantVenues(filters: RestaurantVenueFilters) {
  return useInfiniteQuery<
    RestaurantVenuePage,
    Error,
    InfiniteData<RestaurantVenuePage, string | undefined>,
    readonly unknown[],
    string | undefined
  >({
    queryKey: ['restaurant-venues', filters],
    queryFn: ({ pageParam }) =>
      apiFetch<RestaurantVenuePage>(buildRestaurantVenuePath(filters, pageParam)),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.nextCursor ?? undefined : undefined,
    staleTime: 60_000,
  })
}
