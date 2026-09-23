import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchWithAuth } from '../lib/api'
import { getStoredAuthTokens } from '../lib/auth'
import { useAuthUser } from './useAuthUser'
import type { DayAvailability, DayAvailabilityInfo, DayTimeSlot } from '../lib/tourAvailability'
import type { CancellationChoice, RefundStatus } from '../lib/cancellationChoice'

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
  /** Operating-hours/flexible days whose whole-day booking window has closed. */
  closedCutoff?: boolean
  closesAt?: string | null
}

interface RawAvailabilitySlot {
  time: string
  capacity: number
  booked: number
  remaining: number
  groupsBooked?: number
  groupsRemaining?: number
  /** True when the slot's booking cut-off has already passed. */
  closed?: boolean
  /** ISO instant when the slot stops accepting bookings (null = always open). */
  closesAt?: string | null
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
        closed: s.closed === true,
        closesAt: s.closesAt ?? null,
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
  // Operating-hours / flexible days whose whole-day booking window has closed
  // must read as blocked so the calendar never offers an unbookable date.
  if (raw.closedCutoff === true && !raw.isPast && slots.length === 0 && (status === 'available' || status === 'limited')) {
    status = 'blocked'
  }

  return {
    date: raw.date,
    dayOfWeek: raw.dayOfWeek,
    timezone: raw.timezone ?? undefined,
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
    closedCutoff: raw.closedCutoff === true,
    closesAt: raw.closesAt ?? null,
    timeSlots: slots,
  }
}

