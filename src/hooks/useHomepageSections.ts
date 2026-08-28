/**
 * Homepage Section Hooks
 *
 * React Query hooks for each homepage section.
 * Each hook calls the corresponding backend endpoint and returns
 * pre-sorted, algorithmically ranked tour data.
 *
 * @version 1.0.0
 */

import { useQuery } from '@tanstack/react-query'
import { fetchWithAuth } from '../lib/api'
import { getStoredLocation } from '../lib/analytics'
import { enrichTourBadgeFields } from './useExpeditionTours'
import type { TourCardData } from './useExpeditionTours'

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface SpecialOfferData {
  id: string
  name: string
  offerType: 'LIMITED_TIME' | 'EARLY_BIRD' | 'LAST_MINUTE'
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT'
  discountPercentage: number | null
  fixedDiscountValue: number | null
  startDate: string | null
  endDate: string | null
  promoCode: string | null
  timeSlotMode: 'ALL_DAYS' | 'SPECIFIC_WEEKDAYS'
  specificWeekdays: string[]
  capacityType: 'UNLIMITED' | 'CAPPED'
  maxSpots: number | null
  spotsSold: number | null
  minQuantity: number | null
  minSpendAmount: number | null
  maxRedemptionsPerCustomer: number | null
  stackable: boolean
  earlyBirdAdvanceDays: number | null
  lastMinuteWindowHours: number | null
  targets: { tourId: string; tourOptionKey: string | null; tourOptionLabel: string | null }[]
}

export interface HomepageTour {
  id: string
  title: string
  slug: string
  coverPhoto: string | null
  photos: string[]
  category: string | null
  city: string | null
  country: string | null
  averageRating: number | null
  reviewCount: number
  totalBookings: number
  startingPrice: number | null
  currency: string
  durationMinutes: number | null
  difficulty: string | null
  tags: string[]
  supplier: {
    id: string
    name: string
    photo: string | null
    rating: number | null
  } | null
  // Badge fields the tour card renders. The homepage endpoints don't project
  // these â€” they're backfilled client-side from the full /tours listing by
  // enrichTourBadgeFields() so the cards show the same badges as the
  // tour-detail "similar experiences" row.
  languages?: string[]
  cancellationPolicy?: string | null
  pickupIncluded?: boolean
  meetingMode?: 'meeting_point' | 'pickup' | 'none'
  accommodationIncluded?: boolean
  /** Set by the backend for sell-out tours; the frontend otherwise derives it
      from section membership (see SellOutContext). */
  likelyToSellOut?: boolean
  /** Supplier-applied offers for this tour (only set by endpoints that
      project them, e.g. /homepage/offers). */
  specialOffers?: SpecialOfferData[]
  _score?: number
  _velocity14d?: number
  _bayesianRating?: number
  _views7d?: number
  _bookings7d?: number
  _wishlists7d?: number
  _distance?: number | null
}

export interface MoodKeyword {
  keyword: string
  image: string | null
  tourCount: number
  category: string | null
  city: string | null
}

export interface PopularDestination {
  city: string
  country: string | null
  tourCount: number
  totalBookings: number
  avgRating: number | null
  heroImage: string | null
}

export interface HomepageAttraction {
  name: string
  tourCount: number
  heroImage: string | null
  avgRating: number | null
  totalBookings: number
  startingPrice: number | null
  lat: number | null
  lng: number | null
  _distance?: number | null
}

// â”€â”€â”€ Unified Homepage Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface HomepageData {
  sellOut: HomepageTour[]
  topRated: HomepageTour[]
  trending: HomepageTour[]
  recommended: HomepageTour[]
  new: HomepageTour[]
  attractions: HomepageAttraction[]
  mood: MoodKeyword[]
  destinations: PopularDestination[]
  offers: HomepageOfferTour[]
}

/**
 * Single request that fetches all homepage sections.
 * Returns pre-computed data from Redis (0 DB queries) when available.
 */
