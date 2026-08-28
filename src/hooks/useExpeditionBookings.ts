import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchWithAuth } from '../lib/api'
import type { DayAvailability, DayAvailabilityInfo, DayTimeSlot } from '../lib/tourAvailability'

/**
 * `bypassCache` skips the browser's HTTP cache for this request. Availability
 * is edited live by suppliers, so the public calendar fetch must never be
 * served from a browser-cached response — mirror of the tour-detail fetch
 * hardening in useExpeditionTours.
 */
async function expeditionFetchRaw(path: string, bypassCache = false) {
  const res = await fetchWithAuth(path, {
    ...(bypassCache ? { cache: 'no-store' } : {}),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(payload.message || `Request failed (${res.status})`)
  }
  return payload
}

/** Raw shape returned by the Expedition availability calendar endpoint. */
interface RawAvailabilityDay {
  date: string
  dayOfWeek: string
  timezone?: string
  isOperatingDay: boolean
  status: 'AVAILABLE' | 'LIMITED' | 'FULL' | 'BLOCKED' | 'PAST'
  capacity: number
  booked: number
  remaining: number
  timeSlots?: RawAvailabilitySlot[]
  hasOverride: boolean
  overrideStatus: string | null
  overrideCapacity: number | null
  baseCapacity: number
  isPast: boolean
  capacityUnit?: 'groups' | 'people'
  groupsPerSlot?: number | null
  maxGroupSize?: number | null
}

interface RawAvailabilitySlot {
  time: string
  capacity: number
  booked: number
  remaining: number
  groupsBooked?: number
  groupsRemaining?: number
}

function mapDayStatus(raw: RawAvailabilityDay['status']): DayAvailability {
  switch (raw) {
    case 'LIMITED': return 'limited'
    case 'FULL': return 'full'
    case 'BLOCKED': return 'blocked'
    case 'PAST': return 'past'
    default: return 'available'
  }
}

function mapDay(raw: RawAvailabilityDay): DayAvailabilityInfo {
  const slots: DayTimeSlot[] = Array.isArray(raw.timeSlots)
    ? raw.timeSlots.map((s) => ({
        time: s.time,
        capacity: s.capacity,
        booked: s.booked || 0,
        remaining: s.remaining ?? Math.max(0, (s.capacity || 0) - (s.booked || 0)),
        groupsBooked: s.groupsBooked ?? 0,
        groupsRemaining: s.groupsRemaining ?? null,
      }))
    : []
  const capacityUnit = raw.capacityUnit === 'groups' ? 'groups' as const : 'people' as const

  // A day-limit override set BELOW the tour's default capacity limits the day.
  // The backend only labels such days AVAILABLE (status is derived purely from
  // the booked/capacity ratio), so mirror the supplier portal's mapCalendarDay:
  // an override cap below the base capacity renders as "limited".
  let status = mapDayStatus(raw.status)
  if (
    raw.overrideCapacity != null &&
    raw.baseCapacity != null &&
    raw.overrideCapacity < raw.baseCapacity &&
    (status === 'available' || status === 'limited')
  ) {
    status = 'limited'
  }

  return {
    date: raw.date,
    dayOfWeek: raw.dayOfWeek,
    isOperatingDay: raw.isOperatingDay,
    status,
    capacity: raw.capacity,
    booked: raw.booked,
    remaining: raw.remaining,
    baseCapacity: raw.baseCapacity,
    overrideCapacity: raw.overrideCapacity ?? null,
    overrideStatus: raw.overrideStatus ? mapDayStatus(raw.overrideStatus as RawAvailabilityDay['status']) : null,
    hasOverride: raw.hasOverride,
    capacityUnit,
    groupsPerSlot: raw.groupsPerSlot ?? null,
    maxGroupSize: raw.maxGroupSize ?? null,
    isPast: raw.isPast,
    timeSlots: slots,
  }
}

export function useTourAvailability(
  slug: string | undefined,
  startDate: string | undefined,
  endDate: string | undefined
) {
  return useQuery({
    queryKey: ['expedition', 'tours', slug, 'availability', startDate, endDate],
    enabled: !!slug && !!startDate && !!endDate,
    // Availability is the most time-sensitive piece of the booking widget —
    // suppliers edit it live. The global queryClient default (staleTime: 5min)
    // would let the calendar show a stale status for up to five minutes, or
    // indefinitely while the page stays open. Always treat it as stale and
    // refetch on every mount and on window focus, same as useExpeditionTour.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    // Keep the previous window's counts visible while a new month (or a
    // background refetch) resolves, so the calendar never blanks the numbers.
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const payload = await expeditionFetchRaw(
        `/travioghana/tours/${encodeURIComponent(slug!)}/availability`
        + `?startDate=${startDate!}&endDate=${endDate!}`,
        true
      )
      const data = payload.data ?? payload
      return ((data.calendar || []) as RawAvailabilityDay[]).map(mapDay)
    },
  })
}