export function useTourAvailability(
  slug: string | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  optionId?: string | null
) {
  return useQuery({
    queryKey: ['expedition', 'tours', slug, 'availability', startDate, endDate, optionId || 'default'],
    enabled: !!slug && !!startDate && !!endDate,
    // Availability is the most time-sensitive piece of the booking widget —
    // suppliers edit it live. A 30 s window keeps it effectively live while
    // avoiding a refetch on every remount of the widget (mobile back/forward).
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    // Keep the previous window's counts visible while a new month (or a
    // background refetch) resolves, so the calendar never blanks the numbers.
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const payload = await expeditionFetchRaw(
        `/travioghana/tours/${encodeURIComponent(slug!)}/availability`
        + `?startDate=${startDate!}&endDate=${endDate!}`
        + (optionId ? `&option=${encodeURIComponent(optionId)}` : ''),
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
  /** Multi-option tours: quote against this option (default when omitted). */
  optionId?: string
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
  travelers: Record<string, number | string | boolean | { name: string; ageGroup: string; specialRequests?: string }[] | undefined>
  /** Multi-option tours: the sellable option being booked. */
  optionId?: string
  /** Required for reserve-now-pay-later (card captured for auto-charge). Pay-now with the
   * branded Payment Element checkout never sends a card. */
  paymentMethodId?: string
  paymentTiming?: 'now' | 'later'
  /** Pay-now checkout mode. 'hosted' = Stripe Checkout redirect (legacy); 'payment-element'
   * = branded custom checkout (server-created PaymentIntent, settled by webhook). */
  checkoutFlow?: 'hosted' | 'payment-element'
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
    grossAmount?: number | string
    currency: string
  }
  /** Pay-now: hosted Stripe Checkout redirect (legacy). The frontend navigates to `checkout.url`. */
  checkout?: {
    id: string
    url: string
  }
  /** Pay-now: branded Payment Element checkout. The backend minted an unconfirmed
   * PaymentIntent from the server-calculated amount; success is settled ONLY by the
   * payment_intent.succeeded webhook (never by the frontend saying "it worked"). */
  payment?: {
    draftId: string
    paymentIntentId: string
    clientSecret: string
    expiresAt: string
    amount: number
    currency: string
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

/** Server-authoritative order summary for the branded checkout page. */
export interface CheckoutDraftSummary {
  id: string
  expiresAt: string
  tour: {
    id: string
    title: string
    slug: string
    coverPhoto: string | null
    location: string
    durationMinutes: number | null
    description?: string | null
  }
  travelDate: string
  selectedTime: string | null
  party: { adults: number; children: number; infants: number; total: number }
  leadTraveler: { name: string | null; email: string | null; phone: string | null }
  promoCode: string | null
  currency: string
  pricing: { subtotal: number; total: number; discount: number; fees: number; taxes: number }
  paymentIntentId: string | null
  clientSecret: string | null
  customerSessionClientSecret: string | null
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
    grossAmount?: number | string
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
  /** True when the customer chose "pickup later" (no pickup location yet). */
  pickupDeferred?: boolean
  /** Booked time slot (when the tour uses fixed time slots). */
  selectedTime?: string | null
  /** Traveler party breakdown parsed from the booking's travelers JSON. */
  party?: { adults: number; children: number; infants: number; total: number }
  total: number
  currency: string
  createdAt: string
  /** Customer-facing refund state: 'open' (refund pending / under review),
   *  'closed' (money back), or null (no refund lifecycle). */
  refundState?: 'open' | 'closed' | null
  /** True when the customer has already left a review for this booking. */
  reviewed?: boolean
  /** Supplier-cancelled choice flow — one-time token, present only while a
   *  decision is still owed for this booking. */
  cancellationChoiceToken?: string | null
  cancellationChoiceDeadline?: string | null
  customerChoice?: CancellationChoice | null
  refundStatus?: RefundStatus | string | null
  cancellationReason?: string | null
  refundAmount?: number | null
}

interface RawBookingListRecord {
  id: string
  bookingNumber: string
  status: string
  paymentTiming?: 'now' | 'later'
  paymentStatus?: string
  grossAmount: number | string
  currency: string
  createdAt: string
  travelDate: string
  selectedTime?: string | null
  cancellationChoiceToken?: string | null
  cancellationChoiceDeadline?: string | null
  customerChoice?: string | null
  refundStatus?: string | null
  cancellationReason?: string | null
  refundAmount?: number | string | null
  travelers?: unknown
  pickup?: Record<string, unknown> | null
  refundedAt?: string | null
  refundState?: 'open' | 'closed' | null
  reviewed?: boolean
  disputes?: { id: string; status: string }[]
  tour: {
    id: string
    title: string
    slug: string
    coverPhoto: string | null
    photos: string[]
    city?: string | null
    destinationCity?: string | null
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
    pickupDeferred: !!(
      b.pickup &&
      typeof b.pickup === 'object' &&
      ((b.pickup as Record<string, unknown>).pickupLater ||
        (b.pickup as Record<string, unknown>).skipValidation ||
        (b.pickup as Record<string, unknown>).status === 'deferred')
    ),
    selectedTime: typeof b.selectedTime === 'string' ? b.selectedTime : null,
    party: (() => {
      const t = (b.travelers && typeof b.travelers === 'object' ? b.travelers : {}) as Record<string, unknown>
      const count = (v: unknown) => (typeof v === 'number' && v > 0 ? v : 0)
      const adults = count(t.adults)
      const children = count(t.children)
      const infants = count(t.infants)
      const details = Array.isArray(t.details) ? t.details : null
      const total = details && details.length > 0 ? details.length : adults + children + infants
      return { adults, children, infants, total }
    })(),
    total: Math.round((Number(b.grossAmount) || 0) * 100) / 100,
    currency: b.currency,
    createdAt: b.createdAt,
    refundState: b.refundState ?? null,
    reviewed: !!b.reviewed,
    cancellationChoiceToken: b.cancellationChoiceToken ?? null,
    cancellationChoiceDeadline: b.cancellationChoiceDeadline ?? null,
    customerChoice: (b.customerChoice ?? null) as CancellationChoice | null,
    refundStatus: b.refundStatus ?? null,
    cancellationReason: b.cancellationReason ?? null,
    refundAmount: b.refundAmount == null ? null : Number(b.refundAmount),
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
    // Badge freshness: socket pushes invalidate this query for near-instant
    // updates, so the interval is only a self-healing fallback. 5 minutes
    // keeps mobile radios quiet; window focus still refreshes immediately.
    refetchInterval: enabled ? 300_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
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
  // The query only has meaning for an authenticated customer, and its endpoint
  // is protected. Gate it on a real session so signed-out visitors / dead
  // sessions never fire pointless requests (401 spam + retries), scope the
  // cache per user, and fail soft to null — eligibility is informational.
  const user = useAuthUser()
  const hasToken = Boolean(getStoredAuthTokens().accessToken)

  return useQuery({
    queryKey: ['expedition', 'bookings', 'reviewable', user?.id ?? 'anon', tourSlugOrId],
    enabled: !!tourSlugOrId && !!user && hasToken,
    retry: 0,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<string | null> => {
      try {
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
      } catch {
        // Signed-out / expired session (401) or a transient failure resolves to
        // "no eligible booking" rather than throwing and retry-spamming.
        return null
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

/**
 * Customer self-service pickup update ("Choose pickup location later"
 * completion flow) via PATCH /travioghana/bookings/:id/pickup. Sends the same
 * selection shapes as checkout ({ skipValidation: true } | { mode, areaName }
 * | { mode, address }) — the backend re-validates against the tour's current
 * pickup zones/locations.
 */
export function useUpdateBookingPickup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { id: string; pickup: Record<string, unknown> }) => {
      const res = await fetchWithAuth(`/travioghana/bookings/${encodeURIComponent(input.id)}/pickup`, {
        method: 'PATCH',
        body: JSON.stringify({ pickup: input.pickup }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.message || `Request failed (${res.status})`)
      }
      return (payload.data?.pickup ?? payload) as Record<string, unknown>
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['expedition', 'bookings'] })
      queryClient.invalidateQueries({ queryKey: ['expedition', 'bookings', vars.id, 'detail'] })
    },
  })
}

/**
 * Loads the current customer's HOLDING checkout draft (server-authoritative
 * order summary + fresh PaymentIntent client secret). Used by the branded
 * Payment Element page so it survives a hard refresh mid-payment.
 */export function useCheckoutDraft(draftId: string | undefined) {
  return useQuery<CheckoutDraftSummary | null>({
    queryKey: ['expedition', 'checkout-draft', draftId],
    enabled: !!draftId,
    queryFn: async () => {
      const res = await fetchWithAuth(`/travioghana/checkout/draft/${encodeURIComponent(draftId!)}`)
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.message || `Request failed (${res.status})`)
      return (payload.data?.draft ?? null) as CheckoutDraftSummary | null
    },
    staleTime: 30_000,
  })
}

/**
 * Explicitly frees the seat hold (and cancels the unconfirmed PaymentIntent)
 * when the customer abandons the branded checkout page.
 */
export function useReleaseCheckoutDraft() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchWithAuth(`/travioghana/checkout/draft/${encodeURIComponent(id)}/release`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.message || `Request failed (${res.status})`)
      return payload.data
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['expedition', 'checkout-draft', id] })
    },
  })
}