export function useHomepage() {
  return useQuery({
    queryKey: ['homepage', 'all'],
    queryFn: async () => {
      const data = await fetchHomepageSection<HomepageData>('')

      // The homepage endpoints don't project specialOffers on the tour slices
      // (only the dedicated /offers list carries them). Merge the offers in by
      // tour id so a tour with a live offer renders its "Special Offer" badge
      // on every card it appears on.
      const byId = new Map<string, SpecialOfferData[]>()
      for (const offerTour of data.offers ?? []) {
        if (offerTour.specialOffers?.length) byId.set(offerTour.id, offerTour.specialOffers)
      }

      return {
        ...data,
        recommended: applyOffersById(await enrichTourBadgeFields(data.recommended), byId),
        topRated: applyOffersById(await enrichTourBadgeFields(data.topRated), byId),
        sellOut: applyOffersById(await enrichTourBadgeFields(data.sellOut), byId),
        trending: applyOffersById(await enrichTourBadgeFields(data.trending), byId),
        new: applyOffersById(await enrichTourBadgeFields(data.new), byId),
        offers: await enrichTourBadgeFields(data.offers),
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

// â”€â”€â”€ Fetcher â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fetchHomepageSection<T>(path: string): Promise<T> {
  const res = await fetchWithAuth(`/travioghana/homepage${path}`)
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(payload.message || `Request failed (${res.status})`)
  }
  return payload.data
}

// â”€â”€â”€ Offer merge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * The homepage endpoints don't project specialOffers on the tour slices (only
 * the dedicated /homepage/offers list carries them). These helpers fetch that
 * list once and merge each tour's specialOffers back onto the cards by id, so
 * a tour with a live offer shows its "Special Offer" badge in every section
 * it appears in. The promise is cached per page load so the per-section
 * fallback hooks share a single offers request.
 */

let offersByIdPromise: Promise<Map<string, SpecialOfferData[]>> | null = null

function getOffersByIdMap(): Promise<Map<string, SpecialOfferData[]>> {
  if (!offersByIdPromise) {
    offersByIdPromise = (async () => {
      try {
        const data = await fetchHomepageSection<{ tours: HomepageOfferTour[] }>('/offers?limit=100')
        const map = new Map<string, SpecialOfferData[]>()
        for (const t of data.tours ?? []) {
          if (t.specialOffers?.length) map.set(t.id, t.specialOffers)
        }
        return map
      } catch {
        return new Map()
      }
    })()
  }
  return offersByIdPromise
}

export function applyOffersById<T extends { id: string }>(tours: T[], byId: Map<string, SpecialOfferData[]>): T[] {
  if (!tours || tours.length === 0 || byId.size === 0) return tours
  return tours.map((t) => {
    const offers = byId.get(t.id)
    return offers ? { ...t, specialOffers: offers } : t
  })
}

/** Merge the cached /homepage/offers list onto a tour array by id. */
export async function mergeOffersIntoTours<T extends { id: string }>(tours: T[]): Promise<T[]> {
  return applyOffersById(tours, await getOffersByIdMap())
}

// â”€â”€â”€ Hooks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Likely to Sell Out â€” tours with booking momentum in last 14 days.
 */
export function useLikelySellOut(limit = 12) {
  return useQuery({
    queryKey: ['homepage', 'sell-out', limit],
    queryFn: async () => {
      const data = await fetchHomepageSection<{ tours: HomepageTour[] }>(`/sell-out?limit=${limit}`)
      return { ...data, tours: await mergeOffersIntoTours(await enrichTourBadgeFields(data.tours)) }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data) => data.tours,
  })
}

/**
 * Top Rated â€” Bayesian-smoothed quality scores.
 */
export function useTopRated(limit = 12) {
  return useQuery({
    queryKey: ['homepage', 'top-rated', limit],
    queryFn: async () => {
      const data = await fetchHomepageSection<{ tours: HomepageTour[] }>(`/top-rated?limit=${limit}`)
      return { ...data, tours: await mergeOffersIntoTours(await enrichTourBadgeFields(data.tours)) }
    },
    staleTime: 5 * 60 * 1000,
    select: (data) => data.tours,
  })
}

/**
 * Trending Now â€” view/booking/wishlist velocity (7d vs prior 7d).
 */
export function useTrending(limit = 12) {
  return useQuery({
    queryKey: ['homepage', 'trending', limit],
    queryFn: async () => {
      const data = await fetchHomepageSection<{ tours: HomepageTour[] }>(`/trending?limit=${limit}`)
      return { ...data, tours: await mergeOffersIntoTours(await enrichTourBadgeFields(data.tours)) }
    },
    staleTime: 5 * 60 * 1000,
    select: (data) => data.tours,
  })
}

/**
 * Recommended for You â€” personalized by behavior + location + quality.
 */
export function useRecommended(limit = 12) {
  const location = getStoredLocation()
  const params = new URLSearchParams({ limit: String(limit) })
  if (location) {
    params.set('lat', String(location.lat))
    params.set('lng', String(location.lng))
  }

  return useQuery({
    queryKey: ['homepage', 'recommended', limit, location?.lat, location?.lng],
    queryFn: async () => {
      const data = await fetchHomepageSection<{ tours: HomepageTour[] }>(`/recommended?${params}`)
      return { ...data, tours: await mergeOffersIntoTours(await enrichTourBadgeFields(data.tours)) }
    },
    staleTime: 5 * 60 * 1000,
    select: (data) => data.tours,
  })
}

/**
 * New Experiences â€” tours created in last 30 days.
 */
export function useNewExperiences(limit = 10) {
  return useQuery({
    queryKey: ['homepage', 'new', limit],
    queryFn: async () => {
      const data = await fetchHomepageSection<{ tours: HomepageTour[] }>(`/new?limit=${limit}`)
      return { ...data, tours: await mergeOffersIntoTours(await enrichTourBadgeFields(data.tours)) }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    select: (data) => data.tours,
  })
}

/**
 * Attractions â€” grouped by attraction name from tour data.
 * Uses location for proximity sorting when available.
 */
export function useAttractions(limit = 12) {
  const location = getStoredLocation()
  const params = new URLSearchParams({ limit: String(limit) })
  if (location) {
    params.set('lat', String(location.lat))
    params.set('lng', String(location.lng))
  }

  return useQuery({
    queryKey: ['homepage', 'attractions', limit, location?.lat, location?.lng],
    queryFn: () => fetchHomepageSection<{ attractions: HomepageAttraction[] }>(`/attractions?${params}`),
    staleTime: 5 * 60 * 1000,
    select: (data) => data.attractions,
  })
}

/**
 * Tours for a specific attraction â€” filtered by attraction name.
 * Only enabled when attractionName is provided.
 */
export function useAttractionTours(attractionName: string | null, limit = 12) {
  return useQuery({
    queryKey: ['homepage', 'attraction-tours', attractionName, limit],
    queryFn: async () => {
      const data = await fetchHomepageSection<{ tours: HomepageTour[] }>(
        `/attractions/tours?name=${encodeURIComponent(attractionName!)}&limit=${limit}`
      )
      return { ...data, tours: await mergeOffersIntoTours(await enrichTourBadgeFields(data.tours)) }
    },
    staleTime: 5 * 60 * 1000,
    select: (data) => data.tours,
    enabled: !!attractionName,
  })
}

/**
 * Mood Keywords â€” dynamic keywords for "What do you want to do?"
 */
export function useMoodKeywords(limit = 8) {
  return useQuery({
    queryKey: ['homepage', 'mood', limit],
    queryFn: () => fetchHomepageSection<{ keywords: MoodKeyword[] }>(`/mood?limit=${limit}`),
    staleTime: 5 * 60 * 1000,
    select: (data) => data.keywords
      .filter(k => k.keyword && typeof k.keyword === 'string' && k.keyword.trim().length > 0)
      .map(k => ({
        ...k,
        image: k.image && typeof k.image === 'string' && k.image.startsWith('http')
          ? k.image
          : null,
      })),
  })
}

/**
 * Popular Destinations â€” cities with most tours/bookings.
 */
export function usePopularDestinations(limit = 10) {
  return useQuery({
    queryKey: ['homepage', 'destinations', limit],
    queryFn: () => fetchHomepageSection<{ destinations: PopularDestination[] }>(`/destinations?limit=${limit}`),
    staleTime: 60 * 60 * 1000, // 1 hour
    select: (data) => data.destinations,
  })
}

/**
 * Returns tour IDs curated by a specific homepage section's algorithm.
 * Reads from pre-computed Redis cache on the backend (0 DB queries).
 * Used by AllToursPage to filter the tour list when ?section= is set.
 */
export function useSectionTourIds(section: string) {
  return useQuery({
    queryKey: ['homepage', 'section-tour-ids', section],
    queryFn: () => fetchHomepageSection<{ tourIds: string[] }>(
      `/section-tour-ids?section=${encodeURIComponent(section)}`
    ),
    staleTime: 5 * 60 * 1000,
    select: (data) => data.tourIds,
    enabled: !!section,
  })
}

export interface HomepageOfferTour extends HomepageTour {
  offerId: string
  offerName: string
  offerType: string
  discountType: string
  discountPercentage: number | null
  fixedDiscountValue: number | null
  startDate: string | null
  endDate: string | null
  specialOffers: SpecialOfferData[]
}

/**
 * Tours with active special offers â€” single efficient query (no N+1).
 * Powers the "Special Offers" / "Last Minute Deals" homepage section.
 */
export function useHomepageOffers(limit = 12) {
  return useQuery({
    queryKey: ['homepage', 'offers', limit],
    queryFn: async () => {
      const data = await fetchHomepageSection<{ tours: HomepageOfferTour[] }>(`/offers?limit=${limit}`)
      return { ...data, tours: await enrichTourBadgeFields(data.tours) }
    },
    staleTime: 5 * 60 * 1000,
    select: (data) => data.tours,
  })
}

// â”€â”€â”€ Mapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Map an API HomepageTour to the full TourCardData shape that TourCard
 * expects. This is the only bridge between the new API shape and the
 * existing UI â€” every homepage section that renders TourCards feeds through
 * here so cards get the same props (slug, priceValue, photos, ...) as the
 * tour-detail "similar experiences" cards.
 */
export function mapToTourCard(t: HomepageTour): TourCardData {
  const durationStr = t.durationMinutes
    ? t.durationMinutes >= 1440
      ? `${Math.round(t.durationMinutes / 1440)} days`
      : `${Math.round(t.durationMinutes / 60)} hours`
    : ''

  const location = [t.city, t.country].filter(Boolean).join(', ')

  return {
    id: t.id,
    title: t.title,
    slug: t.slug,
    category: t.category || '',
    duration: durationStr,
    features: t.tags?.join(', ') || '',
    price: t.startingPrice != null ? `$${t.startingPrice}` : '',
    priceValue: t.startingPrice != null ? t.startingPrice : null,
    rating: t.averageRating != null ? String(t.averageRating) : '',
    reviews: t.reviewCount || 0,
    location,
    image: t.coverPhoto || t.photos?.[0] || '',
    photos: t.photos,
    source: 'Travio Ghana',
    specialOffers: t.specialOffers,
    difficulty: t.difficulty || undefined,
    languages: t.languages?.length ? t.languages : undefined,
    cancellationPolicy: t.cancellationPolicy || undefined,
    pickupIncluded: t.pickupIncluded,
    meetingMode: t.meetingMode,
    accommodationIncluded: t.accommodationIncluded || undefined,
    likelyToSellOut: t.likelyToSellOut,
  }
}