interface CalculateCheckoutInput {
  tourId: string
  travelDate: string
  travelers: Record<string, number>
}

// Mirrors the actual shape returned by
// Travio Ghana-Backend/controllers/expeditionController.js#calculateCheckout
// — note `available`/`availableSpots` are top-level fields, not nested
// under an `availability` object, and `pricing` has no `breakdown` array.
interface CalculateCheckoutResponse {
  available: boolean
  availableSpots: number
  pricing: {
    subtotal: number
    fees: number
    discounts: number
    total: number
    currency: string
  }
  travelerSummary: {
    adults: number
    children: number
    infants: number
    total: number
  }
}

export function useCalculateCheckout() {
  return useMutation({
    mutationFn: async (input: CalculateCheckoutInput) => {
      const res = await fetchWithAuth('/travioghana/checkout/calculate', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.message || `Request failed (${res.status})`)
      }
      const result = (payload.data ?? payload) as CalculateCheckoutResponse
      return result
    },
  })
}

interface ConfirmBookingInput {
  tourId: string
  travelDate: string
  selectedTime?: string | null
  travelers: Record<string, number | string | boolean | { name: string; age: number; ageGroup: string; specialRequests?: string }[] | undefined>
  /** Required for reserve-now-pay-later (card captured for auto-charge). Pay-now redirects to Stripe's hosted Checkout and never sends a card. */
  paymentMethodId?: string
  paymentTiming?: 'now' | 'later'
  specialRequests?: string
  /** Validated promo code — the backend re-prices with it (expeditionController.confirmBooking). */
  promoCode?: string
  /** Lead traveler entered on the storefront "Lead Traveler Details" step. Sent so the
   * supplier dashboard and confirmation emails show the traveler (not the booking-owner account). */
  leadTraveler?: {
    name: string
    email: string
    phone: string
  }
}

interface ConfirmBookingResponse {
  /** Pay-later: booking created immediately. Pay-now: absent (no booking until webhook). */
  booking?: {
    id: string
    bookingNumber: string
    status: string
    total: number
    currency: string
  }
  /** Pay-now: hosted Stripe Checkout redirect. The frontend navigates the browser to `checkout.url`. */
  checkout?: {
    id: string
    url: string
  }
  /** Reserve-now-pay-later: uncharged PaymentIntent (captured by the auto-charge sweep near the activity date). */
  clientSecret?: string
  paymentIntent?: {
    id: string
    clientSecret: string
    status: string
    requiresAction?: boolean
  }
}

export function useCreateBooking() {
  return useMutation({
    mutationFn: async (input: ConfirmBookingInput) => {
      const res = await fetchWithAuth('/travioghana/checkout/confirm', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.message || `Request failed (${res.status})`)
      return (payload.data ?? payload) as ConfirmBookingResponse
    },
  })
}

