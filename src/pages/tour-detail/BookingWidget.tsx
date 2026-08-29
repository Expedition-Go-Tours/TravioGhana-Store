import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { TourDetailData, SpecialOfferData } from '../../hooks/useExpeditionTours'
import { bestOfferDiscountAmount } from '../../hooks/useExpeditionTours'
import { buildBookingTour } from '../../lib/bookingTour'
import { Button } from '../../components/ui/button'
import { CalendarPicker } from '../../components/ui/apple-calendar-picker'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarDays, Users, Minus, Plus, MessageSquare, Clock as ClockIcon, BadgePercent, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrency } from '../../contexts/CurrencyContext'
import type { DayAvailability, DayAvailabilityInfo, DayTimeSlot } from '../../lib/tourAvailability'
import { openingHoursForDay, isSupplierOperatingDay, resolveDayStatus } from '../../lib/tourAvailability'
import { freeCancellationDateLabel } from '../../lib/cancellationLabel'
import { categoryKey } from '../../lib/travelerBuckets'
import { useTravelerSelection } from '../../hooks/useTravelerSelection'
import { lowestAdultFromTravelerPricing } from '../../lib/startingPrice'
import { useChat } from '../../chat/ChatContext'
import SupportChatWidget from '../../components/SupportChatWidget'
import BookingTransition from '../../components/BookingTransition'
import { fetchWithAuth } from '../../lib/api'
import { buildPromoValidationPayload, isValidPromoCodeFormat, normalizePromoCode, PROMO_CODE_MIN_LENGTH } from '../../lib/promo'
import './BookingWidget.css'

interface BookingWidgetProps {
  tour: TourDetailData
  getAvailability?: (date: Date) => DayAvailability | undefined
  getDayInfo?: (date: Date) => DayAvailabilityInfo | undefined
  availabilityLoading?: boolean
  onMonthChange?: (year: number, month: number) => void
  /** Reports the traveller's selected date up to the page (e.g. so the
      quick-facts cancellation badge can show the concrete cutoff date). */
  onSelectedDateChange?: (date: Date | null) => void
  /** Opens the app's auth modal when a signed-out visitor starts a chat. */
  onOpenAuth?: (mode: 'signin' | 'signup') => void
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

export default function BookingWidget({ tour, getAvailability: propGetAvailability, getDayInfo, availabilityLoading, onMonthChange, onSelectedDateChange, onOpenAuth }: BookingWidgetProps) {
  const { t } = useTranslation()
  const { currency, convertPrice } = useCurrency()
  const navigate = useNavigate()
  const [showGuestSelector, setShowGuestSelector] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [showChat, setShowChat] = useState(false)

  // Unread indicator for the supplier's chat: a red dot on "Start a Chat"
  // when that supplier has sent messages the traveler hasn't opened yet.
  const chatCtx = useChat()
  const supplierId = tour.supplierProfile?.id ?? null
  const supplierConv = chatCtx.conversations.find(
    (c) => c.type === 'SUPPLIER_CUSTOMER' && !!supplierId &&
      c.participants?.some((p) => p.userId === supplierId),
  )
  const hasSupplierUnread = (supplierConv?.unreadCount ?? 0) > 0
  const [isBooking, setIsBooking] = useState(false)
  const [showTransition, setShowTransition] = useState(false)
  const [transitVehicle, setTransitVehicle] = useState(0)
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
  const [pricingResult, setPricingResult] = useState<PricingResult | null>(null)
  const [pricingLoading, setPricingLoading] = useState(false)
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
    unitPriceFor,
  } = useTravelerSelection(tour)