/** Pay-later actionability of an own booking (used to drive the UI CTA). */
export interface PayLaterPaymentState {
  canPayNow: boolean
  requiresAction: boolean
  autoChargeScheduled: boolean
  bookingNumber: string
  travelDate?: string | null
}

/**
 * Reads whether an unpaid reserve-now-pay-later booking can be paid now online
 * (3DS / card failure escalation, or simply paying early). 404 (not found /
 * not yours) is treated as "no action available".
 */
export function useBookingPaymentState(id: string | null | undefined) {
  return useQuery<PayLaterPaymentState | null>({
    queryKey: ['expedition', 'bookings', id, 'payment-state'],
    enabled: !!id,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      if (!id) return null
      const res = await fetchWithAuth(`/travioghana/bookings/${encodeURIComponent(id)}/payment-state`)
      if (res.status === 404) return null
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.message || `Request failed (${res.status})`)
      return (payload.data?.paymentState ?? null) as PayLaterPaymentState | null
    },
  })
}

/**
 * Starts a hosted Stripe Checkout session to complete an unpaid pay-later
 * booking now (resolves 3DS / card update / pay early). Returns the Stripe
 * hosted URL the caller should redirect to.
 */
export function useStartPayLaterPayNow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchWithAuth(`/travioghana/bookings/${encodeURIComponent(id)}/pay-now`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.message || `Request failed (${res.status})`)
      return (payload.data?.url ?? null) as string | null
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expedition', 'bookings'] })
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Booking modification ("Edit trip") — party size / date / time.
// Mirrors the backend contract in
// Travio Ghana-Backend/utils/bookingModify.js + expeditionController.
// ─────────────────────────────────────────────────────────────────────────────

export type ModifyMoneyMode = 'refund' | 'topup' | 'none' | 'paylater-update'

export interface BookingModifyPolicy {
  allowed: boolean
  reason?: string | null
  cutoffHours: number | null
  deadline?: string | null
}

export interface BookingModifyPendingPayment {
  changeId: string
  amount: number | null
  expiresAt?: string | null
  createdAt?: string
}

export interface ModifyQuoteResponse {
  bookingId: string
  bookingNumber: string
  allowed: boolean
  policy: BookingModifyPolicy
  current: {
    travelDate: string
    selectedTime: string | null
    travelerTotal: number
    travelers: Record<string, number>
    grossAmount: number
  }
  quote: {
    travelDate: string
    selectedTime: string | null
    travelers: Record<string, number>
    travelerTotal: number
    subtotal: number
    discount: number
    previousTotal: number
    newTotal: number
    delta: number
    currency: string
    moneyMode: ModifyMoneyMode
    changes: { label: string; detail: string }[]
    capacity?: { availableSpots?: number; groupsRemaining?: number | null }
  }
}

