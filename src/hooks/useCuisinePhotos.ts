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

/**
 * Cuisine tiles use photography from the restaurant catalogue, not bundled
 * stock art. Each tile asks the public venue list for one top-rated venue and
 * borrows its cover photo. Vegetarian is a dietary attribute in the catalogue
 * rather than a cuisine key, so that tile filters on `dietary` instead.
 *
 * A missing or failed lookup leaves the tile without a photo; the tile falls
 * back to its gradient rather than showing an unrelated restaurant.
 */
export function useCuisinePhotos(cuisines: CuisinePhotoQuery[]) {
  return useQuery<Record<string, string>, Error>({
    queryKey: ['restaurant-cuisine-photos', cuisines],
    queryFn: async () => {
      const results = await Promise.allSettled(
        cuisines.map(async ({ label, query }) => {
          const payload = await apiFetch<RestaurantVenuePage>(
            buildRestaurantVenuePath({ ...query, limit: 1, sort: 'rating' }),
          )
          const venue = payload.venues?.[0]
          const image = venue?.coverPhoto || venue?.photos?.[0]
          return image ? ([label, image] as const) : null
        }),
      )

      const photos: Record<string, string> = {}
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          photos[result.value[0]] = result.value[1]
        }
      }
      return photos
    },
    staleTime: 30 * 60_000,
  })
}