/** Response shape for GET /travioghana/bookings/by-session/:sessionId */
interface BookingBySessionResponse {
  status: 'HOLDING' | 'PAID' | 'EXPIRED' | 'REFUNDED'
  expiresAt: string
  createdAt: string
  booking?: {
    id: string
    bookingNumber: string
    status: string
    total: number
    currency: string
    tour: { id: string; title: string; slug: string; coverPhoto: string | null }
    customer: { id: string; name: string; email: string }
  }
}

/**
 * Polls the checkout status for a pay-now session. Returns the status
 * and, once materialized, the booking itself.
 */
export function useBookingBySession(sessionId: string | null) {
  return useQuery<BookingBySessionResponse>({
    queryKey: ['expedition', 'booking-by-session', sessionId],
    queryFn: async () => {
      const res = await fetchWithAuth(`/travioghana/bookings/by-session/${encodeURIComponent(sessionId!)}`)
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.message || `Request failed (${res.status})`)
      return (payload.data ?? payload) as BookingBySessionResponse
    },
    enabled: !!sessionId,
    refetchInterval: (query) => {
      // Stop polling once the session is no longer in-flight.
      const status = query.state.data?.status
      if (status === 'PAID' || status === 'EXPIRED' || status === 'REFUNDED') return false
      // Stop after ~2 minutes (60 attempts) to avoid infinite spinner.
      // The backend cleanup sweep will reconcile stale sessions.
      if ((query.state.dataUpdateCount ?? 0) >= 60) return false
      return 2000
    },
  })
}

export interface ExpeditionBookingSummary {
  id: string
  bookingNumber: string
  tourTitle: string
  tourSlug: string
  tourId: string
  tourImage: string | null
  tourLocation: string
  tourDurationMinutes: number | null
  travelDate: string
  status: string
  paymentTiming?: 'now' | 'later'
  paymentStatus?: string
  total: number
  currency: string
  createdAt: string
}

interface RawBookingListRecord {
  id: string
  bookingNumber: string
  status: string
  paymentTiming?: 'now' | 'later'
  paymentStatus?: string
  total: number | string
  currency: string
  createdAt: string
  travelDate: string
  tour: {
    id: string
    title: string
    slug: string
    coverPhoto: string | null
    photos: string[]
    city?: string | null
    country?: string | null
    durationMinutes?: number | null
  }
}

function mapBookingSummary(b: RawBookingListRecord): ExpeditionBookingSummary {
  return {
    id: b.id,
    bookingNumber: b.bookingNumber,
    tourTitle: b.tour?.title || '',
    tourSlug: b.tour?.slug || '',
    tourId: b.tour?.id || '',
    tourImage: b.tour?.coverPhoto || b.tour?.photos?.[0] || null,
    tourLocation: [b.tour?.city, b.tour?.country].filter(Boolean).join(', '),
    tourDurationMinutes: b.tour?.durationMinutes ?? null,
    travelDate: b.travelDate,
    status: b.status,
    paymentTiming: b.paymentTiming,
    paymentStatus: b.paymentStatus,
    total: Number(b.total),
    currency: b.currency,
    createdAt: b.createdAt,
  }
}

export function useMyExpeditionBookings(page: number = 1, status?: string, limit?: number) {
  const params = new URLSearchParams({ page: String(page) })
  if (status) params.set('status', status)
  if (limit) params.set('limit', String(limit))

  return useQuery({
    queryKey: ['expedition', 'bookings', page, status, limit],
    queryFn: async () => {
      const payload = await expeditionFetchRaw(`/travioghana/bookings?${params.toString()}`)
      const data = payload.data ?? payload
      const records: RawBookingListRecord[] = data.bookings || []
      return records.map(mapBookingSummary)
    },
  })
}

