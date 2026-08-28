// Tour Detail Page Type Definitions

export interface TourGuide {
  name: string
  memberSince: string
  avatar: string
}

export interface ContactInfo {
  email: string
  website: string
  phone: string
  fax?: string
}

export interface PricingTier {
  from: number
  to: number
  pricePerPerson: number
}

export interface TravelerPricing {
  label: string
  price: number
  minAge?: number | null
  maxAge?: number | null
  /**
   * Age-based category tiers (GetYourGuide-style): the per-person price for
   * this category depends on the TOTAL number of travelers in the whole
   * booking (not just this category's count). When present, the matching
   * tier for the current total headcount should be used instead of `price`.
   */
  tiers?: PricingTier[]
  /** Supplier rule: this category cannot be booked (notAllowed). */
  notAllowed?: boolean
  /** Supplier rule: this category is free of charge (ticketNotRequired). */
  ticketNotRequired?: boolean
  /** Supplier rule: a child/youth/teen must be accompanied by an adult or senior. */
  needsAdult?: boolean
}

export interface GroupSizeBand {
  from: number
  to: number
  price: number
}

export interface TourDetail {
  id: string
  slug: string
  title: string
  location: string
  price: number
  currency: string
  duration: string
  groupSize: number
  languages: string[]
  rating: number
  reviewCount: number
  images: string[]
  videoUrl?: string
  description: string
  shortDescription?: string
  highlights: string[]
  included: string[]
  excluded: string[]
  itinerary: ItineraryDay[]
  faqs: FAQ[]
  coordinates: { lat: number; lng: number }
  tourType: string
  availability: string[]
  difficulty?: 'Easy' | 'Moderate' | 'Challenging' | 'Strenuous'
  minAge?: number
  maxAge?: number
  pickupIncluded?: boolean
  cancellationPolicy?: string
  travelerPricing?: TravelerPricing[]
  skipTheLine?: string | null
  guide?: TourGuide
  contact?: ContactInfo
  /** How the supplier priced this tour: per traveler, or a flat price per group. */
  pricingModel?: 'perPerson' | 'perGroup'
  /** Only relevant when pricingModel is 'perPerson'. */
  pricingApproach?: 'sameForEveryone' | 'dependsOnAge'
  /** Flat per-person price used for every traveler type when pricingApproach is 'sameForEveryone'. */
  uniformPrice?: number | null
  /** Flat price bands by total group headcount, used when pricingModel is 'perGroup'. */
  groupSizePricing?: GroupSizeBand[]
  /** Supplier capacity bounds for the whole party (Viator pax-mix parity). */
  minParticipants?: number | null
  maxParticipants?: number | null
}

export interface ItineraryDay {
  day: number
  time?: string
  type?: 'activity' | 'transfer'
  title: string
  description: string
  duration?: number
  durationUnit?: 'minute' | 'hour' | 'day'
  importance?: 'major' | 'minor'
  isOptional?: boolean
  additionalFee?: boolean
  activityName?: string
  locationName?: string
  locationAddress?: string
  locationCity?: string
  locationCountry?: string
  locationLat?: number | null
  locationLng?: number | null
  /** The supplier's admission rule for this stop: included in the tour price
   *  ('yes'), paid separately ('no'), or merely passed by ('passby'). */
  admissionIncluded?: 'yes' | 'no' | 'passby'
  isCustomLocation?: boolean
  image?: string
  activities?: string[]
  meals?: string[]
  accommodation?: string
}

/**
 * Per-day logistics a supplier sets on the platform (Step 05 — the "Overnight
 * accommodation" / "Meals" panels of the day editor), persisted under
 * productContent.dayLogistics[day]. Mirrors the supplier app's shape so the
 * storefront renders the exact accommodation type / meals the supplier chose.
 */
export interface DayLogisticsEntry {
  /** Accommodation type key: 'budget' | 'midrange' | 'premium'. */
  accommodation?: string
  /** Meals for the day, e.g. { type: 'Breakfast', format: 'Buffet' }. */
  meals?: { type: string; format: string }[]
  drinksIncluded?: boolean
}

/** Per-day logistics keyed by the day number (as string or number). */
export type DayLogisticsMap = Record<string, DayLogisticsEntry | undefined>

/**
 * Display labels for the supplier's accommodation types. Values must match the
 * supplier platform's ACCOMMODATION_LABELS (utils/itineraryConstants.js) so the
 * storefront shows the exact "Midrange hotel (3 stars)"-style wording.
 */
export const ACCOMMODATION_TYPE_LABELS: Record<string, string> = {
  budget: 'Budget hotel (2 stars)',
  midrange: 'Midrange hotel (3 stars)',
  premium: 'Premium hotel (4\u20135 stars)',
}

export function formatItineraryDuration(duration?: number, unit?: string): string {
  if (duration == null) return ''
  switch (unit) {
    case 'hour':
      return `${duration}h`
    case 'day':
      return `${duration} day${duration > 1 ? 's' : ''}`
    default:
      return `${duration} min`
  }
}

export interface FAQ {
  id: string
  question: string
  answer: string
  category?: string
}

export interface Review {
  id: string
  tourId: string
  author: string
  authorId?: string
  rating: number
  date: string
  title: string
  content: string
  avatar?: string
  helpful?: number
  verified?: boolean
  images?: string[]
}

export interface ReviewStats {
  average: number
  total: number
  breakdown: {
    5: number
    4: number
    3: number
    2: number
    1: number
  }
}

export interface BookingRequest {
  tourId: string
  date: string
  adults: number
  children: number
  infants: number
  totalPrice: number
  specialRequests?: string
}

export interface RelatedTour {
  id: string
  slug: string
  title: string
  location: string
  image: string
  price: number
  currency: string
  duration: string
  rating: number
  reviewCount: number
}