  const doFetchPricing = useCallback(async (date: string, time?: string | null, forceCode?: string) => {
    const tId = tour.id
    if (!tId) return
    // A validated promo code (or the code currently applied) is threaded into
    // the checkout engine so the quoted total matches what will be charged.
    const code = forceCode ?? (promoApplied ? promoCode.trim() : undefined)
    setPricingLoading(true)
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
      const data = payload.data ?? payload
      if (data.pricing) {
        setPricingResult({
          currency: data.pricing.currency,
          subtotal: Number(data.pricing.subtotal) || 0,
          fees: Number(data.pricing.fees) || 0,
          discounts: Number(data.pricing.discounts) || 0,
          total: Number(data.pricing.total) || 0,
        })
      }
    } catch {
      setPricingResult(null)
      toast.error('Could not load pricing. Please try again.')
    } finally {
      setPricingLoading(false)
    }
  }, [tour.id, travelersPayload, promoApplied, promoCode])

  const pricingFetched = useRef(false)
  useEffect(() => {
    if (!tour.id || pricingFetched.current) return
    pricingFetched.current = true
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    // The initial quote uses the next day — skip it when that day is outside
    // the tour's operating window (the checkout engine rejects those days with
    // "No pricing available for selected date/time"); the user quotes when
    // they pick a valid date instead. Deferred a tick so the pricing call
    // (which sets loading state) is never invoked synchronously from the
    // effect body.
    if (!isSupplierOperatingDay(tour, tomorrow)) return
    const timer = window.setTimeout(() => doFetchPricing(tomorrow.toISOString().slice(0, 10)), 0)
    return () => window.clearTimeout(timer)
  }, [tour.id, tour, doFetchPricing])

  // Auto-refresh the real-time price when the date or traveler mix changes
  // (Viator re-checks on date+pax selection). Debounced so +/- taps don't
  // hammer the API; the manual Update button still forces an immediate check.
  const [priceUpdated, setPriceUpdated] = useState(false)
  const lastShownTotal = useRef<number | null>(null)
  useEffect(() => {
    if (!selectedDate) return
    const timer = setTimeout(() => {
      doFetchPricing(selectedDate.toISOString().slice(0, 10), selectedTime)
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

    const dateISO = selectedDate.toISOString().slice(0, 10)

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
        price: isPerGroup ? (matchingGroupBand?.price ?? clientSubtotal) : (pricingResult ? totalPrice : clientSubtotal),
        selectedTime,
        promoCode: promoApplied ? promoCode.trim() : null,
        appliedPromo: appliedPromo ? { name: appliedPromo.name, discountAmount: appliedPromo.discountAmount } : null,
      }),
    }

    // Pick the vehicle for this booking, cycling helicopter → tram → truck
    // across successive bookings (persisted so it advances each time).
    let bookingCount = 0
    try {
      bookingCount = parseInt(localStorage.getItem('eg_booking_count') || '0', 10) || 0
      localStorage.setItem('eg_booking_count', String(bookingCount + 1))
    } catch {
      /* ignore */
    }
    setTransitVehicle(bookingCount % 3)

    setIsBooking(true)
    // Spinner on the button for a moment, then reveal the travel transition.
    setTimeout(() => setShowTransition(true), 1100)
  }, [selectedDate, selectedTime, t, tour, isPerGroup, groupHeadcount, travelerGroups, categoryCounts, travelersPayload, matchingGroupBand, totalPrice, clientSubtotal, pricingResult, getSelectedDayInfo, openingHoursLabel, promoApplied, promoCode, appliedPromo, totalTravelers])

  const handleTransitionDone = useCallback(() => {
    navigate(`/${encodeURIComponent(tour.id)}/booking`, { state: pendingNavState.current })
  }, [navigate, tour.id])

  const handleUpdatePricing = useCallback(() => {
    // Close the picker so the recalculated price/total is visible.
    setShowGuestSelector(false)
    setPriceUpdated(false)
    if (!selectedDate) {
      // No date chosen yet — refresh the client-side estimate for the current
      // traveler selection (the checkout quote API requires a travel date).
      return
    }
    doFetchPricing(selectedDate.toISOString().slice(0, 10), selectedTime)
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
          dateISO: date.toISOString().slice(0, 10),
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
      doFetchPricing(date.toISOString().slice(0, 10), time, code)
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
      doFetchPricing(selectedDate.toISOString().slice(0, 10), selectedTime, '')
    }
  }, [selectedDate, selectedTime, doFetchPricing])

  const selectedDateLabel = selectedDate
    ? selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : t('tourDetail.selectDate')

  // Same date-specific cancellation label the Quick facts section shows
  // (e.g. "Free Cancellation before Aug 22nd (local time)") — surfaced under
  // the Book now button so the traveller sees the exact cutoff at purchase.
  const cancellationNote = freeCancellationDateLabel(
    tour.cancellationPolicy || t('tourDetail.cancellationDefault'),
    selectedDate ? selectedDate.toISOString().slice(0, 10) : '',
  )
  // Once a slot is picked (or opening hours shown) inside the calendar, surface
  // the chosen time on the date field so it stays visible after the panel closes.
  const selectedTimeLabel = selectedTime
    ? `${t('booking.timeSlot', 'Time slot')}: ${formatSlotTime(selectedTime)}`
    : (openingHoursLabel ? `${t('booking.openingHours', 'Opening hours')}: ${openingHoursLabel}` : '')

  const selectedDayInfo = getSelectedDayInfo(selectedDate)
  // Time slots for the selected date come from the availability calendar; when
  // the backend returns none (some tours only carry the schedule's static
  // slots), fall back to the supplier's configured time slots so the traveller
  // can still see and pick the actual start times.
  const selectedDaySlots: DayTimeSlot[] = (() => {
    if (selectedDayInfo?.timeSlots?.length) return selectedDayInfo.timeSlots
    if (tour.scheduleType === 'fixedTimeSlot' && Array.isArray(tour.timeSlots) && tour.timeSlots.length > 0) {
      return tour.timeSlots
        .slice()
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((s) => ({ time: s.startTime, capacity: 0, booked: 0, remaining: null }))
    }
    return []
  })()

  // Warn when the chosen traveler count exceeds what's left on the selected day.
  const remainingWarning = (() => {
    const info = getSelectedDayInfo(selectedDate)
    if (!info || info.capacityUnit !== 'people') return null
    const remaining = info.remaining
    if (remaining == null || totalTravelers <= remaining) return null
    return t('booking.tooManyTravelers', 'Only {{count}} spot(s) left on this date', { count: Math.max(0, remaining) })
  })()

  // Authoritative figure from the API when available; client mirror before that.
  // The backend quote (pricingResult) is only fetched for a concrete date, and
  // the auto-refresh re-quotes on traveler changes only once a date is picked.
  // Before that the frozen quote reflects the initial mount-time selection, so
  // a changed traveler mix would otherwise show a stale subtotal/total — the
  // live client mirror (identical math to the checkout engine) stays accurate.
  const hasLiveQuote = !!selectedDate && pricingResult != null
  const displayTotal = hasLiveQuote ? pricingResult!.total : clientSubtotal

  // Special offers a supplier applied to this tour on the supplier platform.
  // The backend projection (GET /tours/:id) already filters to ACTIVE offers
  // whose date window includes today. The checkout engine auto-applies the
  // best one — `discounts` is the ground truth of what was actually applied.
  // Offer figures only render once a live quote exists for the chosen date;
  // pre-date the summary shows the accurate mirror without a discount.
  const activeOffers: SpecialOfferData[] = Array.isArray(tour.specialOffers) ? tour.specialOffers : []
  const savedAmount = hasLiveQuote ? (pricingResult?.discounts ?? 0) : 0
  const subtotalAmount = hasLiveQuote
    ? (pricingResult?.subtotal ?? 0)
    : (clientSubtotal > 0 ? clientSubtotal : 0)
  // Round like the tour cards (FormattedPrice) so the widget's headline and
  // totals show the same rounded figures as the card on the homepage.
  const formatMoney = (n: number) => `${currency.symbol}${Math.round(convertPrice(n)).toLocaleString()}`

  // Offer pricing for the headline "From $X" figure: strike the original unit
  // price and show the discounted unit price in red — using the exact same
  // logic as the tour cards (best supplier offer applied to the headline base
  // price), so the widget and the card never disagree. The checkout-confirmed
  // discount (which reflects the real tier for the selected date/headcount)
  // is shown in the price summary below, not in the headline.
  // The headline unit price tracks the traveler selector:
  // - per-person: the adult category's tier-resolved per-person price for the
  //   CURRENT total headcount (falls back to the "From" minimum while nothing
  //   is selected or when the tour has no adult category).
  // - per-group: the band that matches the current group size (falls back to
  //   the lowest band when no selection maps to one).
  const perPersonHeadline = adultGroup
    ? (totalTravelers > 0
        ? unitPriceFor(adultGroup)
        : (lowestAdultFromTravelerPricing(travelerGroups) ?? tour.price))
    : (lowestAdultFromTravelerPricing(travelerGroups) ?? tour.price)
  const headlineGroupBand = matchingGroupBand ?? lowestGroupBand
  const originalUnitPrice = isPerGroup
    ? (headlineGroupBand?.price ?? 0)
    : perPersonHeadline
  const offerPerUnitDiscount =
    activeOffers.length > 0 && originalUnitPrice > 0
      ? bestOfferDiscountAmount(activeOffers, originalUnitPrice)
      : 0
  const promoUnitPrice = offerPerUnitDiscount > 0 ? originalUnitPrice - offerPerUnitDiscount : null
  const showPromoPrice =
    promoUnitPrice != null && promoUnitPrice > 0 && promoUnitPrice < originalUnitPrice

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
            {isPerGroup ? (
              headlineGroupBand ? (
                <>
                  <span className="booking-price-from">{t('common.from')}</span>
                  {showPromoPrice ? (
                    <>
                      <span className="booking-price-amount booking-price-amount--strike">{formatMoney(originalUnitPrice)}</span>
                      <span className="booking-price-amount booking-price-amount--promo">{formatMoney(promoUnitPrice!)}</span>
                    </>
                  ) : (
                    <span className="booking-price-amount">
                      {formatMoney(headlineGroupBand.price)}
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
          {/* Date selector */}
          <div className="booking-field" ref={calendarRef}>
            <label className="booking-label">
              <CalendarDays size={18} />
              {t('tourDetail.selectDate')}
            </label>
            <button
              type="button"
              className="booking-input"
              onClick={() => { setShowCalendar((v) => !v); setShowGuestSelector(false) }}
              aria-expanded={showCalendar}
            >
              <span className="booking-input-main">
                <span className="booking-input-date">{selectedDateLabel}</span>
                {selectedTimeLabel && <span className="booking-selected-time">{selectedTimeLabel}</span>}
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
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
                  style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50 }}
                >
                  <CalendarPicker
                    isOpen={showCalendar}
                    onClose={() => setShowCalendar(false)}
                    onDateSelect={(date) => {
                      setSelectedDate(date)
                      onSelectedDateChange?.(date)
                      setSelectedTime(null)
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
                                const isSelectedSlot = selectedTime === slot.time
                                return (
                                  <button
                                    key={slot.time}
                                    type="button"
                                    disabled={slotFull}
                                    onClick={() => {
                                      setSelectedTime(slot.time)
                                      setShowCalendar(false)
                                    }}
                                    className={`booking-slot-chip${isSelectedSlot ? ' booking-slot-chip-active' : ''}`}
                                  >
                                    <span className="booking-slot-time">{formatSlotTime(slot.time)}</span>
                                    {slot.remaining != null && (
                                      <span className="booking-slot-cap">
                                        {slotFull
                                          ? t('booking.soldOut', 'Sold out')
                                          : selectedDayInfo?.capacityUnit === 'groups'
                                            ? `${Math.max(0, slot.groupsRemaining ?? 0)} ${t('booking.groupSlots', 'group slots')}`
                                            : `${Math.max(0, slot.remaining)} ${t('booking.spotsLeft', 'spots left')}`}
                                      </span>
                                    )}
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

          {/* Guest selector */}
          <div className="booking-field" ref={guestRef}>
            <label className="booking-label">
              <Users size={18} />
              {t('booking.travelers')}
            </label>
            <button
              type="button"
              className="booking-input"
              onClick={() => { setShowGuestSelector((v) => !v); setShowCalendar(false) }}
              aria-expanded={showGuestSelector}
            >
              <span>
                {totalTravelers} {t('booking.traveler', { count: totalTravelers })}
                {isPerGroup && activeGroupBandLabel && (
                  <span className="booking-active-band">
                    {' '}· {t('booking.groupOf', 'Group of {{range}}', { range: activeGroupBandLabel })}
                  </span>
                )}
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
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
                            onClick={() => decrement(opt.key)}
                            disabled={!canDecrement}
                            aria-label={`Remove one ${opt.label}`}
                          >
                            <Minus size={16} />
                          </button>
                          <span className="guest-count">{opt.count}</span>
                          <button
                            className="guest-btn"
                            onClick={() => increment(opt.key)}
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

          {/* Submit */}
          <Button
            className="booking-submit-btn"
            onClick={handleBookNow}
            disabled={isBooking || (!!selectedDate && selectedDaySlots.length > 0 && !selectedTime) || (!isPerGroup && mixIssues.length > 0)}
          >
            {isBooking ? (
              <span className="booking-btn-loader">
                <svg className="booking-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                </svg>
                {t('booking.checking')}
              </span>
            ) : (
              t('tourDetail.bookNow')
            )}
          </Button>

          {/* Date-specific cancellation cutoff — matches the Quick facts
              label, shown right after Book now. */}
          {cancellationNote && (
            <p className="booking-cancel-note">
              <ShieldCheck size={14} />
              {cancellationNote}
            </p>
          )}

          {/* Assistance */}
          <div className="booking-assistance">
            <p className="booking-assistance-title">{t('tourDetail.needFurtherAssistance')}</p>
            <button type="button" className="booking-assistance-btn" onClick={() => setShowChat(true)}>
              <MessageSquare size={16} />
              {t('tourDetail.startChat')}
              {hasSupplierUnread && <span className="booking-assistance-unread" aria-label="Unread messages" />}
            </button>
          </div>
        </div>
      </div>
      {showChat && (
        <SupportChatWidget
          initialOpen
          initialRecipient={
            tour.supplierProfile?.id
              ? { id: tour.supplierProfile.id, name: tour.supplierProfile.name, photoURL: tour.supplierProfile.photoURL }
              : null
          }
          onOpenAuth={onOpenAuth}
        />
      )}

      <AnimatePresence>
        {showTransition && (
          <BookingTransition onDone={handleTransitionDone} vehicleIndex={transitVehicle} />
        )}
      </AnimatePresence>
    </div>
  )
}
