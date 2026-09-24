import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { bookingPath } from '../../lib/tourPath'
import type { TourDetailData, SpecialOfferData } from '../../hooks/useExpeditionTours'
import { bestOfferDiscountAmount } from '../../hooks/useExpeditionTours'
import { buildBookingTour } from '../../lib/bookingTour'
import { Button } from '../../components/ui/button'
import { CalendarPicker } from '../../components/ui/apple-calendar-picker'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Minus, Plus, Clock as ClockIcon, BadgePercent, Info, Zap, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrency } from '../../contexts/CurrencyContext'
import type { DayAvailability, DayAvailabilityInfo, DayTimeSlot } from '../../lib/tourAvailability'
import { openingHoursForDay, isSupplierOperatingDay, resolveDayStatus } from '../../lib/tourAvailability'
import { cancellationStatus } from '../../lib/cancellationLabel'
import { categoryKey } from '../../lib/travelerBuckets'
import { useTravelerSelection } from '../../hooks/useTravelerSelection'
import { headlineUnitPrice, cardParityUnitPrice } from '../../lib/startingPrice'
import BookingDeadlineTimer from './BookingDeadlineTimer'
import { preloadMapEngine } from '../../lib/mapWarmup'
import { shouldIdlePrefetch } from '../../lib/perfProfile'
import { fetchWithAuth } from '../../lib/api'
import { buildPromoValidationPayload, isValidPromoCodeFormat, normalizePromoCode, PROMO_CODE_MIN_LENGTH } from '../../lib/promo'
import { useQueryClient } from '@tanstack/react-query'
import './BookingWidget.css'

// Loaded only when the booking transition actually plays (after Book Now) —
// its dotlottie dependency is ~65 KB and has no business in the route chunk.
const BookingTransition = lazy(() => import('../../components/BookingTransition'))

// Warm the transition chunk, the dotLottie WASM and the animation while the
// traveller is still on this page (idle after mount, or on button
// hover/focus/touch). By the time Book Now is pressed the overlay adopts the
// already-decoded player — no button spinner, no animation appearing late.
// The transition module guards repeat calls, so this stays cheap per event.
function warmBookingTransition() {
  void import('../../components/BookingTransition')
    .then((mod) => mod.warmBookingTransition())
    .catch(() => {
      /* best-effort: the transition still loads on click */
    })
}

interface BookingWidgetProps {
  tour: TourDetailData
  getAvailability?: (date: Date) => DayAvailability | undefined
  getDayInfo?: (date: Date) => DayAvailabilityInfo | undefined
  availabilityLoading?: boolean
  onMonthChange?: (year: number, month: number) => void
  /** Reports the traveller's selected date up to the page (e.g. so the
      quick-facts cancellation badge can show the concrete cutoff date). */
  onSelectedDateChange?: (date: Date | null) => void
}

interface PricingResult {
  currency?: string
  subtotal: number
  fees: number
  discounts: number
  total: number
}

/** Validated promo code result from POST /tours/offers/validate-promo. */
interface AppliedPromo {
  code: string
  name: string
  offerType?: string
  discountAmount: number
  /** Offer metadata the backend returns with the validated code. */
  promoCode?: string | null
  timeSlotMode?: 'ALL_DAYS' | 'SPECIFIC_WEEKDAYS'
  specificWeekdays?: string[]
}

const dropdownVariants = {
  initial: { opacity: 0, y: -8, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.96 },
}

/**
 * Local-calendar date key (YYYY-MM-DD). `toISOString()` is UTC-anchored and
 * would send the previous day for travellers east of UTC, so every booking
 * date key uses the traveller's own calendar day — same helper the change
 * booking modal uses.
 */
const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** Transient transport failures — the backend never supplied a message. */
const NETWORK_ERROR_RE = /failed to fetch|networkerror|load failed|network request failed/i

/**
 * Camera for the offscreen booking-map warm-up (map convention [lng, lat]):
 * the supplier's meeting point, else the first located pickup area, else the
 * centroid of the first drawn zone. Undefined lets mapWarmup use Accra.
 */
function bookingMapCenter(tour: TourDetailData): [number, number] | undefined {
  const { meetingPointLat: lat, meetingPointLng: lng } = tour
  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
    return [lng, lat]
  }
  for (const area of tour.pickupAreas ?? []) {
    if (area && typeof area.lat === 'number' && typeof area.lng === 'number' && Number.isFinite(area.lat) && Number.isFinite(area.lng)) {
      return [area.lng, area.lat]
    }
  }
  const polygon = tour.pickupAreas?.find((a) => Array.isArray(a?.polygon) && a.polygon.length > 0)?.polygon
  if (polygon?.length) {
    const sum = polygon.reduce<[number, number]>((acc, [a, b]) => [acc[0] + a, acc[1] + b], [0, 0])
    return [sum[1] / polygon.length, sum[0] / polygon.length]
  }
  return undefined
}

/**
 * Starts warming the checkout before the user lands on it: the booking route
 * chunk (which pulls the map chunks) downloads during the button spinner and
 * travel transition, while `preloadMapEngine` warms the tile style/worker and
 * an offscreen map so the pickup map paints almost immediately on arrival.
 * Fire-and-forget on purpose — nothing here may delay or block navigation.
 */
function preloadCheckoutMap(tour: TourDetailData): void {
  void import('../BookingPage').catch(() => {
    /* best-effort: the route still loads normally on navigation */
  })
  const center = bookingMapCenter(tour)
  void preloadMapEngine({ center, zoom: center ? 12 : 11 })
}

