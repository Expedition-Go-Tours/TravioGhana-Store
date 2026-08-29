import type { TourDetailData } from '../hooks/useExpeditionTours'
import type { PickupAreaShape } from './pickupZone'
import type { TourScheduleInfo } from './tourAvailability'

/**
 * The booking page's tour object — the supplier's meeting/pickup/drop-off
 * config plus the traveller's selection (date, time, travelers, price).
 *
 * This shape is shared by the booking entry points (tour-detail booking widget
 * and the wishlist) and the booking page itself, so the tour context can be
 * rebuilt from a tour id alone (e.g. after a refresh) instead of only via
 * in-memory router state or the localStorage draft.
 */
export interface BookingTour {
  id: string
  slug: string
  title: string
  location: string
  pickupIncluded: boolean
  image: string
  provider: string
  rating: number
  reviews: number
  date: string
  dateISO: string
  time: string
  duration: string
  travelers: string
  travelersCount: Record<string, number>
  adults: number
  children: number
  infants: number
  selectedDate: string
  selectedTime: string | null
  price: number
  cancellation: string
  language: string
  meetingMode?: 'meeting_point' | 'pickup' | 'none'
  meetingPoint?: string
  meetingPointAddress?: string
  meetingPointDescription?: string
  meetingPointPicture?: string
  meetingPointLat?: number | null
  meetingPointLng?: number | null
  arrivalTimeType?: 'none' | '5min' | '10min' | '15min' | '30min' | 'notified' | 'custom'
  arrivalTimeCustom?: string
  pickupType?: 'area' | 'address'
  pickupTiming?: 'at_start' | 'before_start'
  pickupFinalLocationTiming?: 'day_before' | 'after_selection'
  referenceStartTime?: string
  pickupAreas?: PickupAreaShape[]
  pickupLocations?: { name?: string; address?: string; lat?: number | null; lng?: number | null }[]
  pickupDescription?: string
  dropoffOption?: 'same_location' | 'different_location' | 'none' | 'service'
  dropoffLocation?: string
  dropoffLocationAddress?: string
  dropoffDescription?: string
  scheduleType?: TourScheduleInfo['scheduleType']
  timeSlots?: TourScheduleInfo['timeSlots']
  daysOfWeek?: TourScheduleInfo['daysOfWeek']
  weeklySchedule?: TourScheduleInfo['weeklySchedule']
  startDate?: TourScheduleInfo['startDate']
  endDate?: TourScheduleInfo['endDate']
  operatingHoursStart?: string
  operatingHoursEnd?: string
  pricingModel?: 'perPerson' | 'perGroup'
  travelerPricing?: { label: string; price: number; minAge?: number | null; maxAge?: number | null; tiers?: { from: number; to: number; pricePerPerson: number }[] }[]
  groupSizePricing?: { from: number; to: number; price: number }[]
  ticketValidity?: string
  promoCode?: string | null
  appliedPromo?: { name: string; discountAmount: number } | null
}

/** Neutral placeholder used while no tour context is available yet. */
export const DEFAULT_BOOKING_TOUR: BookingTour = {
  id: '',
  slug: '',
  title: 'Loading...',
  location: '',
  pickupIncluded: false,
  image: '',
  provider: 'Travio Ghana Tours',
  rating: 0,
  reviews: 0,
  date: '',
  dateISO: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  time: '9:00 AM',
  duration: '',
  travelers: '1 adult',
  travelersCount: { adults: 1, children: 0, infants: 0 },
  adults: 1,
  children: 0,
  infants: 0,
  selectedDate: '',
  selectedTime: null,
  price: 0,
  cancellation: 'Free cancellation up to 24 hours before',
  language: 'English',
  meetingMode: undefined,
  meetingPoint: '',
  meetingPointAddress: '',
  meetingPointDescription: '',
  meetingPointPicture: '',
  meetingPointLat: null,
  meetingPointLng: null,
  arrivalTimeType: 'none',
  arrivalTimeCustom: '',
  pickupType: 'area',
  pickupTiming: 'at_start',
  pickupFinalLocationTiming: 'day_before',
  referenceStartTime: '',
  pickupAreas: [],
  pickupLocations: [],
  pickupDescription: '',
  dropoffOption: 'none',
  dropoffLocation: '',
  dropoffLocationAddress: '',
  dropoffDescription: '',
  scheduleType: undefined,
  timeSlots: [],
  daysOfWeek: [],
  weeklySchedule: {},
  operatingHoursStart: '',
  operatingHoursEnd: '',
  pricingModel: 'perPerson',
  travelerPricing: [],
  groupSizePricing: [],
  ticketValidity: undefined,
}

