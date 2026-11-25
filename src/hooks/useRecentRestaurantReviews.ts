import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

export interface RecentRestaurantReview {
  id: string
  venueId: string
  venueName: string
  venueSlug: string
  venueCity: string | null
  rating: number
  title: string | null
  body: string | null
  createdAt: string
  author: { name: string | null; photoURL: string | null }
  verified: boolean
}

export interface RecentRestaurantReviewsPage {
  reviews: RecentRestaurantReview[]
  pagination: {
    limit: number
    hasMore: boolean
    nextCursor: string | null
  }
}

const PAGE_SIZE = 6

/** Exported for tests and for any server renderer that needs the same URL. */
export function buildRecentRestaurantReviewsPath(cursor?: string | null): string {
  const params = new URLSearchParams()
  params.set('brand', 'ghana')
  params.set('limit', String(PAGE_SIZE))
  if (cursor) params.set('cursor', cursor)
  return `/v1/restaurant-venues/reviews?${params.toString()}`
}

/** Approved reviews from across the Ghana restaurant guide, newest first. */
export function useRecentRestaurantReviews() {
  return useInfiniteQuery<
    RecentRestaurantReviewsPage,
    Error,
    InfiniteData<RecentRestaurantReviewsPage, string | undefined>,
    readonly unknown[],
    string | undefined
  >({
    queryKey: ['recent-restaurant-reviews'],
    queryFn: ({ pageParam }) =>
      apiFetch<RecentRestaurantReviewsPage>(buildRecentRestaurantReviewsPath(pageParam)),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.nextCursor ?? undefined : undefined,
    staleTime: 60_000,
  })
}
