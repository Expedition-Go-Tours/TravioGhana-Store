import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { RestaurantVenue } from './useRestaurantVenues'

export type RestaurantHomepageSection = 'recommended' | 'likely-to-book-out' | 'offers'

export const RESTAURANT_HOMEPAGE_SECTIONS: RestaurantHomepageSection[] = [
  'recommended',
  'likely-to-book-out',
  'offers',
]

export interface RestaurantHomepageOptions {
  limit?: number
  city?: string
  lat?: number
  lng?: number
}

interface HomepageVenuesPayload {
  venues: RestaurantVenue[]
}

interface SectionVenueIdsPayload {
  venueIds: string[]
}

const DEFAULT_LIMIT = 8
const STALE_TIME = 5 * 60 * 1000

export function isRestaurantHomepageSection(
  value: string | null | undefined,
): value is RestaurantHomepageSection {
  return RESTAURANT_HOMEPAGE_SECTIONS.some((section) => section === value)
}

function optionKeyParts(options: RestaurantHomepageOptions) {
  return [
    options.limit ?? null,
    options.city ?? null,
    options.lat ?? null,
    options.lng ?? null,
  ] as const
}

function homepageKey(section: string, options: RestaurantHomepageOptions) {
  return ['restaurant-venue-homepage', section, ...optionKeyParts(options)] as const
}

function sectionIdsKey(section: string | null, options: RestaurantHomepageOptions) {
  return ['restaurant-venue-homepage', 'section-venue-ids', section, ...optionKeyParts(options)] as const
}

function appendLocationParams(params: URLSearchParams, options: RestaurantHomepageOptions) {
  if (options.city) params.set('city', options.city)
  if (options.lat != null) params.set('lat', String(options.lat))
  if (options.lng != null) params.set('lng', String(options.lng))
}

function buildHomepageVenuesPath(
  section: RestaurantHomepageSection,
  options: RestaurantHomepageOptions,
): string {
  const params = new URLSearchParams()
  params.set('brand', 'ghana')
  params.set('limit', String(options.limit ?? DEFAULT_LIMIT))
  appendLocationParams(params, options)
  return `/v1/restaurant-venues/homepage/${section}?${params.toString()}`
}

function buildSectionVenueIdsPath(
  section: RestaurantHomepageSection,
  options: RestaurantHomepageOptions,
): string {
  const params = new URLSearchParams()
  params.set('brand', 'ghana')
  params.set('section', section)
  if (options.limit != null) params.set('limit', String(options.limit))
  appendLocationParams(params, options)
  return `/v1/restaurant-venues/homepage/section-venue-ids?${params.toString()}`
}

function useHomepageVenues(
  section: RestaurantHomepageSection,
  options: RestaurantHomepageOptions = {},
) {
  return useQuery<HomepageVenuesPayload, Error, RestaurantVenue[]>({
    queryKey: homepageKey(section, options),
    queryFn: () => apiFetch<HomepageVenuesPayload>(buildHomepageVenuesPath(section, options)),
    staleTime: STALE_TIME,
    select: (data) => data.venues,
  })
}

/** Recommended For You — ranked from diner interest, ratings and proximity. */
export function useRecommendedRestaurants(options: RestaurantHomepageOptions = {}) {
  return useHomepageVenues('recommended', options)
}

/** Likely To Book Out — recent Travio diner interest, not live availability. */
export function useLikelyToBookOutRestaurants(options: RestaurantHomepageOptions = {}) {
  return useHomepageVenues('likely-to-book-out', options)
}

/** Special Offers — venues with current restaurant or Travio team offers. */
export function useSpecialOfferRestaurants(options: RestaurantHomepageOptions = {}) {
  return useHomepageVenues('offers', options)
}

/**
 * Algorithmically curated ids for one homepage rail. Used by the results page
 * to reorder the venues it already loaded without changing the list query.
 */
export function useRestaurantSectionIds(
  section: string | null | undefined,
  options: RestaurantHomepageOptions = {},
) {
  const validSection = isRestaurantHomepageSection(section) ? section : null

  return useQuery<SectionVenueIdsPayload, Error, string[]>({
    queryKey: sectionIdsKey(validSection ?? section ?? null, options),
    queryFn: () =>
      apiFetch<SectionVenueIdsPayload>(
        buildSectionVenueIdsPath(validSection ?? 'recommended', options),
      ),
    enabled: validSection != null,
    staleTime: STALE_TIME,
    select: (data) => data.venueIds,
  })
}