/**
 * Total number of the customer's bookings matching `status` (default
 * CONFIRMED + PENDING, which includes reserve-now-pay-later reservations) — a
 * lightweight count used for the navbar "Bookings" counter. Fetches one record
 * and reads the list endpoint's pagination totalCount, so it never transfers
 * the full booking history.
 */
export function useMyBookingsCount(status: string = 'CONFIRMED,PENDING', enabled = true) {
  return useQuery({
    queryKey: ['expedition', 'bookings', 'count', status],
    enabled,
    queryFn: async (): Promise<number> => {
      const payload = await expeditionFetchRaw(
        `/travioghana/bookings?page=1&limit=1&status=${encodeURIComponent(status)}`
      )
      const data = payload.data ?? payload
      const total = data?.pagination?.totalCount ?? payload?.pagination?.totalCount ?? 0
      return typeof total === 'number' ? total : Number(total) || 0
    },
  })
}

interface RawBookingDetailRecord {
  id: string
  status: string
  tour: { id: string; slug: string; title: string }
  review?: { id: string } | null
}

/**
 * Finds the current customer's completed booking for a given tour that is
 * eligible for a review (status COMPLETED, no existing review). Used to
 * resolve a real bookingId before navigating to the "Write a Review" page —
 * the review submission endpoint requires an actual booking id, not a tour id.
 *
 * Returns `undefined` while loading, `null` if no eligible booking was found,
 * or the booking id string if one exists.
 */
export function useReviewableBookingForTour(tourSlugOrId: string | undefined) {
  return useQuery({
    queryKey: ['expedition', 'bookings', 'reviewable', tourSlugOrId],
    enabled: !!tourSlugOrId,
    queryFn: async (): Promise<string | null> => {
      // getMyBookings doesn't expose a tour filter or the review relation,
      // so pull completed bookings and match client-side against the tour,
      // then verify via the single-booking endpoint (which does include
      // `review`) whether it's still eligible.
      const payload = await expeditionFetchRaw('/travioghana/bookings?status=COMPLETED&limit=100')
      const data = payload.data ?? payload
      const records: RawBookingListRecord[] = data.bookings || []
      const bookings = records.map(mapBookingSummary)

      const match = bookings.find(
        (b) => b.tourSlug === tourSlugOrId || b.tourId === tourSlugOrId
      )
      if (!match) return null

      try {
        const detailPayload = await expeditionFetchRaw(`/travioghana/bookings/${encodeURIComponent(match.id)}`)
        const detail: RawBookingDetailRecord = (detailPayload.data ?? detailPayload)?.booking ?? {}
        if (detail.review) return null // already reviewed
        return match.id
      } catch {
        // If the detail fetch fails, fall back to the summary match — the
        // create-review call will still correctly reject it if a review
        // already exists (409 "already reviewed").
        return match.id
      }
    },
  })
}

/**
 * Fetches a single booking record (includes `travelers` JSON and the tour
 * relation). The backend only returns the authenticated customer's own
 * bookings, so this is filter-safe.
 */
export function useExpeditionBookingDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: ['expedition', 'bookings', id, 'detail'],
    enabled: !!id,
    queryFn: async () => {
      const payload = await expeditionFetchRaw(`/travioghana/bookings/${encodeURIComponent(id!)}`)
      const data = payload.data ?? payload
      return data.booking
    },
  })
}

/**
 * Cancels the customer's own booking via
 * PATCH /travioghana/bookings/:id/cancel. The backend enforces the tour's
 * cancellation policy (a 400 with a human-readable reason is surfaced via
 * the thrown Error message) and refunds via Stripe when eligible.
 */
export function useCancelBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { id: string; reason: string }) => {
      const res = await fetchWithAuth(`/travioghana/bookings/${encodeURIComponent(input.id)}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: input.reason }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.message || `Request failed (${res.status})`)
      }
      return (payload.data?.booking ?? payload) as { id: string; status: string; refundAmount?: number | null }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expedition', 'bookings'] })
    },
  })
}
