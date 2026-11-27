import { queryClient } from './queryClient'
import { apiFetch } from './api'
import {
  buildRestaurantVenuePath,
  type RestaurantVenue,
  type RestaurantVenuePage,
} from '../hooks/useRestaurantVenues'

/**
 * Warm the restaurant vertical before the tab is clicked.
 *
 * The restaurants homepage issues a handful of independent rails. Waiting for
 * the click means the visitor watches five skeletons fill in right after the
 * page transition, which undoes the smoothness of the switch. Hovering or
 * focusing the Restaurants tab gives us the few hundred milliseconds before
 * the click to fetch the data into the same React Query cache the page reads,
 * so the first paint is already populated.
 *
 * Only the above-the-fold rails are primed. The cuisine photos fan out into
 * seven catalogue requests, so those keep loading on the page itself instead
 * of turning a hover into a burst of traffic.
 */
const SECTIONS = ['recommended', 'likely-to-book-out', 'offers'] as const
type Section = (typeof SECTIONS)[number]

function homepagePath(section: Section) {
  const params = new URLSearchParams()
  params.set('brand', 'ghana')
  params.set('limit', '8')
  return `/v1/restaurant-venues/homepage/${section}?${params.toString()}`
}

function homepageKey(section: Section) {
  // Mirrors homepageKey() in useRestaurantHomepage: no location overrides on
  // the default homepage rail.
  return ['restaurant-venue-homepage', section, null, null, null, null] as const
}

let warmed = false

export function prefetchRestaurantHome(): void {
  if (warmed) return
  warmed = true

  for (const section of SECTIONS) {
    void queryClient
      .prefetchQuery({
        queryKey: homepageKey(section),
        queryFn: () => apiFetch<{ venues: RestaurantVenue[] }>(homepagePath(section)),
        staleTime: 5 * 60_000,
      })
      .catch(() => {
        /* a failed warmup must never break the tab switch */
      })
  }

  // The first two horizontal rails. Same query key and page size as
  // useRestaurantVenues so the page adopts these pages instead of refetching.
  for (const filters of [{ sort: 'reviews' as const }, { sort: 'rating' as const }]) {
    void queryClient
      .prefetchInfiniteQuery({
        queryKey: ['restaurant-venues', filters],
        queryFn: ({ pageParam }) =>
          apiFetch<RestaurantVenuePage>(
            buildRestaurantVenuePath(filters, pageParam as string | undefined),
          ),
        initialPageParam: undefined as string | undefined,
        staleTime: 60_000,
      })
      .catch(() => {
        /* a failed warmup must never break the tab switch */
      })
  }
}