export interface BuildBookingTourOpts {
  /** Human-readable date label, e.g. "Monday, August 26, 2026". */
  date?: string
  /** ISO date (YYYY-MM-DD) of the traveller's chosen date. */
  dateISO?: string
  /** Chosen time-slot label (e.g. "9:00 AM") or opening-hours label. */
  time?: string
  /** Human-readable traveller summary, e.g. "2 adults, 1 child". */
  travelers?: string
  travelersPayload?: Record<string, number>
  adults?: number
  children?: number
  infants?: number
  /** The traveller's chosen price (total / group band). */
  price?: number
  selectedTime?: string | null
  promoCode?: string | null
  appliedPromo?: { name: string; discountAmount: number } | null
}

function defaultDateISO(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/**
 * Builds the booking page's tour object from a fully-resolved tour detail.
 * Shared by the booking widget (which passes the traveller's live selection)
 * and the booking page's refresh path (which rebuilds with defaults), so the
 * two always produce an identical tour context.
 */
export function buildBookingTour(tour: TourDetailData, opts: BuildBookingTourOpts = {}): BookingTour {
  const dateISO = opts.dateISO || defaultDateISO()
  const dateLabel = opts.date || new Date(`${dateISO}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
  const travelersPayload = opts.travelersPayload ?? { adults: opts.adults ?? 1, children: opts.children ?? 0, infants: opts.infants ?? 0 }
  return {
    id: tour.id,
    slug: tour.slug,
    title: tour.title,
    location: tour.location,
    pickupIncluded: !!tour.pickupIncluded,
    image: tour.images?.[0] || '',
    provider: 'Travio Ghana Tours',
    rating: tour.rating,
    reviews: tour.reviewCount,
    date: dateLabel,
    dateISO,
    time: opts.time ?? '9:00 AM',
    duration: tour.duration,
    travelers: opts.travelers ?? '1 adult',
    travelersCount: travelersPayload,
    adults: travelersPayload.adults || 0,
    children: travelersPayload.children || 0,
    infants: travelersPayload.infants || 0,
    selectedDate: opts.dateISO || '',
    selectedTime: opts.selectedTime ?? null,
    price: opts.price ?? tour.price ?? 0,
    cancellation: tour.cancellationPolicy || 'Free cancellation up to 24 hours before',
    language: tour.languages?.[0] || 'English',
    ticketValidity: tour.ticketValidity,
    meetingMode: tour.meetingMode,
    meetingPoint: tour.meetingPoint,
    meetingPointAddress: tour.meetingPointAddress,
    meetingPointDescription: tour.meetingPointDescription,
    meetingPointPicture: tour.meetingPointPicture,
    meetingPointLat: tour.meetingPointLat,
    meetingPointLng: tour.meetingPointLng,
    arrivalTimeType: tour.arrivalTimeType,
    arrivalTimeCustom: tour.arrivalTimeCustom,
    pickupType: tour.pickupType,
    pickupTiming: tour.pickupTiming,
    pickupFinalLocationTiming: tour.pickupFinalLocationTiming,
    referenceStartTime: tour.referenceStartTime,
    pickupAreas: tour.pickupAreas,
    pickupLocations: tour.pickupLocations,
    pickupDescription: tour.pickupDescription,
    dropoffOption: tour.dropoffOption,
    dropoffLocation: tour.dropoffLocation,
    dropoffLocationAddress: tour.dropoffLocationAddress,
    dropoffDescription: tour.dropoffDescription,
    scheduleType: tour.scheduleType,
    timeSlots: tour.timeSlots,
    daysOfWeek: tour.daysOfWeek,
    weeklySchedule: tour.weeklySchedule,
    startDate: tour.startDate,
    endDate: tour.endDate,
    operatingHoursStart: tour.operatingHoursStart,
    operatingHoursEnd: tour.operatingHoursEnd,
    pricingModel: tour.pricingModel,
    travelerPricing: tour.travelerPricing,
    groupSizePricing: tour.groupSizePricing,
    promoCode: opts.promoCode ?? null,
    appliedPromo: opts.appliedPromo ?? null,
  }
}
