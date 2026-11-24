import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
} from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

export interface RestaurantVenueExternal {
  source: string
  rating: number | null
  reviewCount: number
}

export interface RestaurantVenueExternalStat extends RestaurantVenueExternal {
  distribution: Record<string, number> | null
  productUrl: string | null
  syncedAt: string
}

export interface RestaurantVenueRank {
  position: number
  of: number | null
}

export type RestaurantDistribution = Record<string, number> | null

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

export interface RestaurantVenueDetail extends RestaurantVenue {
  latitude: number | null
  longitude: number | null
  hours: Record<string, unknown> | null
  timezone: string
  phone: string | null
  website: string | null
  description: string | null
  distribution: RestaurantDistribution
  externalStats: RestaurantVenueExternalStat[]
}

export interface RestaurantVenuePage {
  venues: RestaurantVenue[]
  pagination: {
    limit: number
    hasMore: boolean
    nextCursor: string | null
  }
}

export interface RestaurantVenueReview {
  id: string
  rating: number
  foodRating: number | null
  serviceRating: number | null
  atmosphereRating: number | null
  valueRating: number | null
  title: string | null
  body: string | null
  photos: string[]
  visitedAt: string | null
  source: string
  verified: boolean
  helpfulCount: number
  author: { name: string | null; photoURL: string | null }
  createdAt: string
}

export interface RestaurantVenueReviewsPage {
  venueId: string
  reviews: RestaurantVenueReview[]
  distribution: RestaurantDistribution
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
  dietary?: string[]
  priceBand?: number
  minRating?: number
  minReviews?: number
  featured?: boolean
  sort?: RestaurantSort
}

const PAGE_SIZE = 12
const REVIEW_PAGE_SIZE = 10

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
  if (filters.dietary?.length) params.set('dietary', filters.dietary.join(','))
  if (filters.priceBand) params.set('priceBand', String(filters.priceBand))
  if (filters.minRating) params.set('minRating', String(filters.minRating))
  if (filters.minReviews != null) params.set('minReviews', String(filters.minReviews))
  if (filters.featured) params.set('featured', 'true')
  if (cursor) params.set('cursor', cursor)

  return `/v1/restaurant-venues?${params.toString()}`
}

export function buildRestaurantVenueDetailPath(slugOrId: string): string {
  return `/v1/restaurant-venues/${encodeURIComponent(slugOrId)}?brand=ghana`
}

export function buildRestaurantVenueReviewsPath(
  slugOrId: string,
  cursor?: string | null,
): string {
  const params = new URLSearchParams()
  params.set('brand', 'ghana')
  params.set('limit', String(REVIEW_PAGE_SIZE))
  if (cursor) params.set('cursor', cursor)
  return `/v1/restaurant-venues/${encodeURIComponent(slugOrId)}/reviews?${params.toString()}`
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

export function useRestaurantVenue(slugOrId: string | undefined) {
  return useQuery<RestaurantVenueDetail, Error>({
    queryKey: ['restaurant-venue', slugOrId],
    queryFn: async () => {
      // The list endpoint returns the page directly; the detail endpoint wraps
      // the venue so future metadata can be added without a shape break.
      const payload = await apiFetch<{ venue: RestaurantVenueDetail }>(
        buildRestaurantVenueDetailPath(slugOrId!),
      )
      return payload.venue
    },
    enabled: Boolean(slugOrId),
    staleTime: 60_000,
  })
}

export function useRestaurantVenueReviews(slugOrId: string | undefined) {
  return useInfiniteQuery<
    RestaurantVenueReviewsPage,
    Error,
    InfiniteData<RestaurantVenueReviewsPage, string | undefined>,
    readonly unknown[],
    string | undefined
  >({
    queryKey: ['restaurant-venue-reviews', slugOrId],
    queryFn: ({ pageParam }) =>
      apiFetch<RestaurantVenueReviewsPage>(
        buildRestaurantVenueReviewsPath(slugOrId!, pageParam),
      ),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.nextCursor ?? undefined : undefined,
    enabled: Boolean(slugOrId),
    staleTime: 60_000,
  })
}