export default function BookingWidget({ tour, getAvailability: propGetAvailability, getDayInfo, availabilityLoading, onMonthChange, onSelectedDateChange }: BookingWidgetProps) {
  const { t } = useTranslation()
  const { currency, convertPrice } = useCurrency()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showGuestSelector, setShowGuestSelector] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  // Wall-clock captured on mount for the cut-off urgency + cancellation-window
  // checks (read lazily so no impure call happens during render).
  const [nowMs] = useState(() => Date.now())
  // Headline latch: the "From $X" price matches the tour card until the user
  // touches the traveler picker; the first +/- tap flips it to the live
  // headcount-aware unit price (and it stays live from then on).
  const [travelerTouched, setTravelerTouched] = useState(false)

  const [isBooking, setIsBooking] = useState(false)
  const [showTransition, setShowTransition] = useState(false)

  const pendingNavState = useRef<unknown>(null)
  const [promoCode, setPromoCode] = useState('')
  const [promoApplied, setPromoApplied] = useState(false)
  const [promoError, setPromoError] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoRevalidating, setPromoRevalidating] = useState(false)
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null)
  // Monotonic token so a stale validation response can never overwrite the
  // state for a newer code / date (the user can edit the code or change the
  // date while a validation request is in flight).
  const promoCheckRef = useRef(0)

  // Monotonic token so a stale CHECKOUT quote (older traveler mix / date) can
  // never overwrite a newer one, plus the key of the quote currently in state
  // so the summary only shows server figures while they match the selection.
  const pricingSeqRef = useRef(0)
  const [lastQuoteKey, setLastQuoteKey] = useState<string | null>(null)
  const [pricingResult, setPricingResult] = useState<PricingResult | null>(null)
  // Whether the last refresh produced a different total (shown as an inline
  // "price updated" note); reset when a new refresh starts.
  const [priceUpdated, setPriceUpdated] = useState(false)
  const [pricingLoading, setPricingLoading] = useState(false)
  // Live-headline strike-through: the previously displayed live total (kept
  // across traveler changes) so the widget can show "old price struck
  // through next to the new price" while the picker is being adjusted.
  const [previousLiveTotal, setPreviousLiveTotal] = useState<number | null>(null)
  const [lastLiveShown, setLastLiveShown] = useState<number | null>(null)
  const guestRef = useRef<HTMLDivElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)

  // Opening-hours tours have no fixed slots on the calendar, so surface the
  // supplier's Step-14 opening hours for the chosen day instead.
  const openingHoursLabel = tour.scheduleType === 'operatingHours' && selectedDate
    ? openingHoursForDay(tour, selectedDate)
    : ''

  // Shared traveler-selection state (per-person vs per-group, age categories,
  // tiered pricing, passenger-mix rules) — the exact same picker logic the
  // change-booking modal uses, so both behave alike.
  const {
    isPerGroup,
    groupSizeBands,
    travelerGroups,
    categoryCounts,
    groupHeadcount,
    totalTravelers,
    travelersPayload,
    matchingGroupBand,
    lowestGroupBand,
    bookableBounds,
    activeGroupBandLabel,
    mixIssues,
    canIncrementCount,
    canDecrementCount,
    increment,
    decrement,
    clientSubtotal,
    anyTieredPricing,
    formatPrice,
    travelerOptions,
    adultGroup,
  } = useTravelerSelection(tour)

  const doFetchPricing = useCallback(async (date: string, time?: string | null, forceCode?: string) => {
    const tId = tour.id
    if (!tId) return
    // A validated promo code (or the code currently applied) is threaded into
    // the checkout engine so the quoted total matches what will be charged.
    const code = forceCode ?? (promoApplied ? promoCode.trim() : undefined)
    const seq = ++pricingSeqRef.current
    setPricingLoading(true)
    // A fresh refresh starts — hide the previous "price updated" note until
    // this quote lands with a new total.
    setPriceUpdated(false)
    try {
      const res = await fetchWithAuth('/travioghana/checkout/calculate', {
        method: 'POST',
        body: JSON.stringify({
          tourId: tId,
          travelDate: date,
          // Fixed-slot tours must carry a concrete time slot or the backend
          // rejects the check ("A time slot must be selected").
          ...(time ? { selectedTime: time } : {}),
          // The checkout schema accepts arbitrary traveler-count keys; the
          // dynamic per-category counts (incl. seniors, students, …) are
          // sent under their own keys so the backend prices each at its own
          // rate instead of folding them into adults.
          travelers: travelersPayload,
          ...(code ? { promoCode: code } : {}),
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.message || `Checkout API error (${res.status})`)
      }
      // Only the latest issued request may update state — a slower response
      // for an older traveler mix / date must never overwrite a newer quote.
      if (seq !== pricingSeqRef.current) return
      const data = payload.data ?? payload
      if (data.pricing) {
        setPricingResult({
          currency: data.pricing.currency,
          subtotal: Number(data.pricing.subtotal) || 0,
          fees: Number(data.pricing.fees) || 0,
          discounts: Number(data.pricing.discounts) || 0,
          total: Number(data.pricing.total) || 0,
        })
        // Remember exactly what this quote was for, so the summary only shows
        // server figures while they still match the current selection.
        setLastQuoteKey(`${date}|${time ?? ''}|${JSON.stringify(travelersPayload)}|${code ?? ''}`)
      }
    } catch (err) {
      if (seq !== pricingSeqRef.current) return
      setPricingResult(null)
      // Surface the backend's own reason (e.g. "Tour is not available on this
      // date") — the old generic message hid real availability rejections
      // behind "Could not load pricing".
      const serverMessage =
        err instanceof Error && err.message && !NETWORK_ERROR_RE.test(err.message) ? err.message : null
      toast.error(serverMessage || 'Could not load pricing. Please try again.')
      // A server rejection means the calendar is out of sync (stale or missing
      // data let an unbookable date render as selectable). Refetch availability
      // so the date grays out; the Book-now guard then blocks it.
      if (serverMessage) {
        queryClient.invalidateQueries({
          predicate: (q) =>
            q.queryKey[0] === 'expedition' &&
            q.queryKey[1] === 'tours' &&
            q.queryKey[3] === 'availability',
        })
      }
    } finally {
      if (seq === pricingSeqRef.current) setPricingLoading(false)
    }
  }, [tour.id, travelersPayload, promoApplied, promoCode, queryClient])

  // Warm the Book Now transition in the background so the click lands on an
  // already-decoded Lottie (skipped on save-data/2G-3G connections).
  useEffect(() => {
    if (!shouldIdlePrefetch()) return
    const idleWindow = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (typeof idleWindow.requestIdleCallback === 'function') {
      const id = idleWindow.requestIdleCallback(warmBookingTransition, { timeout: 2500 })
      return () => idleWindow.cancelIdleCallback?.(id)
    }
    const id = window.setTimeout(warmBookingTransition, 1200)
    return () => window.clearTimeout(id)
  }, [])

  // Auto-refresh the real-time price when the date or traveler mix changes
  // (Viator re-checks on date+pax selection). Debounced so +/- taps don't
  // hammer the API.
  const lastShownTotal = useRef<number | null>(null)
  useEffect(() => {
    if (!selectedDate) return
    const timer = setTimeout(() => {
      doFetchPricing(toDateKey(selectedDate), selectedTime)
    }, 400)
    return () => clearTimeout(timer)
  }, [selectedDate, selectedTime, travelersPayload, doFetchPricing])

  // Surface a changed total after a background refresh so the traveler knows
  // the price they see now reflects the latest availability/rate.
  useEffect(() => {
    if (pricingResult == null) return
    if (lastShownTotal.current != null && lastShownTotal.current !== pricingResult.total) {
      setPriceUpdated(true)
    }
    lastShownTotal.current = pricingResult.total
  }, [pricingResult])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (
        showGuestSelector &&
        guestRef.current &&
        !guestRef.current.contains(target)
      ) {
        setShowGuestSelector(false)
      }
      if (
        showCalendar &&
        calendarRef.current &&
        !calendarRef.current.contains(target)
      ) {
        setShowCalendar(false)
      }
    }
    if (showGuestSelector || showCalendar) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside, { passive: true })
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [showGuestSelector, showCalendar])

  const totalPrice = pricingResult?.total ?? 0

  const getSelectedDayInfo = useCallback((date: Date | null | undefined): DayAvailabilityInfo | undefined => {
    if (!date || !getDayInfo) return undefined
    return getDayInfo(date)
  }, [getDayInfo])

  const formatSlotTime = (time: string): string => {
    const [h, m] = time.split(':').map((n) => parseInt(n, 10))
    if (!Number.isFinite(h)) return time
    const period = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 === 0 ? 12 : h % 12
    return m ? `${hour12}:${String(m).padStart(2, '0')} ${period}` : `${hour12} ${period}`
  }

  const formatCutoffTime = (iso?: string | null): string => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const handleBookNow = useCallback(() => {
    if (!selectedDate) {
      toast.error(t('booking.selectDateFirst'))
      return
    }

    if (totalTravelers < 1) {
      toast.error(t('booking.selectTravelersFirst', 'Select at least one traveler'))
      return
    }

    const selectedDay = selectedDate ? getSelectedDayInfo(selectedDate) : undefined
    const daySlots = selectedDay?.timeSlots?.length ? selectedDay.timeSlots : []
    if (daySlots.length > 0 && !selectedTime) {
      toast.error(t('booking.selectTimeFirst', 'Please select a time slot'))
      return
    }

    // Never let a booking proceed on a day the supplier hasn't set the tour
    // to run (defense-in-depth: the calendar makes such days unselectable).
    if (selectedDate && (selectedDay?.isOperatingDay === false || !isSupplierOperatingDay(tour, selectedDate))) {
      toast.error(t('booking.notOperatingDay', 'This tour does not run on the selected date'))
      return
    }

    const travelersLabel = isPerGroup
      ? `${groupHeadcount} ${groupHeadcount === 1 ? 'traveler' : 'travelers'}`
      : travelerGroups
          .filter((g) => (categoryCounts[categoryKey(g.label)] ?? 0) > 0)
          .map((g) => {
            const count = categoryCounts[categoryKey(g.label)]
            return `${count} ${g.label.toLowerCase()}${count === 1 ? '' : 's'}`
          })
          .join(', ')

    const dateLabel = selectedDate.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })

    const dateISO = toDateKey(selectedDate)

    // Booking is valid and about to start: preload the checkout route + map
    // stack during the spinner/transition below.
    preloadCheckoutMap(tour)

    // Only hand the server-confirmed total to the booking page while it
    // matches the current selection; otherwise the live estimate is sent.
    const quoteIsCurrent =
      pricingResult != null &&
      lastQuoteKey ===
        `${dateISO}|${selectedTime ?? ''}|${JSON.stringify(travelersPayload)}|${promoApplied ? promoCode.trim() : ''}`

    // Stash the navigation payload, then play spinner → transition → booking.
    pendingNavState.current = {
      tour: buildBookingTour(tour, {
        date: dateLabel,
        dateISO,
        time: selectedTime ? formatSlotTime(selectedTime) : (openingHoursLabel ? `Open ${openingHoursLabel}` : 'Flexible time'),
        travelers: travelersLabel,
        travelersPayload,
        adults: travelersPayload.adults || 0,
        children: travelersPayload.children || 0,
        infants: travelersPayload.infants || 0,
        price: isPerGroup ? (matchingGroupBand?.price ?? clientSubtotal) : (quoteIsCurrent ? totalPrice : clientSubtotal),
        selectedTime,
        promoCode: promoApplied ? promoCode.trim() : null,
        appliedPromo: appliedPromo ? { name: appliedPromo.name, discountAmount: appliedPromo.discountAmount } : null,
      }),
    }

    setIsBooking(true)
    // No button spinner: the transition overlay takes over immediately with the
    // pre-decoded Lottie. The warm call is a no-op when idle/hover already did
    // it, and is the fallback for a cold click.
    warmBookingTransition()
    setShowTransition(true)
  }, [selectedDate, selectedTime, t, tour, isPerGroup, groupHeadcount, travelerGroups, categoryCounts, travelersPayload, matchingGroupBand, totalPrice, clientSubtotal, pricingResult, lastQuoteKey, getSelectedDayInfo, openingHoursLabel, promoApplied, promoCode, appliedPromo, totalTravelers])

  // A transition can only ever commit the booking once — the transition's own
  // timer and the watchdog below both funnel through this guard.
  const bookingCommittedRef = useRef(false)
  const finishBookingNavigation = useCallback(() => {
    if (bookingCommittedRef.current) return
    bookingCommittedRef.current = true
    // Canonical /{id}/{slug}/booking — see lib/tourPath.
    navigate(bookingPath(tour.id, tour.slug), { state: pendingNavState.current })
  }, [navigate, tour.id, tour.slug])

  // Safety net: if the lazy transition chunk or its animation ever stalls,
  // finish the flow instead of stranding the user on a spinner.
  useEffect(() => {
    if (!showTransition) return
    const watchdog = window.setTimeout(finishBookingNavigation, 6000)
    return () => window.clearTimeout(watchdog)
  }, [showTransition, finishBookingNavigation])

  const handleUpdatePricing = useCallback(() => {
    // Close the picker so the recalculated price/total is visible.
    setShowGuestSelector(false)
    if (!selectedDate) {
      // No date chosen yet — the live client-side estimate already reflects
      // the current traveler selection (the checkout quote API requires a
      // travel date), so there is nothing to re-quote.
      return
    }
    doFetchPricing(toDateKey(selectedDate), selectedTime)
  }, [selectedDate, selectedTime, doFetchPricing])

  // Validates the current promo code against the backend's special-offer
  // engine for a concrete date (POST /tours/offers/validate-promo — the same
  // endpoint that prices the booking). On success the code is marked applied
  // and the checkout is re-quoted WITH the code so the total reflects the
  // discount; on failure the code is cleared with a specific message.
  // `quiet` suppresses the success toast — used for the auto-revalidation on
  // date change, where a silent success is expected.
  const validatePromoCode = useCallback(async (date: Date, time: string | null, quiet = false) => {
    const code = normalizePromoCode(promoCode)
    if (!code) return
    // A promo can never be applied on a day the tour doesn't run — fail fast
    // client-side (the calendar already makes such days unselectable; this
    // guards date changes made before the schedule data arrived).
    const dayInfo = getDayInfo ? getDayInfo(date) : undefined
    if (dayInfo?.isOperatingDay === false || !isSupplierOperatingDay(tour, date)) {
      setPromoApplied(false)
      setAppliedPromo(null)
      setPromoError(t('booking.promoNotOperatingDay', 'This tour does not run on the selected date'))
      return
    }
    const token = ++promoCheckRef.current
    setPromoLoading(true)
    setPromoError('')
    try {
      // Real validation against the backend's special-offer engine: the same
      // endpoint (POST /tours/offers/validate-promo) that prices the booking.
      const basePrice = pricingResult
        ? pricingResult.subtotal
        : (clientSubtotal > 0 ? clientSubtotal : undefined)
      const res = await fetchWithAuth('/tours/offers/validate-promo', {
        method: 'POST',
        body: JSON.stringify(buildPromoValidationPayload({
          code,
          tourId: tour.id,
          dateISO: toDateKey(date),
          quantity: totalTravelers,
          ...(basePrice != null ? { basePrice } : {}),
        })),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.message || `Promo validation failed (${res.status})`)
      }
      const data = payload.data ?? payload
      if (!data.valid) {
        if (token !== promoCheckRef.current) return
        setPromoApplied(false)
        setAppliedPromo(null)
        // A date-change revalidation failure usually just means the offer does
        // not cover the new date — the booking stays available at the standard
        // price, so the notice reflects that instead of a generic rejection.
        setPromoError(quiet
          ? t('booking.promoNotValidForDate', 'This promo code does not apply on the selected date')
          : (data.message || t('booking.promoInvalid', 'This promo code is not valid for this tour and date')))
        return
      }
      if (token !== promoCheckRef.current) return
      setPromoApplied(true)
      setPromoError('')
      setAppliedPromo({
        code,
        name: data.offer?.name || code,
        offerType: data.offer?.offerType,
        discountAmount: Number(data.discount?.amount) || 0,
        promoCode: data.offer?.promoCode ?? null,
        timeSlotMode: data.offer?.timeSlotMode === 'SPECIFIC_WEEKDAYS' ? 'SPECIFIC_WEEKDAYS' : 'ALL_DAYS',
        specificWeekdays: Array.isArray(data.offer?.specificWeekdays) ? data.offer.specificWeekdays : [],
      })
      if (!quiet) toast.success(t('booking.promoApplied'))
      // Re-price with the code so the total reflects the validated discount.
      doFetchPricing(toDateKey(date), time, code)
    } catch (err) {
      if (token !== promoCheckRef.current) return
      setPromoApplied(false)
      setAppliedPromo(null)
      setPromoError(err instanceof Error ? err.message : t('booking.promoInvalid', 'This promo code is not valid for this tour and date'))
    } finally {
      if (token === promoCheckRef.current) setPromoLoading(false)
    }
  }, [promoCode, tour, totalTravelers, pricingResult, clientSubtotal, t, doFetchPricing, getDayInfo])

  const handleApplyPromo = useCallback(async () => {
    const code = normalizePromoCode(promoCode)
    if (!code) return
    if (code.length < PROMO_CODE_MIN_LENGTH) {
      setPromoError(t('booking.promoLengthError'))
      return
    }
    if (!isValidPromoCodeFormat(code)) {
      setPromoError(t('booking.promoFormatError'))
      return
    }
    if (!selectedDate) {
      setPromoError(t('booking.promoSelectDateFirst', 'Select a date first to validate the code'))
      return
    }
    await validatePromoCode(selectedDate, selectedTime)
  }, [promoCode, selectedDate, selectedTime, validatePromoCode, t])

  // Removes an applied code and re-quotes WITHOUT it (an explicit empty
  // forceCode so the stale `promoApplied` closure can't re-thread the code).
  const handleRemovePromo = useCallback(() => {
    promoCheckRef.current += 1
    setPromoApplied(false)
    setAppliedPromo(null)
    setPromoError('')
    setPromoCode('')
    if (selectedDate) {
      doFetchPricing(toDateKey(selectedDate), selectedTime, '')
    }
  }, [selectedDate, selectedTime, doFetchPricing])

  const selectedDateLabel = selectedDate
    ? selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : t('tourDetail.selectDate')

  // Date-aware cancellation status: a selected date inside the policy's
  // free-cancellation window (or a non-refundable policy) reads
  // "Non-refundable" — Viator's rule. Surfaced under the Book now button.
  const cancellation = cancellationStatus(
    tour.cancellationPolicy || t('tourDetail.cancellationDefault'),
    selectedDate ? toDateKey(selectedDate) : '',
    selectedTime,
    nowMs,
  )
  const cancellationNote = cancellation?.label || ''
  // Once a slot is picked (or opening hours shown) inside the calendar, surface
  // the chosen time on the date field so it stays visible after the panel closes.
  const selectedTimeLabel = selectedTime
    ? formatSlotTime(selectedTime)
    : (openingHoursLabel || '')

  const selectedDayInfo = getSelectedDayInfo(selectedDate)
  // Time slots for a given date come from the availability calendar; when the
  // backend returns none (some tours only carry the schedule's static slots),
  // fall back to the supplier's configured time slots so the traveller can
  // still see and pick the actual start times. Exposed as a helper so the date
  // picker can look up the NEXT date's slots before the state commits.
  const slotsForDate = (date: Date | null): DayTimeSlot[] => {
    const info = getSelectedDayInfo(date)
    if (info?.timeSlots?.length) return info.timeSlots
    if (tour.scheduleType === 'fixedTimeSlot' && Array.isArray(tour.timeSlots) && tour.timeSlots.length > 0) {
      return tour.timeSlots
        .filter((s): s is { startTime: string; endTime?: string } => !!s?.startTime)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((s) => ({ time: s.startTime, capacity: 0, booked: 0, remaining: null }))
    }
    return []
  }
  const selectedDaySlots: DayTimeSlot[] = slotsForDate(selectedDate)

  // Booking deadline for the "X hours left to book" countdown: the earliest
  // upcoming cutoff for the selected date — the soonest non-closed slot's
  // closesAt (fixed-slot / per-slot cut-off tours), or the whole-day closesAt
  // for flexible/operating-hours tours. Null when nothing is pending.
  const bookingDeadlineIso = (() => {
    if (!selectedDate) return null
    const candidates: number[] = []
    for (const slot of selectedDaySlots) {
      if (slot.closed || !slot.closesAt) continue
      const t = new Date(slot.closesAt).getTime()
      if (Number.isFinite(t) && t > nowMs) candidates.push(t)
    }
    if (candidates.length === 0 && selectedDayInfo?.closesAt && selectedDayInfo.closedCutoff !== true) {
      const t = new Date(selectedDayInfo.closesAt).getTime()
      if (Number.isFinite(t) && t > nowMs) candidates.push(t)
    }
    if (candidates.length === 0) return null
    return new Date(Math.min(...candidates)).toISOString()
  })()

  // Warn when the chosen traveler count exceeds what's left on the selected day.
  const remainingWarning = (() => {
    const info = getSelectedDayInfo(selectedDate)
    if (!info || info.capacityUnit !== 'people') return null
    const remaining = info.remaining
    if (remaining == null || totalTravelers <= remaining) return null
    return t('booking.tooManyTravelers', 'Only {{count}} spot(s) left on this date', { count: Math.max(0, remaining) })
  })()

  // The server quote is only authoritative while it matches the CURRENT
  // selection (date / time / traveler mix / promo). The moment the selection
  // changes — e.g. the traveler +/- steppers before the debounced re-quote
  // lands — the totals fall back to the live client-side estimate so the
  // price always tracks what the traveler sees in the picker.
  const currentQuoteKey = (() => {
    if (!selectedDate) return null
    const code = promoApplied ? promoCode.trim() : ''
    return `${toDateKey(selectedDate)}|${selectedTime ?? ''}|${JSON.stringify(travelersPayload)}|${code}`
  })()
  const quoteMatchesSelection = currentQuoteKey != null && lastQuoteKey === currentQuoteKey && pricingResult != null

  // Authoritative figure from the API when it matches the selection; live
  // client-side estimate otherwise.
  const displayTotal = quoteMatchesSelection && pricingResult ? pricingResult.total : clientSubtotal
  // Server-side offer/promo figures only apply alongside a matching quote.
  const savedAmount = quoteMatchesSelection && pricingResult ? pricingResult.discounts : 0
  const subtotalAmount = quoteMatchesSelection && pricingResult ? pricingResult.subtotal : clientSubtotal

  // Keep the previously displayed live total so the headline can strike it
  // through next to the new price whenever the traveler selection changes the
  // figure. React-recommended "adjust state during render" pattern — both
  // branches settle after one pass (the conditions they flip become false).
  const liveTracked = travelerTouched && !pricingLoading && totalTravelers > 0 && displayTotal > 0
  if (!travelerTouched && lastLiveShown != null) {
    setLastLiveShown(null)
    setPreviousLiveTotal(null)
  } else if (liveTracked && lastLiveShown !== displayTotal) {
    setPreviousLiveTotal(lastLiveShown)
    setLastLiveShown(displayTotal)
  }

  // Special offers a supplier applied to this tour on the supplier platform.
  // The backend projection (GET /tours/:id) already filters to ACTIVE offers
  // whose date window includes today. The checkout engine auto-applies the
  // best one — `discounts` is the ground truth of what was actually applied.
  const activeOffers: SpecialOfferData[] = Array.isArray(tour.specialOffers) ? tour.specialOffers : []
  // Round like the tour cards (FormattedPrice) so the widget's headline and
  // totals show the same rounded figures as the card on the homepage.
  const formatMoney = (n: number) => `${currency.symbol}${Math.round(convertPrice(n)).toLocaleString()}`

  // Offer pricing for the headline "From $X" figure: strike the original unit
  // price and show the discounted unit price in red — using the exact same
  // logic as the tour cards (best supplier offer applied to the headline base
  // price), so the widget and the card never disagree. The checkout-confirmed
  // discount (which reflects the real tier for the selected date/headcount)
  // is shown in the price summary below, not in the headline.
  // Headline "From $X" unit price: card parity (lowest adult tier / cheapest
  // group band) until the traveler picker is touched, then the live
  // headcount-aware rate so it stays in sync with the picker's prices.
  const originalUnitPrice = travelerTouched
    ? headlineUnitPrice({
        isPerGroup,
        matchingGroupBand,
        lowestGroupBand,
        adultGroup,
        totalTravelers,
        travelerGroups,
        tourPrice: tour.price,
      })
    : cardParityUnitPrice({
        isPerGroup,
        lowestGroupBand,
        travelerGroups,
        tourPrice: tour.price,
      })
  const offerPerUnitDiscount =
    activeOffers.length > 0 && originalUnitPrice > 0
      ? bestOfferDiscountAmount(activeOffers, originalUnitPrice)
      : 0
  const promoUnitPrice = offerPerUnitDiscount > 0 ? originalUnitPrice - offerPerUnitDiscount : null
  const showPromoPrice =
    promoUnitPrice != null && promoUnitPrice > 0 && promoUnitPrice < originalUnitPrice

  // Once the traveler picker has been touched, the headline switches from the
  // static "From $X per person/group" unit to the LIVE total for the selected
  // travelers (same figure the summary shows: server-confirmed total when a
  // matching date quote exists, the client-side estimate otherwise). This is
  // what makes the first price move with every +/- tap.
  const showLiveTotal =
    travelerTouched &&
    totalTravelers > 0 &&
    (isPerGroup ? matchingGroupBand != null : tour.price > 0)

  // An applied promo must always produce a real discount: if the re-quoted
  // pricing comes back with zero discount (the code no longer applies to the
  // selected date / traveler mix), clear it with an inline notice instead of
  // silently showing a full-price total next to an "applied" code. React-
  // recommended "adjust state during render" pattern — guarded so it only
  // runs once (clearing the applied state makes the condition false).
  if (
    promoApplied && appliedPromo &&
    !promoRevalidating && !pricingLoading &&
    pricingResult != null && pricingResult.discounts === 0
  ) {
    setPromoApplied(false)
    setAppliedPromo(null)
    setPromoError(t('booking.promoNoLongerApplies', 'This promo code no longer applies to the selected date and travelers'))
  }

  return (
    <div className="booking-widget-desktop">
      <div className="booking-widget-card">
          <div className="booking-price-section">
          <div className="booking-price-main">
            {showLiveTotal ? (
              <>
                <span className="booking-price-from">{t('common.from')}</span>
                {!pricingLoading && previousLiveTotal != null && previousLiveTotal !== displayTotal && showPromoPrice && (
                  <span className="booking-price-amount booking-price-amount--strike">
                    {formatMoney(previousLiveTotal)}
                  </span>
                )}
                <span className="booking-price-amount booking-price-amount--live">
                  {pricingLoading ? (
                    <span className="booking-price-spinner">
                      <svg className="booking-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                      </svg>
                    </span>
                  ) : formatMoney(displayTotal)}
                </span>
              </>
            ) : isPerGroup ? (
              lowestGroupBand ? (
                <>
                  <span className="booking-price-from">{t('common.from')}</span>
                  {showPromoPrice ? (
                    <>
                      <span className="booking-price-amount booking-price-amount--strike">{formatMoney(originalUnitPrice)}</span>
                      <span className="booking-price-amount booking-price-amount--promo">{formatMoney(promoUnitPrice!)}</span>
                    </>
                  ) : (
                    <span className="booking-price-amount">
                      {formatMoney(originalUnitPrice)}
                    </span>
                  )}
                  <span className="booking-price-per">{t('booking.perGroup', 'per group')}</span>
                </>
              ) : null
            ) : tour.price > 0 ? (
              <>
                <span className="booking-price-from">{t('common.from')}</span>
                {showPromoPrice ? (
                  <>
                    <span className="booking-price-amount booking-price-amount--strike">{formatMoney(originalUnitPrice)}</span>
                    <span className="booking-price-amount booking-price-amount--promo">{formatMoney(promoUnitPrice!)}</span>
                  </>
                ) : (
                  <span className="booking-price-amount">
                    {originalUnitPrice > 0
                      ? formatMoney(originalUnitPrice)
                      : formatMoney(tour.price)}
                  </span>
                )}
                <span className="booking-price-per">{t('tourDetail.perPerson')}</span>
              </>
            ) : null}
          </div>

          {/* Applied promo code chip — shown only after a code is entered and
              validated. Supplier-applied special offers no longer show chips. */}
          {promoApplied && appliedPromo && (
            <div className="booking-offers">
              <span className="booking-offer-chip booking-offer-chip-promo">
                <BadgePercent size={14} />
                <span className="booking-offer-chip-name">{appliedPromo.name}</span>
                <span className="booking-offer-chip-discount">
                  {savedAmount > 0 ? `-${formatMoney(savedAmount)}` : t('booking.promoApplied')}
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="booking-form">
          {/* ── Viator-style inline date + traveler bar ── */}
          <div className="booking-inline-picker">
            {/* Date section */}
            <div className="booking-inline-section booking-inline-date" ref={calendarRef}>
              <button
                type="button"
                className="booking-inline-trigger"
                onClick={() => { setShowCalendar((v) => !v); setShowGuestSelector(false) }}
                aria-expanded={showCalendar}
                aria-haspopup="dialog"
              >
                <span className="booking-inline-label">{t('tourDetail.selectDate')}</span>
                <span className="booking-inline-value">
                  <span className="booking-inline-date-text">{selectedDateLabel}</span>
                  {selectedTimeLabel && <span className="booking-selected-time">{selectedTimeLabel}</span>}
                </span>
                <ChevronDown size={16} className="booking-inline-chevron" />
              </button>
            <AnimatePresence>
              {showCalendar && (
                <motion.div
                  key="calendar-dropdown"
                  variants={dropdownVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50 }}
                >
                  <CalendarPicker
                    isOpen={showCalendar}
                    onClose={() => setShowCalendar(false)}
                    onDateSelect={(date) => {
                      setSelectedDate(date)
                      onSelectedDateChange?.(date)
                      // Smart time carry-over (Viator-style): when the traveller
                      // changes the date after picking a time, keep that time if
                      // it is still an open slot on the new date, otherwise
                      // auto-select the first open slot — never make them re-pick
                      // a time just because the date changed. On a first pick
                      // (no prior time) the slot list is left for them to choose.
                      if (selectedTime) {
                        const nextSlots = slotsForDate(date)
                        const isOpen = (s: DayTimeSlot) => !s.closed && (s.remaining == null || s.remaining > 0)
                        const kept = nextSlots.find((s) => s.time === selectedTime && isOpen(s))
                        if (kept) {
                          setShowCalendar(false)
                        } else {
                          const firstOpen = nextSlots.find(isOpen)
                          setSelectedTime(firstOpen ? firstOpen.time : null)
                          if (firstOpen) setShowCalendar(false)
                        }
                      }
                      // If the chosen date's weekday falls outside any
                      // specific-weekday offer, note it as informational —
                      // the date is still fully bookable at the standard
                      // price, just without that discount.
                      const weekday = date
                        .toLocaleDateString('en-US', { weekday: 'long' })
                        .toLowerCase()
                      if (activeOffers.some((o) =>
                        o.timeSlotMode === 'SPECIFIC_WEEKDAYS' &&
                        o.specificWeekdays.length > 0 &&
                        !o.specificWeekdays.includes(weekday)
                      )) {
                        toast.info(t('booking.offerNotValidOnDate', 'No discount applies on this date — you can still book at the standard price'))
                      }
                      // Promo codes are date-scoped: re-validate an applied
                      // code against the new date instead of carrying a stale
                      // discount (or silently dropping it). Success is quiet;
                      // failure clears the code with an inline error.
                      if (promoApplied && appliedPromo) {
                        setPromoRevalidating(true)
                        setPromoError('')
                        validatePromoCode(date, null, true)
                          .catch(() => {})
                          .finally(() => setPromoRevalidating(false))
                      } else {
                        setPromoError('')
                      }
                    }}
                    selectedDate={selectedDate}
                    getAvailability={(date) => resolveDayStatus({
                      schedule: tour,
                      date,
                      apiStatus: propGetAvailability ? propGetAvailability(date) : undefined,
                      apiIsOperatingDay: getDayInfo ? getDayInfo(date)?.isOperatingDay : undefined,
                    })}
                    getDayCounts={(date) => {
                      if (!getDayInfo) return null
                      const info = getDayInfo(date)
                      if (!info) return null
                      return {
                        remaining: info.remaining,
                        capacity: info.capacity,
                        capacityUnit: info.capacityUnit,
                      }
                    }}
                    loading={availabilityLoading}
                    onMonthChange={onMonthChange}
                    requireConfirmation
                    getKeepOpenOnSelect={(date) => {
                      const info = getDayInfo ? getDayInfo(date) : undefined
                      const hasSlots = !!info?.timeSlots?.length
                        || (tour.scheduleType === 'fixedTimeSlot' && !!tour.timeSlots?.length)
                      const hasHours = tour.scheduleType === 'operatingHours' && openingHoursForDay(tour, date) !== ''
                      return hasSlots || hasHours
                    }}
                    footer={
                      selectedDate && (
                        selectedDaySlots.length > 0 ? (
                          <div className="booking-calendar-slots">
                            <div className="booking-label booking-calendar-footer-label">
                              <ClockIcon size={15} />
                              {t('booking.selectTime', 'Select time')}
                            </div>
                            <div className="booking-slot-grid booking-slot-grid-compact">
                              {selectedDaySlots.map((slot) => {
                                const slotFull = slot.remaining != null && slot.remaining <= 0
                                const slotClosed = slot.closed === true
                                const isSelectedSlot = selectedTime === slot.time
                                return (
                                  <button
                                    key={slot.time}
                                    type="button"
                                    disabled={slotFull || slotClosed}
                                    onClick={() => {
                                      setSelectedTime(slot.time)
                                      setShowCalendar(false)
                                    }}
                                    className={`booking-slot-chip${isSelectedSlot ? ' booking-slot-chip-active' : ''}${slotClosed ? ' booking-slot-chip-closed' : ''}`}
                                  >
                                    <span className="booking-slot-time">{formatSlotTime(slot.time)}</span>
                                    {slotClosed ? (
                                      <span className="booking-slot-cap">
                                        {slot.closesAt
                                          ? t('booking.bookingsCloseAt', 'Bookings close {{time}}', { time: formatCutoffTime(slot.closesAt) })
                                          : t('booking.bookingsClosed', 'Bookings closed')}
                                      </span>
                                    ) : slot.remaining != null ? (
                                      <span className="booking-slot-cap">
                                        {slotFull
                                          ? t('booking.soldOut', 'Sold out')
                                          : selectedDayInfo?.capacityUnit === 'groups'
                                            ? `${Math.max(0, slot.groupsRemaining ?? 0)} ${t('booking.groupSlots', 'group slots')}`
                                            : `${Math.max(0, slot.remaining)} ${t('booking.spotsLeft', 'spots left')}`}
                                      </span>
                                    ) : null}
                                  </button>
                                )
                              })}
                            </div>
                            {selectedDayInfo?.capacityUnit === 'groups' && selectedDayInfo.maxGroupSize != null && (
                              <p className="booking-slot-note">
                                {t('booking.groupBookingsNote', 'Group bookings · up to {{max}} travelers per group', { max: selectedDayInfo.maxGroupSize })}
                              </p>
                            )}
                          </div>
                        ) : openingHoursLabel ? (
                          <div className="booking-calendar-hours">
                            <div className="booking-label booking-calendar-footer-label">
                              <ClockIcon size={15} />
                              {t('booking.openingHours', 'Opening hours')}
                            </div>
                            <p className="booking-slot-note">{openingHoursLabel}</p>
                            <button
                              type="button"
                              className="booking-calendar-done-btn"
                              onClick={() => setShowCalendar(false)}
                            >
                              {t('booking.done', 'Done')}
                            </button>
                          </div>
                        ) : null
                      )
                    }
                  />
                </motion.div>
              )}
            </AnimatePresence>
            </div>

            <div className="booking-inline-divider" />

            {/* Traveler section */}
            <div className="booking-inline-section booking-inline-traveler" ref={guestRef}>
              <button
                type="button"
                className="booking-inline-trigger"
                onClick={() => { setShowGuestSelector((v) => !v); setShowCalendar(false) }}
                aria-expanded={showGuestSelector}
                aria-haspopup="dialog"
              >
                <span className="booking-inline-label">{t('booking.travelers')}</span>
                <span className="booking-inline-value">
                  <Users size={16} className="booking-inline-icon" />
                  <span>{totalTravelers} {t('booking.traveler', { count: totalTravelers })}</span>
                  {isPerGroup && totalTravelers > 1 && activeGroupBandLabel && (
                    <span className="booking-active-band">
                      {' '}· {t('booking.groupOf', 'Group of {{range}}', { range: activeGroupBandLabel })}
                    </span>
                  )}
                </span>
                <ChevronDown size={16} className="booking-inline-chevron" />
              </button>
            <AnimatePresence>
              {showGuestSelector && (
                <motion.div
                  key="guest-dropdown"
                  variants={dropdownVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="guest-selector-dropdown"
                  style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50 }}
                >
                  {isPerGroup && groupSizeBands.length > 0 && (
                    <div className="group-size-bands">
                      {groupSizeBands
                        .slice()
                        .sort((a, b) => a.from - b.from)
                        .map((band, i) => {
                          const isActive = totalTravelers >= band.from && totalTravelers <= band.to
                          const rangeLabel = band.from === band.to
                            ? `${band.from}`
                            : (Number.isFinite(band.to) ? `${band.from}-${band.to}` : `${band.from}+`)
                          return (
                            <div
                              key={i}
                              className={`group-size-band${isActive ? ' group-size-band-active' : ''}`}
                            >
                              <span>{t('booking.groupOf', 'Group of {{range}}', { range: rangeLabel })}</span>
                              <span className="group-size-band-price">{formatPrice(band.price)}</span>
                            </div>
                          )
                        })}
                    </div>
                  )}
                  {anyTieredPricing && (
                    <p className="booking-tier-hint">{t('booking.tierPricingHint', 'Per-person prices below depend on your total number of travelers.')}</p>
                  )}
                  {travelerOptions.map((opt) => {
                    const category = travelerGroups.find((g) => categoryKey(g.label) === opt.key)
                    const canDecrement = canDecrementCount(opt.key)
                    const canIncrement = canIncrementCount(opt.key)
                    return (
                      <div key={opt.key} className="guest-type">
                        <div className="guest-type-info">
                          <span className="guest-type-label">{opt.label}</span>
                          <span className="guest-type-desc">{opt.age}</span>
                          {category?.notAllowed && (
                            <span className="guest-type-desc">{t('booking.notAllowed', 'Not permitted on this tour')}</span>
                          )}
                        </div>
                        <div className="guest-type-price">
                          <span className="guest-type-unit">{opt.price}</span>
                          {!isPerGroup && opt.count > 0 && (
                            <span className="guest-type-line">
                              {t('booking.perPersonShort', 'per person')}
                            </span>
                          )}
                        </div>
                        <div className="guest-type-controls">
                          <button
                            className="guest-btn"
                            onClick={() => { setTravelerTouched(true); decrement(opt.key) }}
                            disabled={!canDecrement}
                            aria-label={`Remove one ${opt.label}`}
                          >
                            <Minus size={16} />
                          </button>
                          <span className="guest-count">{opt.count}</span>
                          <button
                            className="guest-btn"
                            onClick={() => { setTravelerTouched(true); increment(opt.key) }}
                            disabled={!canIncrement}
                            aria-label={`Add one ${opt.label}`}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    )
                  })}

                  {bookableBounds.max != null && (
                    <p className="booking-slot-note">
                      {t('booking.bookableRange', 'Bookable by {{min}}–{{max}} travelers', { min: bookableBounds.min, max: bookableBounds.max })}
                    </p>
                  )}
                  {bookableBounds.max == null && bookableBounds.min > 1 && (
                    <p className="booking-slot-note">
                      {t('booking.minTravelersNote', 'Minimum {{min}} travelers', { min: bookableBounds.min })}
                    </p>
                  )}
                  {mixIssues.length > 0 && (
                    <p className="booking-slot-warning">{mixIssues[0].message}</p>
                  )}

                  <button
                    type="button"
                    className="booking-update-btn"
                    onClick={handleUpdatePricing}
                    disabled={pricingLoading}
                  >
                    {pricingLoading ? (
                      <span className="booking-btn-loader">
                        <svg className="booking-spinner" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                        </svg>
                        {t('booking.checking')}
                      </span>
                    ) : (
                      <>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="23 4 23 10 17 10" />
                          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                        </svg>
                        {t('booking.updatePrice', 'Update')}
                      </>
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            </div>
          </div>

          {/* Booking deadline countdown — shows hours left when the supplier
              has set a near-term cutoff for the selected date. Uses the soonest
              slot deadline on fixed-slot tours, else the whole-day deadline. */}
          {selectedDate && bookingDeadlineIso && (
            <BookingDeadlineTimer closesAt={bookingDeadlineIso} />
          )}

          {/* Transparent price summary — always visible so the spinner is easy to see */}
          {(isPerGroup ? matchingGroupBand != null : tour.price > 0) && totalTravelers > 0 && (
            <div className="booking-summary">
              {savedAmount > 0 && !pricingLoading && (
                <div className="booking-savings">
                  <div className="booking-savings-row">
                    <span>{t('booking.subtotal', 'Subtotal')}</span>
                    <span className="booking-savings-strike">{formatMoney(subtotalAmount)}</span>
                  </div>
                  <div className="booking-savings-row booking-savings-discount">
                    <span>
                      {promoApplied && appliedPromo
                        ? t('booking.promoDiscountNamed', 'Promo discount ({{name}})', { name: appliedPromo.name })
                        : t('booking.specialOfferApplied', 'Special offer applied')}
                    </span>
                    <span className="booking-savings-amount">-{formatMoney(savedAmount)}</span>
                  </div>
                </div>
              )}
              <div className="booking-total">
                <span>{isPerGroup ? t('booking.groupTotal', 'Group total') : t('booking.totalLabel', 'Total')}</span>
                <span className="booking-total-amount">
                  {pricingLoading ? (
                    <span className="booking-price-spinner">
                      <svg className="booking-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                      </svg>
                    </span>
                  ) : `${currency.symbol}${Math.round(convertPrice(displayTotal))}`}
                </span>
              </div>
              {priceUpdated && !pricingLoading && (
                <p className="booking-slot-note">{t('booking.priceUpdated', 'Price updated to reflect the latest availability')}</p>
              )}
              {!selectedDate && !pricingLoading && totalTravelers > 0 && (
                <p className="booking-slot-note">{t('booking.priceEstimateNote', 'Estimate from your traveler selection — choose a date for a live quote')}</p>
              )}
            </div>
          )}

          {isPerGroup && groupSizeBands.length === 0 && (
            <p className="booking-group-unavailable">{t('booking.groupPricingUnavailable')}</p>
          )}

          {remainingWarning && (
            <p className="booking-slot-warning">{remainingWarning}</p>
          )}

          {availabilityLoading && selectedDate && (
            <p className="booking-slot-note">{t('booking.checkingAvailability', 'Checking availability…')}</p>
          )}

          {/* Promo code */}
          <div className="booking-promo">
            <div className="booking-promo-row">
              {promoApplied && appliedPromo ? (
                <>
                  <input
                    type="text"
                    value={promoCode}
                    readOnly
                    aria-label={t('booking.promoCode')}
                    className="booking-promo-input booking-promo-input-applied"
                  />
                  <button
                    type="button"
                    onClick={handleRemovePromo}
                    disabled={promoLoading}
                    className="booking-promo-btn booking-promo-remove-btn"
                  >
                    {t('booking.removePromo', 'Remove')}
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => {
                      // Editing invalidates any in-flight validation for the
                      // previous code.
                      promoCheckRef.current += 1
                      setPromoCode(e.target.value.toUpperCase())
                      setPromoApplied(false)
                      setAppliedPromo(null)
                      setPromoError('')
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleApplyPromo()
                      }
                    }}
                    placeholder={t('booking.promoCode')}
                    maxLength={30}
                    disabled={promoLoading}
                    aria-invalid={!!promoError}
                    aria-describedby={promoError || (promoApplied && appliedPromo) ? 'booking-promo-status' : undefined}
                    className={`booking-promo-input${promoError ? ' booking-promo-input-error' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    disabled={promoLoading}
                    className="booking-promo-btn"
                  >
                    {promoLoading ? t('booking.checking') : t('booking.apply')}
                  </button>
                </>
              )}
            </div>
            <div id="booking-promo-status" aria-live="polite">
              {promoError && <p className="booking-promo-error">{promoError}</p>}
              {promoApplied && appliedPromo && !promoError && (
                <p className="booking-promo-success">
                  {t('booking.promoApplied')}
                  {savedAmount > 0 && ` · ${t('booking.youSave', 'You save')} ${formatMoney(savedAmount)}`}
                </p>
              )}
            </div>
          </div>

          {/* Instant-confirmation trust cue (Step 12 Options). Shown only when
              the operator confirms automatically; manual tours omit it. */}
          {tour.instantConfirmation !== false && (
            <p className="booking-instant-confirm">
              <Zap size={14} />
              {t('tourDetail.instantConfirmation')}
            </p>
          )}

          {/* Submit — no spinner state: the Book Now transition overlay is the
              only feedback, shown the instant the button is pressed. */}
          <Button
            className="booking-submit-btn"
            onClick={handleBookNow}
            onPointerEnter={warmBookingTransition}
            onFocus={warmBookingTransition}
            onTouchStart={warmBookingTransition}
            disabled={isBooking || (!!selectedDate && selectedDaySlots.length > 0 && !selectedTime) || (!isPerGroup && mixIssues.length > 0)}
          >
            {t('tourDetail.bookNow')}
          </Button>

          {/* Date-specific cancellation cutoff — matches the Quick facts
              label, shown right after Book now. Turns red ("Non-refundable")
              once the selected date is inside the cancellation window. */}
          {cancellationNote && (
            <p className={`booking-cancel-note${cancellation && !cancellation.refundable ? ' booking-cancel-note--none' : ''}`}>
              <Info size={14} />
              <span>
                <strong>{cancellationNote}</strong>
                {cancellation?.sublabel && <> — {cancellation.sublabel}</>}
              </span>
            </p>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showTransition && (
          <Suspense fallback={null}>
            <BookingTransition onDone={finishBookingNavigation} />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  )
}
