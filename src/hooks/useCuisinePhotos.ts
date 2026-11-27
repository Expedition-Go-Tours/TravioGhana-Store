import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import {
  buildRestaurantVenuePath,
  type RestaurantVenueFilters,
  type RestaurantVenuePage,
} from './useRestaurantVenues'

export interface CuisinePhotoQuery {
  label: string
  query: RestaurantVenueFilters
}

export interface CuisineCardInfo {
  /** Top-rated venue artwork from the catalogue, or null when none is available. */
  photo: string | null
  /** Real venue count behind this cuisine, capped at the list endpoint's 50. */
  count: number
  /** True when the catalogue has more than the returned page of venues. */
  hasMore: boolean
}

/**
 * Cuisine cards use photography and counts from the restaurant catalogue, not
 * bundled stock art. Each tile asks the public venue list for its top-rated
 * venues and borrows the first cover photo. Vegetarian is a dietary attribute
 * in the catalogue rather than a cuisine key, so that tile filters on
 * `dietary` instead.
 *
 * A failed lookup leaves the tile without data; the UI falls back to a neutral
 * gradient rather than showing an unrelated restaurant or an invented count.
 */
export function useCuisinePhotos(cuisines: CuisinePhotoQuery[]) {
  return useQuery<Record<string, CuisineCardInfo>, Error>({
    queryKey: ['restaurant-cuisine-photos', cuisines],
    queryFn: async () => {
      const results = await Promise.allSettled(
        cuisines.map(async ({ label, query }) => {
          const payload = await apiFetch<RestaurantVenuePage>(
            buildRestaurantVenuePath({ ...query, limit: 50, sort: 'rating' }),
          )
          const venue = payload.venues?.[0]
          return [
            label,
            {
              photo: venue?.coverPhoto || venue?.photos?.[0] || null,
              count: payload.venues?.length ?? 0,
              hasMore: Boolean(payload.pagination?.hasMore),
            },
          ] as const
        }),
      )

      const cards: Record<string, CuisineCardInfo> = {}
      for (const result of results) {
        if (result.status === 'fulfilled') {
          cards[result.value[0]] = result.value[1]
        }
      }
      return cards
    },
    staleTime: 30 * 60_000,
  })
}