export interface ModifyApplyResult {
  bookingId: string
  status: 'APPLIED' | 'PENDING_PAYMENT'
  bookingNumber?: string
  changeId?: string
  expiresAt?: string
  money?: { mode: ModifyMoneyMode; previousTotal: number; newTotal: number; delta: number; currency: string }
  quote?: { travelDate: string; selectedTime: string | null; travelerTotal: number; travelers: Record<string, number> }
  payment?: {
    paymentIntentId: string
    clientSecret: string
    amount: number
    currency: string
    expiresAt: string
  }
}

export interface BookingModifyChanges {
  travelDate?: string
  selectedTime?: string | null
  travelers?: Record<string, number>
}

/** Which parts of the request actually differ from the booking. */
function modifyChangeKeys(booking: { travelDate: string; selectedTime: string | null; travelers: Record<string, number> } | undefined, changes: BookingModifyChanges) {
  const keys: string[] = []
  if (!booking) return keys
  if (changes.travelDate && changes.travelDate !== String(booking.travelDate).slice(0, 10)) keys.push('travelDate')
  if (changes.selectedTime !== undefined && changes.selectedTime !== (booking.selectedTime || null)) keys.push('selectedTime')
  if (changes.travelers && Object.keys(changes.travelers).length > 0) {
    const cur = booking.travelers || {}
    const different = Object.keys(changes.travelers).some((k) => changes.travelers![k] !== (cur[k] ?? 0))
    if (different) keys.push('travelers')
  }
  return keys
}

/**
 * Live quote for a booking modification. The query is enabled only when at
 * least one field actually differs from the current booking.
 */
export function useBookingModifyQuote(
  id: string | null | undefined,
  booking: { travelDate: string; selectedTime: string | null; travelers: Record<string, number> } | undefined,
  changes: BookingModifyChanges
) {
  const keys = modifyChangeKeys(booking, changes)
  const serialized = JSON.stringify(changes)
  return useQuery<ModifyQuoteResponse>({
    queryKey: ['expedition', 'bookings', id, 'modify-quote', serialized],
    enabled: !!id && !!booking && keys.length > 0,
    staleTime: 20_000,
    retry: false,
    queryFn: async () => {
      const res = await fetchWithAuth(`/travioghana/bookings/${encodeURIComponent(id!)}/modify/quote`, {
        method: 'POST',
        body: JSON.stringify(changes),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.message || `Request failed (${res.status})`)
      return (payload.data ?? payload) as ModifyQuoteResponse
    },
  })
}

/**
 * Applies a modification. Returns APPLIED (no extra payment) or PENDING_PAYMENT
 * with the server-minted top-up PaymentIntent the Payment Element must confirm.
 */
export function useApplyBookingModify() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; changes: BookingModifyChanges }): Promise<ModifyApplyResult> => {
      const res = await fetchWithAuth(`/travioghana/bookings/${encodeURIComponent(input.id)}/modify`, {
        method: 'PATCH',
        body: JSON.stringify(input.changes),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.message || `Request failed (${res.status})`)
      return (payload.data ?? payload) as ModifyApplyResult
    },
    onSuccess: (result, vars) => {
      if (result.status === 'APPLIED') {
        queryClient.invalidateQueries({ queryKey: ['expedition', 'bookings'] })
        queryClient.invalidateQueries({ queryKey: ['expedition', 'bookings', vars.id, 'detail'] })
      }
    },
  })
}

/**
 * Discards a parked modification top-up (cancels the PaymentIntent).
 */
export function useDiscardBookingModify() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; changeId: string }): Promise<{ status: string }> => {
      const res = await fetchWithAuth(
        `/travioghana/bookings/${encodeURIComponent(input.id)}/modify/${encodeURIComponent(input.changeId)}/discard`,
        { method: 'POST', body: JSON.stringify({}) }
      )
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.message || `Request failed (${res.status})`)
      return (payload.data ?? payload) as { status: string }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['expedition', 'bookings', vars.id, 'detail'] })
      queryClient.invalidateQueries({ queryKey: ['expedition', 'bookings', vars.id, 'modify-quote'] })
    },
  })
}

/**
 * Polls until a just-paid top-up has been applied by the webhook (the booking's
 * parked PENDING_PAYMENT change disappears and totals change). Stops when done
 * or the client gives up after `maxTries`.
 */
export function useBookingModifySettled(id: string | null | undefined, active: boolean) {
  return useQuery({
    queryKey: ['expedition', 'bookings', id, 'detail'],
    enabled: !!id && active,
    refetchInterval: active ? 2500 : false,
    retry: false,
    staleTime: 0,
    queryFn: async () => {
      const payload = await expeditionFetchRaw(`/travioghana/bookings/${encodeURIComponent(id!)}`)
      const data = payload.data ?? payload
      return data.booking as Record<string, any>
    },
  })
}
