import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence, useAnimate } from 'framer-motion'
import { toast } from 'sonner'
import {
  Check, ArrowLeft, MapPin, CalendarDays, CalendarCheck, Users, Info, X,
  Phone, ShieldCheck, Clock, Globe, Loader2,
  Car, CreditCard, Ticket, ExternalLink, Layers,
} from 'lucide-react'
import logoSrc from '../assets/TravioG.png'
import Footer from '../components/Footer'
import StarRating from '../components/StarRating'
import StepBadge from '../components/booking/StepBadge'
import { FieldLabel, TextInput, SelectInput } from '../components/booking/FormFields'
import ChangeBookingModal from '../components/booking/ChangeBookingModal'
import ExpiredHoldModal from '../components/booking/ExpiredHoldModal'
import SignInPromptModal from '../components/booking/SignInPromptModal'
import CardField from '../components/booking/CardField'
import SavedCardPicker, { NEW_CARD } from '../components/booking/SavedCardPicker'
import { getPaymentMethods } from '../features/account/api'
import OptionSelector from '../components/booking/OptionSelector'
import BookingTransition from '../components/BookingTransition'
import { useAuthUser } from '../hooks/useAuthUser'
import { setAuthReturnTo } from '../lib/auth'
import type { CardElementHandle } from '../components/booking/CardField'
import { fetchWithAuth } from '../lib/api'
import { useCreateBooking, useCalculateCheckout } from '../hooks/useExpeditionBookings'
import { buildE164Phone, isValidPhoneInput, splitE164Phone, COUNTRY_CODES } from '../lib/phone'
import { getAccount } from '../features/account/api'
import type { TourOption } from '../lib/tourTypes'
import { hasLocationOnlyAreas, isPickupLocationSatisfied, pickupZoneStatus, distanceMeters, type PickupAreaShape } from '../lib/pickupZone'
import LocationMap from '../components/booking/LocationMap'
import MapErrorBoundary from '../components/booking/MapErrorBoundary'
import PickupSelectModal from '../components/booking/PickupSelectModal'
import PickupLocationSection from '../components/booking/PickupLocationSection'
import TravelTimeChip from '../components/booking/TravelTimeChip'
import { appleMapsDirectionsUrl, googleMapsDirectionsUrl } from '../lib/geoapifyRouting'
import { toNumber } from '../lib/mapUtils'
import { useResolvedTourPoints } from '../hooks/useResolvedTourPoints'
import { useExpeditionTour } from '../hooks/useExpeditionTours'
import type { ResolveTourSource } from '../lib/resolvePoints'
import type { PickupZoneMapTour } from '../components/booking/PickupZoneMap'
import { DEFAULT_BOOKING_TOUR, buildBookingTour, type BookingTour } from '../lib/bookingTour'
import OptimizedImage from '@/components/shared/OptimizedImage'
import { useCurrency } from '../contexts/CurrencyContext'
import {
  isSupplierOperatingDay,
  openingHoursForDay,
  weeklyHoursRange,
  formatTimeSlotList,
  formatTime12h,
  type TourScheduleInfo,
} from '../lib/tourAvailability'
import { cancellationStatus } from '../lib/cancellationLabel'
import { requestLocation } from '../lib/analytics'
import { reverseGeocode } from '../lib/locations'

/* --- Tour data from location state --- */

// Neutral placeholder tour shown only while no tour context is available yet
// (no router state, no matching draft, and the by-id re-fetch is still in
// flight). The full booking tour shape lives in lib/bookingTour.
const FALLBACK_TOUR: BookingTour = DEFAULT_BOOKING_TOUR

// Reserve-now-pay-later floor: the backend (payLaterLeadTime, default 48h) only
// lets a customer reserve now/pay later when the activity is at least this far
// out, so the pay-later sweep always has its 24h charge window. Mirrored here
// (client heuristic) so the UI disables the option instead of dead-ending on a
// server 400. The server remains authoritative regardless.
const PAY_LATER_MIN_HOURS = 48
const PAY_LATER_WINDOW_MS = PAY_LATER_MIN_HOURS * 60 * 60 * 1000

// Time label for the date/time summary rows: time-slot tours show the chosen
// slot; opening-hours tours show the selected day's opening hours, falling back
// to the weekly range so the supplier's choice is never hidden behind a fake
// "9:00 AM" default.
function scheduleTimeLabel(tour: typeof FALLBACK_TOUR): string {
  if (tour.scheduleType === 'operatingHours') {
    if (tour.dateISO) {
      const dayHours = openingHoursForDay(tour, new Date(`${tour.dateISO}T00:00:00`))
      if (dayHours) return dayHours
    }
    const range = weeklyHoursRange(tour)
    if (range) return range
    return 'Flexible time'
  }
  return tour.time || '9:00 AM'
}

const DAY_MONTH_YEAR_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// Day-Month-Year label for the summary card's Date row, e.g.
// "2026-08-20" ? "20 Aug 2026". Returns null for empty/invalid input.
function formatDayMonthYear(dateISO: string): string | null {
  if (!dateISO) return null
  const date = new Date(`${dateISO}T12:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getDate()} ${DAY_MONTH_YEAR_MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

// Guards against stale persisted/cached validity labels (e.g. an old booking
// draft storing "Valid 1 days from booking") by re-pluralizing the unit to
// match the count ("Valid 1 day from booking").
function normalizeTicketValidity(label?: string): string {
  if (!label) return ''
  return label.replace(
    /\b(\d+)\s+(days?|weeks?|months?)\b/gi,
    (full, n: string, unit: string) => {
      void full
      const count = parseInt(n, 10)
      const base = unit.replace(/s$/i, '')
      return `${n} ${count === 1 ? base : `${base}s`}`
    },
  )
}

/* --- Page entrance variants --- */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 20 } },
}

const stepContentVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' as const } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.1, ease: 'easeIn' as const } },
}

/* --- Mobile Summary Card --- */

/* --- Hold Timer --- */

function CountdownDigit({ value, label }: { value: number; label: string }) {
  const [scope, animate] = useAnimate();
  const prevRef = useRef(value);

  useEffect(() => {
    if (value !== prevRef.current) {
      (async () => {
        await animate(scope.current, { y: ["0%", "50%"], opacity: [1, 0] }, { duration: 0.2 });
        prevRef.current = value;
        await animate(scope.current, { y: ["-50%", "0%"], opacity: [0, 1] }, { duration: 0.2 });
      })();
    }
  }, [value, animate, scope]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full overflow-hidden text-center">
        <span ref={scope} className="block text-lg font-bold text-emerald-900 tabular-nums">
          {String(value).padStart(2, '0')}
        </span>
      </div>
      <span className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function HoldTimer({ onExpire, lastActivityAt, isExpired }: { onExpire: () => void; lastActivityAt: React.MutableRefObject<number>; isExpired: boolean }) {
  const [seconds, setSeconds] = useState(25 * 60)
  const hasExpired = useRef(false)

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      if (now - lastActivityAt.current < 30_000) {
        setSeconds(25 * 60)
        hasExpired.current = false
        return
      }
      setSeconds((s) => {
        if (s <= 1) {
          if (!hasExpired.current) {
            hasExpired.current = true
            onExpire()
          }
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [onExpire, lastActivityAt])

  const m = Math.floor(seconds / 60)
  const s = seconds % 60

  if (isExpired) {
    return (
      <motion.div variants={itemVariants} className="flex items-center gap-2.5 rounded-[1.25rem] bg-rose-50 px-5 py-3.5 text-sm font-semibold text-rose-700 shadow-sm">
        <span className="flex size-8 items-center justify-center rounded-full bg-rose-100 text-rose-500">
          <Clock className="size-4" />
        </span>
        <span>Hold expired</span>
      </motion.div>
    )
  }

  return (
    <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-[1.25rem] bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <Clock className="size-4" />
      </span>
      <span className="shrink-0">We&apos;ll hold your spot for</span>
      <div className="flex shrink-0 items-center gap-4">
        <CountdownDigit value={m} label="min" />
        <span className="self-start pt-0.5 text-lg font-bold text-emerald-900 tabular-nums">:</span>
        <CountdownDigit value={s} label="sec" />
      </div>
    </motion.div>
  )
}

/* --- Step wrapper --- */

function StepCard({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div
      id={id}
      className="scroll-mt-40 rounded-[1.75rem] border border-slate-200/40 bg-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] md:scroll-mt-20"
    >
      {children}
    </div>
  )
}

/* --- Meeting & Pickup card --- */

// Pickup reference windows mirror the supplier's Step 13 options
// (PICKUP_TIME_OPTIONS): how long before the activity start pickup happens.
const PICKUP_REF_LABELS: Record<string, string> = {
  '0-15': 'Pickup 0–15 min before the activity starts',
  '0-30': 'Pickup 0–30 min before the activity starts',
  '0-45': 'Pickup 0–45 min before the activity starts',
  '0-60': 'Pickup up to 1 hour before the activity starts',
  '0-90': 'Pickup up to 1.5 hours before the activity starts',
  '0-120': 'Pickup up to 2 hours before the activity starts',
}
function referenceStartLabel(value?: string): string {
  if (!value) return ''
  return PICKUP_REF_LABELS[value] || `Pickup ${value} before the activity starts`
}

// Renders exactly how travellers get to (and leave) the activity, mirroring
// the supplier's Step 13 "Meeting point or pickup" configuration:
//   meeting_point ? travellers go to the starting point themselves
//   pickup       ? travellers are picked up (areas / locations + description)
//   none / n/a   ? neutral note (pickup arranged after booking, if any)
// Drop-off is appended when the supplier configured one.
// `embedded` renders it as a sub-section (no outer card border/background) so
// it can sit inside the tour summary card without a nested box.
function MeetingPickupCard({ tour, embedded = false, onOpenMap, showMapLink = true, showDirections = false, capturedLocation, isCapturingLocation }: {
  tour: typeof FALLBACK_TOUR
  embedded?: boolean
  /** Opens the map modal (a pin per pickup spot). */
  onOpenMap?: () => void
  /** Whether the "Select on Map" link is shown (hidden in the collapsed summary). */
  showMapLink?: boolean
  /** Whether the Google/Apple Maps directions links (meeting-point tours) are shown. */
  showDirections?: boolean
  /** User's captured location address for meeting point tours. */
  capturedLocation?: string
  /** Whether location is still being captured. */
  isCapturingLocation?: boolean
}) {
  const mode = tour.meetingMode

  // Destination for the meeting-point directions links — only when the
  // supplier provided coordinates (nothing renders otherwise).
  const meetingPointDest = useMemo(() => {
    const lat = toNumber(tour.meetingPointLat)
    const lng = toNumber(tour.meetingPointLng)
    return lat != null && lng != null
      ? { lat, lng, label: tour.meetingPoint || tour.meetingPointAddress || 'the meeting point' }
      : null
  }, [tour.meetingPointLat, tour.meetingPointLng, tour.meetingPoint, tour.meetingPointAddress])

  // The directions links route from the traveller's CURRENT location to the
  // meeting point — the device location is resolved when the links render so
  // the origin is baked into the deep-links before they are clicked.
  const geolocationSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.geolocation &&
    typeof navigator.geolocation.getCurrentPosition === 'function'
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null)
  const [originStatus, setOriginStatus] = useState<'locating' | 'located' | 'error'>('locating')

  useEffect(() => {
    if (!showDirections || !meetingPointDest || !geolocationSupported) return
    let active = true
    const geo = navigator.geolocation
    if (!geo) return
    geo.getCurrentPosition(
      (pos) => {
        if (!active) return
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setOriginStatus('located')
      },
      () => {
        if (active) setOriginStatus('error')
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    )
    return () => {
      active = false
    }
  }, [showDirections, meetingPointDest, geolocationSupported])

  // True while the device location is still being resolved (the links are held
  // back so they always carry the correct origin when clicked).
  const locating = geolocationSupported && originStatus === 'locating' && origin == null

  const arrivalLabel = () => {
    if (mode !== 'meeting_point') return ''
    if (tour.arrivalTimeType === 'custom') {
      return tour.arrivalTimeCustom ? `Arrive by ${tour.arrivalTimeCustom}` : ''
    }
    switch (tour.arrivalTimeType) {
      case '5min': return 'Arrive 5 minutes before the activity'
      case '10min': return 'Arrive 10 minutes before the activity'
      case '15min': return 'Arrive 15 minutes before the activity'
      case '30min': return 'Arrive 30 minutes before the activity'
      case 'notified': return 'Arrival time will be notified'
      default: return ''
    }
  }

  const hasStart = mode === 'meeting_point' || mode === 'pickup'

  const pickupAreas = Array.isArray(tour.pickupAreas) ? tour.pickupAreas.filter((a) => a && (a.name || a.address)) : []
  const pickupLocations = Array.isArray(tour.pickupLocations) ? tour.pickupLocations.filter((l) => l && (l.name || l.address)) : []

  const hasMeetingPoint = mode === 'meeting_point' && !!(tour.meetingPoint || tour.meetingPointAddress || arrivalLabel() || tour.meetingPointDescription)
  const hasPickup = mode === 'pickup' && (pickupAreas.length > 0 || pickupLocations.length > 0 || !!tour.pickupDescription || !!tour.referenceStartTime)

  // No meeting point / pickup configured at all — fall back to the neutral note.
  if (!hasStart) {
    if (embedded) {
      return <p className="text-sm text-slate-400">Pickup details will be provided after booking confirmation.</p>
    }
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/20 p-4">
        <p className="text-sm text-slate-400">Pickup details will be provided after booking confirmation.</p>
      </div>
    )
  }

  return (
    <div className={embedded ? 'px-3 pt-3 pb-3' : 'overflow-hidden rounded-xl border border-slate-200/40 bg-slate-50/30'}>
      <div className={`space-y-3 text-sm text-slate-600 ${embedded ? '' : 'px-4 py-3'}`}>
        {mode === 'meeting_point' && hasMeetingPoint && (
          <div className="space-y-2">
            {tour.meetingPoint && (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                <span><strong className="font-semibold text-slate-800">Meeting point:</strong> {tour.meetingPoint}</span>
              </p>
            )}
            {tour.meetingPointAddress && tour.meetingPointAddress !== tour.meetingPoint && !tour.meetingPoint?.includes(tour.meetingPointAddress) && (
              <p className="pl-[22px] text-slate-400">{tour.meetingPointAddress}</p>
            )}
            {arrivalLabel() && (
              <div className="space-y-1">
                <p className="flex items-center gap-2 font-semibold text-slate-700">
                  <Clock className="size-3.5 text-emerald-600" />
                  Arrival time
                </p>
                <p className="pl-[22px] text-slate-500">{arrivalLabel()}</p>
              </div>
            )}
            {showDirections && meetingPointDest && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-[22px] text-xs">
                <span className="font-semibold text-slate-600">Directions:</span>
                {locating ? (
                  <span className="inline-flex items-center gap-1 font-medium text-slate-500">
                    <Loader2 size={11} className="animate-spin" />
                    Locating your current location…
                  </span>
                ) : (
                  <>
                    <a
                      href={googleMapsDirectionsUrl(origin, { lat: meetingPointDest.lat, lng: meetingPointDest.lng }, 'drive')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-emerald-700 underline underline-offset-2 transition-colors hover:text-emerald-900"
                    >
                      Open in Google Maps <ExternalLink size={11} />
                    </a>
                    <span className="text-slate-300">·</span>
                    <a
                      href={appleMapsDirectionsUrl(origin, { lat: meetingPointDest.lat, lng: meetingPointDest.lng })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-emerald-700 underline underline-offset-2 transition-colors hover:text-emerald-900"
                    >
                      Apple Maps <ExternalLink size={11} />
                    </a>
                    {origin && (
                      <span className="text-slate-400">from your current location</span>
                    )}
                  </>
                )}
              </div>
            )}
            {tour.meetingPointDescription && (
              <p className="pl-[22px] leading-relaxed text-slate-500">{tour.meetingPointDescription}</p>
            )}
            {isCapturingLocation && (
              <p className="flex items-center gap-2 pl-[22px] text-sm text-slate-500">
                <Loader2 size={13} className="animate-spin" />
                Detecting your location…
              </p>
            )}
            {capturedLocation && !isCapturingLocation && (
              <p className="flex items-center gap-2 pl-[22px] text-sm text-slate-600">
                <MapPin className="size-3.5 shrink-0 text-emerald-600" />
                Your location: {capturedLocation}
              </p>
            )}
            </div>
        )}

        {mode === 'pickup' && hasPickup && (
          <div className="space-y-2">
            {pickupAreas.length + pickupLocations.length > 0 && showMapLink && (
              <button
                type="button"
                onClick={onOpenMap}
                className="flex w-full items-center gap-2 font-semibold text-slate-700 transition-colors hover:text-emerald-700"
              >
                <Car className="size-3.5 shrink-0 text-emerald-600" />
                <span className="min-w-0 truncate">Pickup locations ({pickupAreas.length + pickupLocations.length})</span>
                <span className="ml-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-emerald-600 underline underline-offset-2">
                  Select on Map
                  <MapPin className="size-3.5" />
                </span>
              </button>
            )}
            {tour.pickupDescription && (
              <div className="space-y-1">
                <p className="flex items-center gap-2 font-semibold text-slate-700">
                  <Info className="size-3.5 text-emerald-600" />
                  Pickup info
                </p>
                <p className="flex items-start gap-2 pl-[22px] leading-relaxed text-slate-500">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[#179237]" />
                  <span>{tour.pickupDescription}</span>
                </p>
              </div>
            )}
            {referenceStartLabel(tour.referenceStartTime) && (
              <p className="flex items-start gap-2 pl-[22px] text-slate-500">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[#179237]" />
                <span>{referenceStartLabel(tour.referenceStartTime)}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* --- Meeting point / pickup photo --- */

// Meeting-point / pickup photo uploaded by the supplier (Step 13). Rendered
// separately from the meeting/pickup info so it can sit after the map. Tapping
// it opens the full-size image. Renders nothing when no photo is configured.
function MeetingPointPhoto({ src, title = 'Meeting point photo' }: { src?: string; title?: string }) {
  const [showPhoto, setShowPhoto] = useState(false)
  if (!src) return null

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
        <MapPin className="size-3.5 text-emerald-600" />
        {title}
      </p>
      <button
        type="button"
        onClick={() => setShowPhoto(true)}
        className="block w-full cursor-zoom-in overflow-hidden rounded-lg border border-slate-200/60"
        aria-label="View meeting point photo"
      >
        <OptimizedImage
          src={src}
          alt="Meeting point"
          width={800}
          className="max-h-40 w-full object-cover"
        />
      </button>
      <AnimatePresence>
        {showPhoto && (
          <motion.div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPhoto(false)}
          >
            <button
              type="button"
              onClick={() => setShowPhoto(false)}
              className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Close photo"
            >
              <X size={20} />
            </button>
            <img
              src={src}
              alt="Meeting point"
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* --- Step 1 — Lead Traveler Details --- */

function ContactDetailsStep({
  tour, data, onChange, onNext, valid, step, onNavigate, hasError, disabled,
}: {
  tour: typeof FALLBACK_TOUR
  data: { firstName: string; lastName: string; email: string; countryCode: string; phone: string }
  onChange: (key: string, value: string | boolean) => void
  onNext: () => void
  valid: { firstName: boolean; lastName: boolean; email: boolean; phone: boolean; all: boolean }
  step: number
  onNavigate: (n: number) => void
  hasError: boolean
  disabled?: boolean
}) {
  const isActive = step === 2
  const isCompleted = step > 2
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const handleBlur = (key: string) => setTouched((prev) => ({ ...prev, [key]: true }))

  const error = (key: string, field: string) =>
    touched[key] && !valid[key as keyof typeof valid]
      ? `Please enter your ${field.toLowerCase()}`
      : undefined

  return (
    <StepCard id="booking-step-2">
      <div className="border-b border-slate-100/60 px-7 py-6 sm:px-9">
        <button
          type="button"
          onClick={() => onNavigate(2)}
          aria-label="Go to Lead Traveler Details"
          className="flex w-full items-start gap-4 text-left transition-opacity hover:opacity-80"
        >
          <StepBadge number={2} active={isActive} completed={isCompleted} error={hasError} />
          <div className="pt-0.5">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Lead Traveler Details</h2>
            <p className="mt-0.5 text-sm text-slate-400">The lead traveler&apos;s name and contact details</p>
          </div>
        </button>
      </div>

      <AnimatePresence mode="popLayout">
        {isActive && (
          <motion.div
            key="contact-active"
            variants={stepContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="space-y-5 p-7 sm:p-9"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <FieldLabel required tooltip="Enter your legal first name as it appears on your ID or passport.">First Name</FieldLabel>
                <TextInput
                  value={data.firstName}
                  onChange={(e) => onChange('firstName', e.target.value)}
                  onBlur={() => handleBlur('firstName')}
                  placeholder="e.g. Richard"
                  maxLength={100}
                  valid={valid.firstName}
                  error={error('firstName', 'first name')}
                />
              </div>
              <div>
                <FieldLabel required tooltip="Enter your surname or family name as it appears on your ID.">Last Name</FieldLabel>
                <TextInput
                  value={data.lastName}
                  onChange={(e) => onChange('lastName', e.target.value)}
                  onBlur={() => handleBlur('lastName')}
                  placeholder="e.g. Boochie"
                  maxLength={100}
                  valid={valid.lastName}
                  error={error('lastName', 'last name')}
                />
              </div>
            </div>

            <div>
              <FieldLabel required tooltip="Your booking confirmation, receipt and important updates will be sent here.">Email</FieldLabel>
              <TextInput
                type="email"
                value={data.email}
                onChange={(e) => onChange('email', e.target.value)}
                onBlur={() => handleBlur('email')}
                placeholder="e.g. richard@example.com"
                valid={valid.email}
                error={touched.email && !valid.email ? 'Please enter a valid email address' : undefined}
              />
            </div>

            <div>
              <FieldLabel required tooltip="The tour operator may use this to contact you about pickup or last-minute changes.">Phone Number</FieldLabel>
              <div className="grid gap-3 sm:grid-cols-[1.2fr_2fr]">
                <SelectInput value={data.countryCode} onChange={(e) => onChange('countryCode', e.target.value)} options={COUNTRY_CODES} />
                <TextInput
                  type="tel"
                  value={data.phone}
                  onChange={(e) => onChange('phone', e.target.value.replace(/\D/g, ''))}
                  onBlur={() => handleBlur('phone')}
                  placeholder="e.g. 024 123 4567"
                  valid={valid.phone}
                  error={
                    touched.phone && !valid.phone
                      ? 'Enter a valid phone number for the selected country, e.g. 024 123 4567'
                      : undefined
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/40 bg-slate-50/30 px-4 py-3">
              <Globe className="size-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">Tour Language</span>
              <span className="text-sm text-slate-400">{tour.language}</span>
            </div>

            {!valid.all && (Object.keys(touched).length > 0 || hasError) && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-lg bg-rose-50 px-4 py-2.5 text-center text-xs font-semibold text-rose-600"
              >
                Please fill in all required fields correctly before proceeding.
              </motion.p>
            )}

            <div className="flex justify-end pt-2">
              <motion.button
                onClick={onNext}
                disabled={!valid.all || disabled}
                whileTap={{ scale: 0.97 }}
                className={`inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-semibold shadow-sm transition ${
                  valid.all && !disabled
                    ? 'bg-emerald-600 text-white hover:brightness-110 cursor-pointer'
                    : 'cursor-not-allowed bg-slate-200 text-white'
                }`}
              >
                {disabled ? 'Hold Expired' : 'Next'}
              </motion.button>
            </div>
          </motion.div>
        )}

        {isCompleted && (
          <motion.div
            key="contact-completed"
            variants={stepContentVariants}
            initial="hidden"
            animate="visible"
            className="space-y-2 p-7 sm:p-9"
          >
            <p className="text-sm font-semibold text-slate-900">{data.firstName} {data.lastName}</p>
            <p className="text-sm text-slate-400">{data.email}</p>
            <p className="text-sm text-slate-400">{data.countryCode} {data.phone}</p>
            {hasError && (
              <p className="pt-1 text-xs font-semibold text-rose-500">There are errors in this step — please review.</p>
            )}
            <button type="button" onClick={() => onNavigate(2)} className="mt-1 text-sm font-semibold text-emerald-600 underline underline-offset-2 hover:text-emerald-700">
              Edit
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </StepCard>
  )
}

/* --- Step 2 — Activity Details --- */

function ActivityDetailsStep({
  tour, onNext, step, onNavigate, hasError, disabled,
  contact, onContactChange, showPickupLocation, locationValid,
  isCapturingLocation,
  options, optionValue, onOptionChange, optionQuoting, optionError,
  staticInfo = false,
}: {
  tour: typeof FALLBACK_TOUR
  onNext: () => void
  step: number
  onNavigate: (n: number) => void
  hasError: boolean
  disabled?: boolean
  contact: { location: string; pickupLater: boolean; pickupLat: number | null; pickupLng: number | null; pickupArea: string }
  onContactChange: (key: string, value: string | boolean | number | null) => void
  showPickupLocation: boolean
  locationValid: boolean
  isCapturingLocation: boolean
  /** Multi-option tours: sellable (non-private) options for the GYG-style
      "Choose your option" picker shown at the top of step 1. */
  options?: TourOption[]
  optionValue?: string | null
  onOptionChange?: (optionId: string) => void
  optionQuoting?: boolean
  optionError?: string
  /** Meeting-point tours whose step 1 is skipped: render the meeting details
      as a static, non-editable block (no step header, badge, Next or Edit). */
  staticInfo?: boolean
}) {
  const isActive = step === 1
  const isCompleted = step > 1
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Zone-aware pickup feedback — mirrors the backend's geoUtils verdict.
  const pickupAreasList = useMemo(
    () => (Array.isArray(tour.pickupAreas) ? tour.pickupAreas.filter((a): a is PickupAreaShape & { name: string } => !!a && !!a.name) : []),
    [tour.pickupAreas],
  )
  const zonesDrawn = useMemo(
    () => pickupAreasList.some((a) => !!a && Array.isArray(a.polygon) && a.polygon.length >= 3),
    [pickupAreasList],
  )
  const hasPointAreas = useMemo(() => hasLocationOnlyAreas(tour.pickupAreas || []), [tour.pickupAreas])
  const geofenced = zonesDrawn || hasPointAreas
  const zoneStatus = useMemo(
    () =>
      showPickupLocation && !contact.pickupLater
        ? pickupZoneStatus({ name: contact.location, lat: contact.pickupLat, lng: contact.pickupLng }, tour.pickupAreas || [])
        : 'none',
    [showPickupLocation, contact.pickupLater, contact.location, contact.pickupLat, contact.pickupLng, tour.pickupAreas],
  )
  // Map pin verdict — when the traveller's location is outside the pinned
  // pickup zones/points, the map shows a red pin with an × instead of blue.
  const mapUserOutOfRange = useMemo(
    () =>
      contact.pickupLat != null &&
      contact.pickupLng != null &&
      contact.location.trim().length >= 3 &&
      geofenced &&
      (zoneStatus === 'outside' || zoneStatus === 'excluded'),
    [contact.pickupLat, contact.pickupLng, contact.location, geofenced, zoneStatus],
  )

  // The pickup-locations map lives in a modal; the "Pickup locations (N)" link
  // opens it (a pin per pickup spot) via the PickupZoneMap below.
  const [showMapModal, setShowMapModal] = useState(false)
  const handleOpenMap = () => setShowMapModal(true)
  const handleCloseMap = () => setShowMapModal(false)

  // Geocode pipeline — resolves every meeting/pickup point to exact lat/lng
  // (forward-geocoding entries that only have a name/address), so the maps
  // always render pins at the exact locations.
  const { points: resolvedPoints, mapTour, loading: resolvingPoints } = useResolvedTourPoints(tour as ResolveTourSource)

  // The tour's meeting point coordinates (when the supplier provided them) —
  // feeds the ETA chip that shows how long the traveller's pickup location is
  // from the meeting point.
  const meetingPointCoords = useMemo(() => {
    const lat = toNumber(tour.meetingPointLat)
    const lng = toNumber(tour.meetingPointLng)
    return lat != null && lng != null ? { lat, lng } : null
  }, [tour.meetingPointLat, tour.meetingPointLng])

  // Label of the pickup point the traveller's chosen coordinates land on —
  // a pin tap commits the point's exact coordinates, so a tight radius only
  // matches a real pin selection. The matching map pin renders in the bright
  // green check-mark style (no blue user pin on top of it).
  const selectedPinLabel = useMemo(() => {
    if (contact.pickupLat == null || contact.pickupLng == null) return null
    for (const p of resolvedPoints) {
      if (p.kind !== 'point' || p.lat == null || p.lng == null) continue
      if (distanceMeters(contact.pickupLat, contact.pickupLng, p.lat, p.lng) <= 25) {
        return p.name || p.address || ''
      }
    }
    return null
  }, [resolvedPoints, contact.pickupLat, contact.pickupLng])

  // Coordinate + label of the chosen pickup POINT — non-null only when the
  // traveller picked a designated pickup point (selectedPinLabel set). A plain
  // map click or free-typed address is NOT a designated point: it must keep
  // rendering the draggable user pin, so selectedPin stays null there.
  const selectedPin = useMemo(() => {
    if (selectedPinLabel == null || contact.pickupLat == null || contact.pickupLng == null) return null
    return { lat: contact.pickupLat, lng: contact.pickupLng, label: selectedPinLabel }
  }, [contact.pickupLat, contact.pickupLng, selectedPinLabel])

  // Tapping a pickup/meeting pin selects it directly — the point's label and
  // coordinates land on the form without dropping a separate blue pin.
  const handlePinClick = (label: string): void => {
    const point = resolvedPoints.find((p) => (p.name || p.address) === label)
    if (!point || point.kind === 'meeting' || point.lat == null || point.lng == null) return
    onContactChange('pickupArea', '')
    onContactChange('location', point.name || point.address || label)
    onContactChange('pickupLat', point.lat)
    onContactChange('pickupLng', point.lng)
    setTouched((t) => ({ ...t, location: true }))
  }

  const meetingSummaryCard = (
    <div className="overflow-hidden rounded-xl border border-slate-200/40 bg-slate-50/30">
      {/* Meeting & pickup — embedded so the summary card carries the start/end
          details; the timing/hours are already shown in the date row above. */}
      <MeetingPickupCard
        tour={tour}
        embedded
        onOpenMap={handleOpenMap}
        showDirections
        capturedLocation={contact.location}
        isCapturingLocation={isCapturingLocation}
      />
    </div>
  )

  // Collapsed summary variant — the "Select on Map" link is hidden here: the
  // traveller already picked their location, so the summary just states it.
  const meetingSummaryCollapsed = (
    <div className="overflow-hidden rounded-xl border border-slate-200/40 bg-slate-50/30">
      <MeetingPickupCard tour={tour} embedded showMapLink={false} />
    </div>
  )

  // Location map — shows the supplier's pickup zones / meeting point, plus the
  // traveller's picked pickup location when one is selected. Renders the
  // Google map first (falling back to Mapbox/MapLibre/OSM), with the ETA chip
  // (pickup ? meeting point) underneath when both coordinates exist.
  const locationMap = (
    <MapErrorBoundary resetKey={mapTour || tour}>
      <LocationMap
        tour={(mapTour || tour) as PickupZoneMapTour}
        suppressDraggablePin={tour.meetingMode === 'meeting_point'}
        userMarker={selectedPin ? null : { lat: contact.pickupLat, lng: contact.pickupLng, label: contact.location }}
        userOutOfRange={mapUserOutOfRange}
        userChosen={contact.pickupLat != null && contact.pickupLng != null && !selectedPin}
        selectedPin={selectedPin}
        selectedPinLabel={selectedPinLabel}
        onPinClick={handlePinClick}
        onUserPointChange={(lat, lng) => {
          onContactChange('pickupLat', lat)
          onContactChange('pickupLng', lng)
          onContactChange('pickupArea', '')
          // Surface the out-of-range verdict right away when the marker is
          // placed outside the supplier's pickup zone.
          setTouched((t) => ({ ...t, location: true }))
        }}
        onUserAddressChange={(address) => {
          // Map-click reverse geocode — keep the address text in sync with the
          // pinned coordinates (the LocationPicker re-syncs from its value prop).
          onContactChange('location', address)
        }}
      />
    </MapErrorBoundary>
  )

  const travelTimeChip = (
    <TravelTimeChip
      from={
        contact.pickupLat != null && contact.pickupLng != null
          ? { lat: contact.pickupLat, lng: contact.pickupLng }
          : null
      }
      to={meetingPointCoords}
      destinationLabel="the meeting point"
    />
  )

  // The map preview renders for meeting-point tours and any pickup tour that
  // has geographic data (drawn zones, location-only points, or points resolved
  // to coordinates by the geocode pipeline). Location-only tours keep their
  // selectable list — the map is the pin preview + draggable pickup pin +
  // live zone verdict. Pickup tours with no areas render no map.
  const showZoneMap =
    tour.meetingMode === 'meeting_point' ||
    zonesDrawn ||
    hasPointAreas ||
    resolvedPoints.some((p) => p.lat != null && p.lng != null) ||
    !!(tour.meetingPoint || tour.meetingPointAddress) ||
    (tour.pickupAreas?.length ?? 0) > 0 ||
    (tour.pickupLocations?.length ?? 0) > 0

  const pickupPhoto = (
    <MeetingPointPhoto
      src={tour.meetingPointPicture}
      title={tour.meetingMode === 'pickup' ? 'Pickup point photo' : 'Meeting point photo'}
    />
  )

  // GYG parity: the "Choose your option" picker renders only when the tour
  // offers >1 sellable option. Single-option tours show nothing (and never
  // send an optionId). Built as a fragment so `options` narrows past the
  // length guard.
  const optionPicker = (() => {
    if (!options || options.length <= 1) return null
    return (
      <div className="space-y-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Choose your option</h3>
          {optionQuoting ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <Loader2 className="size-3 animate-spin" />
              Updating price…
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-400">
              Each option has its own availability and pricing — switching re-prices your booking.
            </p>
          )}
        </div>
        <OptionSelector
          options={options}
          value={optionValue}
          onChange={(id) => onOptionChange?.(id)}
          disabledIds={optionQuoting ? new Set(options.map((o) => o.id)) : undefined}
        />
        {optionError && (
          <p role="alert" className="rounded-lg bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-600">
            {optionError}
          </p>
        )}
      </div>
    )
  })()

  // Chosen-option summary row shown once the step is collapsed (steps 2-3).
  const optionSummaryCollapsed = (() => {
    if (!options || options.length <= 1 || !optionValue) return null
    const title = options.find((o) => o.id === optionValue)?.title
    if (!title) return null
    return (
      <div className="flex items-start gap-2 text-sm text-slate-600">
        <Layers className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
        <p>
          <span className="font-semibold text-slate-800">Option:</span>{' '}
          <span>{title}</span>
        </p>
      </div>
    )
  })()

  // Meeting-point tours whose step 1 is skipped: show the meeting details as a
  // static, non-editable block (no step header, badge, Next or Edit).
  if (staticInfo) {
    return (
      <div className="rounded-[1.75rem] border border-slate-200/40 bg-white p-7 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] sm:p-9">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Meeting point</h2>
        <div className="mt-4 space-y-5">
          {meetingSummaryCard}
          {showZoneMap && (
            <div className="space-y-1">
              {resolvingPoints && (
                <p className="flex items-center gap-1.5 px-1 text-[11px] font-medium text-slate-400">
                  <Loader2 className="size-3 animate-spin" />
                  Locating pickup points…
                </p>
              )}
              {locationMap}
              {travelTimeChip}
            </div>
          )}
          {pickupPhoto}
        </div>
      </div>
    )
  }

  return (
    <>
    <StepCard id="booking-step-1">
      <div className="border-b border-slate-100/60 px-7 py-6 sm:px-9">
        <button
          type="button"
          onClick={() => onNavigate(1)}
          aria-label="Go to Meeting and Pickup Info"
          className="flex w-full items-start gap-4 text-left transition-opacity hover:opacity-80"
        >
          <StepBadge number={1} active={isActive} completed={isCompleted} error={hasError} />
          <div className="pt-0.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Meeting and Pickup Info</h2>
              {tour.meetingMode === 'pickup' || tour.meetingMode === 'meeting_point' ? (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                  tour.meetingMode === 'pickup'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {tour.meetingMode === 'pickup'
                    ? (tour.pickupAreas?.length ?? 0) > 0
                      ? 'Pickup Zone'
                      : (tour.pickupLocations?.length ?? 0) > 1
                        ? 'Pickup points'
                        : 'Pickup'
                    : 'Meeting point'}
                </span>
              ) : null}
            </div>
          </div>
        </button>
      </div>

      <AnimatePresence mode="popLayout">
        {isActive && (
          <motion.div
            key="activity-active"
            variants={stepContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="space-y-5 p-7 sm:p-9"
          >
            {optionPicker}

            {!showPickupLocation && meetingSummaryCard}

            {showPickupLocation && (
              <PickupLocationSection
                tour={tour}
                contact={contact}
                onContactChange={onContactChange}
                locationValid={locationValid}
                touched={touched}
                onSetTouched={setTouched}
                resolvedPoints={resolvedPoints}
                mapTour={mapTour}
                resolvingPoints={resolvingPoints}
                onOpenMap={handleOpenMap}
              />
            )}

            {!showPickupLocation && showZoneMap && (
              <div className="space-y-1">
                {resolvingPoints && (
                  <p className="flex items-center gap-1.5 px-1 text-[11px] font-medium text-slate-400">
                    <Loader2 className="size-3 animate-spin" />
                    Locating pickup points…
                  </p>
                )}
                {locationMap}
                {travelTimeChip}
              </div>
            )}
            {!showPickupLocation && pickupPhoto}

                        {!locationValid && (Object.keys(touched).length > 0 || hasError) && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-lg bg-rose-50 px-4 py-2.5 text-center text-xs font-semibold text-rose-600"
              >
                Please fill in all required fields correctly before proceeding.
              </motion.p>
            )}

            <div className="flex justify-end pt-2">
              <motion.button
                onClick={onNext}
                disabled={!locationValid || disabled}
                whileTap={{ scale: 0.97 }}
                className={`inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-semibold shadow-sm transition ${
                  locationValid && !disabled
                    ? 'bg-emerald-600 text-white hover:brightness-110 cursor-pointer'
                    : 'cursor-not-allowed bg-slate-200 text-white'
                }`}
              >
                {disabled ? 'Hold Expired' : 'Next'}
              </motion.button>
            </div>
          </motion.div>
        )}

        {!isActive && (
          <motion.div
            key="activity-collapsed"
            variants={stepContentVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3 p-7 sm:p-9"
          >
            {optionSummaryCollapsed}
            {meetingSummaryCollapsed}
            {/* The map stays out of the collapsed summary — the traveller just
                picked their location on it, so only the ETA chip remains. */}
            {showZoneMap && travelTimeChip}
            {!showPickupLocation && pickupPhoto}
            {showPickupLocation && !contact.pickupLater && (contact.pickupArea || contact.location) && (
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <p>
                    <span className="font-semibold text-slate-800">Traveler's pickup location:</span>{' '}
                    <span>{contact.pickupArea || contact.location}</span>
                  </p>
                  {contact.pickupLat != null && contact.pickupLng != null && (
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span className="font-semibold text-slate-600">Directions:</span>
                      <a
                        href={googleMapsDirectionsUrl(null, { lat: contact.pickupLat, lng: contact.pickupLng }, 'drive')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-emerald-700 underline underline-offset-2 transition-colors hover:text-emerald-900"
                      >
                        Open in Google Maps <ExternalLink size={11} />
                      </a>
                      <span className="text-slate-300">·</span>
                      <a
                        href={appleMapsDirectionsUrl(null, { lat: contact.pickupLat, lng: contact.pickupLng })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-emerald-700 underline underline-offset-2 transition-colors hover:text-emerald-900"
                      >
                        Apple Maps <ExternalLink size={11} />
                      </a>
                    </p>
                  )}
                </div>
              </div>
            )}
            {hasError && (
              <p className="pt-1 text-xs font-semibold text-rose-500">There are errors in this step — please review.</p>
            )}
            {isCompleted && (
              <button type="button" onClick={() => onNavigate(1)} className="text-sm font-semibold text-emerald-600 underline underline-offset-2 hover:text-emerald-700">
                Edit
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </StepCard>

      {/* Pickup/meeting selection modal — opens from the "Pickup locations (N)"
          link or "Choose on map". Browse the map, tap a pin or a row to select
          a pickup zone/point; the exact address is resolved from the point's
          coordinates and written back into the form on Confirm. The error
          boundary keeps a Google-library crash (e.g. quota-limited API) from
          blanking the page when the modal mounts or unmounts. */}
      <MapErrorBoundary>
        <PickupSelectModal
          open={showMapModal}
          onClose={handleCloseMap}
          tour={tour}
          points={resolvedPoints}
          mapTour={mapTour}
          contact={contact}
          onContactChange={onContactChange}
          loading={resolvingPoints}
        />
      </MapErrorBoundary>
    </>
  )
}

/* --- Step 3 — Payment Details --- */

function PaymentDetailsStep({
  data, onChange, tour, onBook, step, onNavigate, disabled, isBooking,
}: {
  data: { paymentTiming: string; paymentMethod: string }
  onChange: (key: string, value: string) => void
  tour: typeof FALLBACK_TOUR
  onBook: (paymentMethodId: string | undefined, timing?: 'now' | 'later') => void
  step: number
  onNavigate: (n: number) => void
  disabled?: boolean
  isBooking?: boolean
}) {
  const isActive = step === 3
  const isCompleted = step > 3
  const [cardHandle, setCardHandle] = useState<CardElementHandle | null>(null)
  const [creating, setCreating] = useState(false)
  const [selectedCardId, setSelectedCardId] = useState('')
  const user = useAuthUser()
  const authenticated = Boolean(user?.email)
  // Saved cards for the reserve-now-pay-later step. Signed-out customers (and
  // failures) simply get an empty list and the plain card field.
  const savedCardsQuery = useQuery({
    queryKey: ['booking', 'saved-cards'],
    queryFn: getPaymentMethods,
    enabled: authenticated,
    staleTime: 60_000,
  })
  const savedCards = (savedCardsQuery.data ?? []).filter((c) => !c.expired)
  const savedCardsReady = !authenticated || savedCardsQuery.isFetched
  // Derived default: first saved card unless the customer picked one explicitly.
  const effectiveCardId = selectedCardId || savedCards[0]?.id || NEW_CARD
  const { formatPrice } = useCurrency()

  // Client-side pay-later availability heuristic (the server enforces the same
  // 48h floor authoritatively). Captured lazily via state so no impure
  // Date.now() call happens during render; remounts when the step activates.
  const [nowMs] = useState(() => Date.now())
  const payLaterAvailable = useMemo(() => {
    const iso = tour.selectedDate || tour.dateISO || ''
    if (!iso) return true // no concrete date yet — let the server decide
    const [y, mo, d] = iso.split('-').map(Number)
    if (!y || !mo || !d) return true
    const activityDayStart = Date.UTC(y, mo - 1, d)
    return activityDayStart - nowMs >= PAY_LATER_WINDOW_MS
  }, [tour.selectedDate, tour.dateISO, nowMs])

  // When the chosen date is inside the pay-later window the option is disabled
  // and the booking quietly falls back to Pay now (no dead-end 400 for the
  // customer who previously had "later" selected).
  const timing: 'now' | 'later' = !payLaterAvailable ? 'now' : (data.paymentTiming === 'later' ? 'later' : 'now')

  // Date-aware cancellation status — a selected date inside the policy window
  // is non-refundable (Viator's rule), matching the tour widget's badge.
  const cancellation = cancellationStatus(
    tour.cancellation || '',
    tour.selectedDate || tour.dateISO || '',
    tour.selectedTime ?? null,
    nowMs,
  )

  const buttonLabel = timing === 'later' ? 'Reserve Now' : 'Pay Now'

  const paymentSummary = (
    <div className="space-y-2 text-sm text-slate-600">
      <p><span className="font-semibold text-slate-800">When to pay:</span> {timing === 'now' ? `Pay now — ${formatPrice(tour.price)}` : 'Reserve now, pay later'}</p>
    </div>
  )

  return (
    <StepCard id="booking-step-3">
      <div className="border-b border-slate-100/60 px-7 py-6 sm:px-9">
        <button
          type="button"
          onClick={() => onNavigate(3)}
          aria-label="Go to Payment Details"
          className="flex w-full items-start gap-4 text-left transition-opacity hover:opacity-80"
        >
          <StepBadge number={3} active={isActive} completed={isCompleted} />
          <div className="pt-0.5">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Payment Details</h2>
          </div>
        </button>
      </div>

      <AnimatePresence mode="popLayout">
        {isActive && (
          <motion.div
            key="payment-active"
            variants={stepContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="space-y-6 p-7 sm:p-9"
          >
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-800">Choose when to pay</p>
              <div className="space-y-2">
                <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all ${
                  timing === 'now'
                    ? 'border-emerald-300 bg-emerald-50/30 shadow-sm'
                    : 'border-slate-200/60 bg-white hover:border-slate-300'
                }`}>
                  <div className={`grid size-5 shrink-0 place-items-center rounded-full border-2 transition ${
                    timing === 'now' ? 'border-emerald-500' : 'border-slate-300'
                  }`}>
                    {timing === 'now' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="size-2.5 rounded-full bg-emerald-500"
                      />
                    )}
                  </div>
                  <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900">Pay now</span>
                  <span className="shrink-0 text-sm font-bold text-slate-900">{formatPrice(tour.price)}</span>
                  <input type="radio" name="paymentTiming" className="sr-only" checked={timing === 'now'} onChange={() => onChange('paymentTiming', 'now')} />
                </label>

                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all sm:items-center ${
                  timing === 'later'
                    ? 'border-emerald-300 bg-emerald-50/30 shadow-sm'
                    : payLaterAvailable
                      ? 'border-slate-200/60 bg-white hover:border-slate-300'
                      : 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-70'
                }`}>
                  <div className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition sm:mt-0 ${
                    timing === 'later' ? 'border-emerald-500' : 'border-slate-300'
                  }`}>
                    {timing === 'later' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="size-2.5 rounded-full bg-emerald-500"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className={`text-sm font-semibold ${payLaterAvailable ? 'text-slate-900' : 'text-slate-400'}`}>Reserve now, pay later</span>
                    <p className="text-xs text-slate-400">Book your spot and pay nothing today</p>
                    {!payLaterAvailable && (
                      <p className="mt-1.5 text-xs font-medium text-amber-600">
                        Available for dates at least {PAY_LATER_MIN_HOURS} hours away — so we can charge your card before the activity.
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-sm font-bold text-slate-900">$0.00</span>
                    <p className="text-[10px] text-slate-400">now</p>
                  </div>
                  <input
                    type="radio"
                    name="paymentTiming"
                    className="sr-only"
                    disabled={!payLaterAvailable}
                    checked={timing === 'later'}
                    onChange={() => onChange('paymentTiming', 'later')}
                  />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/40 bg-slate-50/30 p-6 text-center">
              <p className="text-2xl font-bold text-slate-900 tracking-tight">{formatPrice(tour.price)}</p>
              <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-500">
                <ShieldCheck className={`size-3.5 ${cancellation && !cancellation.refundable ? 'text-rose-500' : 'text-emerald-600'}`} />
                <span className={cancellation && !cancellation.refundable ? 'font-semibold text-rose-600' : ''}>
                  {cancellation?.refundable === false
                    ? `Non-refundable${cancellation.sublabel ? ` — ${cancellation.sublabel}` : ''}`
                    : (cancellation?.label || 'Free cancellation')}
                </span>
              </div>
            </div>

            {timing === 'now' ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-700">
                <ShieldCheck className="size-4 shrink-0" />
                <span>Secure payment powered by Stripe — you'll finish on the next step.</span>
              </div>
            ) : !savedCardsReady ? (
              <div className="h-[52px] animate-pulse rounded-xl border border-slate-200/60 bg-slate-50/40" />
            ) : (
              <div className="space-y-3">
                <SavedCardPicker
                  cards={savedCards}
                  value={effectiveCardId}
                  onChange={setSelectedCardId}
                />
                {effectiveCardId === NEW_CARD && <CardField onReady={setCardHandle} />}
              </div>
            )}

            <p className="text-xs leading-relaxed text-slate-400">
              By clicking &quot;{buttonLabel}&quot;, you agree to our{' '}
              <Link to="/terms-and-conditions" className="font-semibold underline text-slate-500 hover:text-slate-700">Terms</Link> &amp;{' '}
              <Link to="/privacy-policy" className="font-semibold underline text-slate-500 hover:text-slate-700">Privacy and Cookies Statement</Link>
              , plus the tour operator&apos;s rules &amp; regulations.
            </p>

            <motion.button
              onClick={async () => {
                if (timing === 'later') {
                  // A saved card needs no Card Element — send its payment method
                  // id straight through. Only the "new card" path collects one.
                  if (effectiveCardId && effectiveCardId !== NEW_CARD) {
                    setCreating(true)
                    try {
                      onBook(effectiveCardId, 'later')
                    } finally {
                      setCreating(false)
                    }
                    return
                  }
                  if (!cardHandle) {
                    toast.error('Please enter your card details to continue.')
                    return
                  }
                  setCreating(true)
                  try {
                    const { paymentMethod, error } = await cardHandle.createPaymentMethod()
                    if (error || !paymentMethod) {
                      toast.error(error?.message || 'Please check your card details and try again.')
                      return
                    }
                    onBook(paymentMethod.id, 'later')
                  } finally {
                    setCreating(false)
                  }
                } else {
                  // Pay now — no card element. The backend returns a hosted
                  // Stripe Checkout URL and the page redirects there.
                  onBook(undefined, 'now')
                }
              }}
              disabled={disabled || creating || isBooking}
              whileTap={{ scale: 0.97 }}
              className={`relative w-full rounded-full py-3.5 text-sm font-bold text-white shadow-sm transition ${
                disabled || creating || isBooking
                  ? 'cursor-not-allowed bg-slate-300'
                  : 'bg-emerald-600 hover:brightness-110'
              }`}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={isBooking ? 'booking' : creating ? 'creating' : disabled ? 'expired' : buttonLabel}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="inline-block"
                >
                  {isBooking ? 'Booking…' : creating ? 'Creating…' : disabled ? 'Hold Expired' : buttonLabel}
                </motion.span>
              </AnimatePresence>
            </motion.button>

            <p className="text-[11px] leading-relaxed text-slate-400">
              Your booking is facilitated by our platform, but a third-party tour operator provides the
              tour/activity directly to you. By clicking &quot;Book Now&quot;, you consent to receive
              special offers, tips and other updates from us, from which you can unsubscribe at any time.
            </p>
          </motion.div>
        )}

        {!isActive && (
          <motion.div
            key="payment-collapsed"
            variants={stepContentVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3 p-7 sm:p-9"
          >
            {paymentSummary}
            {isCompleted && (
              <button type="button" onClick={() => onNavigate(3)} className="text-sm font-semibold text-emerald-600 underline underline-offset-2 hover:text-emerald-700">
                Edit
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </StepCard>
  )
}

/* --- Tour card --- */

function BookingTourCard({ tour, onChangeClick }: { tour: typeof FALLBACK_TOUR; onChangeClick: () => void }) {
  const { t } = useTranslation()
  const { formatPrice } = useCurrency()

  // Date-aware cancellation badge — non-refundable once the selected date is
  // inside the policy's free-cancellation window (Viator's rule).
  const [nowMs] = useState(() => Date.now())
  const cancellation = cancellationStatus(
    tour.cancellation || '',
    tour.selectedDate || tour.dateISO || '',
    tour.selectedTime ?? null,
    nowMs,
  )

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/40 bg-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
      <div className="flex gap-4 p-5">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold leading-tight text-slate-900 line-clamp-2">{tour.title}</h3>
          <p className="mt-0.5 text-xs text-slate-400">By <span className="font-semibold text-slate-600">{tour.provider}</span></p>
          <div className="mt-2 flex items-center gap-1">
            <span className="text-sm font-bold text-slate-900">{tour.rating}</span>
            <div className="flex items-center gap-0.5">
              <StarRating
                value={tour.rating}
                size={12}
                gap={2}
                filledColor="#10b981"
                emptyColor="#e2e8f0"
              />
            </div>
            <span className="text-xs text-slate-400">({tour.reviews})</span>
          </div>
        </div>
        <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/40">
          <OptimizedImage src={tour.image} alt={tour.title} className="h-full w-full object-cover" width={400} />
        </div>
      </div>

      <div className="border-t border-slate-100/60 px-5 py-3 space-y-2">
        <div className="flex items-start gap-2 text-xs text-slate-500">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
          <p className="text-xs leading-relaxed text-slate-500">
            <span className="font-semibold text-slate-700">Destination</span>
            <span className="text-slate-400"> • {tour.location || t('tourDetail.defaultLocation')}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <CalendarDays className="size-3.5 shrink-0 text-emerald-600" />
          <p className="text-xs leading-relaxed text-slate-500">
            <span className="font-semibold text-slate-700">Date</span>
            <span className="text-slate-400"> • {formatDayMonthYear(tour.selectedDate || tour.dateISO || '') || tour.date}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock className="size-3.5 shrink-0 text-emerald-600" />
          <span className="font-semibold text-slate-700">
            {tour.scheduleType === 'fixedTimeSlot' && tour.selectedTime
              ? 'Time'
              : tour.scheduleType === 'fixedTimeSlot' ? 'Time slots' : 'Opening hours'}
          </span>
          <span>
            {tour.scheduleType === 'fixedTimeSlot' && tour.selectedTime
              ? formatTime12h(tour.selectedTime)
              : tour.scheduleType === 'fixedTimeSlot'
                ? (formatTimeSlotList(tour.timeSlots) || scheduleTimeLabel(tour))
                : scheduleTimeLabel(tour)}
          </span>
        </div>
        {tour.duration && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock className="size-3.5 shrink-0 text-emerald-600" />
            <p className="text-xs leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-700">Duration</span>
              <span className="text-slate-400"> • {tour.duration}</span>
            </p>
          </div>
        )}
        {tour.travelers && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Users className="size-3.5 shrink-0 text-emerald-600" />
            <p className="text-xs leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-700">Travelers</span>
              <span className="text-slate-400"> • {tour.travelers}</span>
            </p>
          </div>
        )}
        {tour.language && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Globe className="size-3.5 shrink-0 text-emerald-600" />
            <p className="text-xs leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-700">Language</span>
              <span className="text-slate-400"> • {tour.language}</span>
            </p>
          </div>
        )}
        {tour.ticketValidity && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Ticket className="size-3.5 shrink-0 text-emerald-600" />
            <p className="text-xs leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-700">Ticket validity</span>
              <span className="text-slate-400"> • {normalizeTicketValidity(tour.ticketValidity)}</span>
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100/60 px-5 py-3">
        <span className="text-sm font-semibold text-slate-700">Total</span>
        <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{formatPrice(tour.price)}</span>
      </div>

      <div className="border-t border-slate-100/60 px-5 py-3">
        <button onClick={onChangeClick} className="text-sm font-semibold text-emerald-600 underline underline-offset-2 hover:text-emerald-700">
          Change
        </button>
      </div>

      <div className="border-t border-slate-100/60 px-5 py-3 space-y-3">
        <div className="flex items-start gap-2">
          <ShieldCheck className={`mt-0.5 size-4 shrink-0 ${cancellation && !cancellation.refundable ? 'text-rose-500' : 'text-emerald-600'}`} />
          <p className="text-xs leading-relaxed text-slate-500">
            <span className="font-semibold text-slate-700">Cancellation policy</span>
            {' • '}
            <span className={cancellation && !cancellation.refundable ? 'font-semibold text-rose-600' : ''}>
              {cancellation?.refundable === false
                ? `Non-refundable${cancellation.sublabel ? ` — ${cancellation.sublabel}` : ''}`
                : (cancellation?.label || 'Free cancellation')}
            </span>
          </p>
        </div>
        <div className="flex items-start gap-2">
          <CreditCard className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <p className="text-xs leading-relaxed text-slate-500">
            <span className="font-semibold text-slate-700">Reserve now, pay later</span>
            {' • '}
            <span>Book your spot and pay nothing today</span>
          </p>
        </div>
        <div className="flex items-start gap-2">
          <CalendarCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <p className="text-xs leading-relaxed text-slate-500">
            <span className="font-semibold text-slate-700">Book ahead</span>
            {' • '}
            <span>Reserve now to secure your preferred date and time</span>
          </p>
        </div>
      </div>
    </div>
  )
}

/* --- Sidebar (contact / pricing summary) --- */

function BookingSidebar({
  tour, promoCode, setPromoCode, onApplyPromo, promoLoading, promoError, appliedPromo, discount, finalPrice,
  contact, step,
}: {
  tour: typeof FALLBACK_TOUR
  promoCode: string
  setPromoCode: (v: string) => void
  onApplyPromo: () => void
  promoLoading: boolean
  promoError: string
  appliedPromo: { name: string; discountAmount: number } | null
  discount: number
  finalPrice: number
  contact: { firstName: string; lastName: string; email: string; countryCode: string; phone: string; location: string; pickupLater: boolean; pickupArea: string }
  step: number
}) {
  const { formatPrice } = useCurrency()
  const showPricing = step === 3

  return (
    <motion.div variants={itemVariants} className="space-y-4">
      {step > 2 && contact.firstName && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring' as const, stiffness: 100, damping: 20 }}
          className="rounded-[1.75rem] border border-slate-200/40 bg-white p-5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]"
        >
          <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">Lead Traveler Details</p>
          <div className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-800">{contact.firstName} {contact.lastName}</p>
              <p className="text-xs text-slate-400">{contact.email}</p>
              <p className="text-xs text-slate-400">{buildE164Phone(contact.countryCode, contact.phone) ?? contact.phone}</p>
              {contact.location && <p className="text-xs text-slate-400">{contact.location}</p>}
              {contact.pickupArea && !contact.location && <p className="text-xs text-slate-400">Pickup zone: {contact.pickupArea}</p>}
              {contact.pickupLater && !contact.location && (
                <p className="text-xs text-slate-400">Pickup location: to be chosen later</p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {showPricing && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring' as const, stiffness: 100, damping: 20 }}
          className="rounded-[1.75rem] border border-slate-200/40 bg-white p-5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]"
        >
          <p className="mb-3 text-sm font-semibold text-slate-800">Promo Code</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value.toUpperCase())
              }}
              placeholder="Enter promo code"
              className="flex-1 rounded-xl border border-slate-200/60 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <button
              onClick={onApplyPromo}
              disabled={promoLoading}
              className="rounded-full border border-slate-200/60 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-emerald-400 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {promoLoading ? 'Checking…' : 'Apply'}
            </button>
          </div>
          {promoError && <p className="mt-2 text-xs text-red-500">{promoError}</p>}
          {appliedPromo && !promoError && (
            <p className="mt-2 text-xs font-medium text-emerald-600">
              {appliedPromo.name} applied
              {appliedPromo.discountAmount > 0 && ` · you save ${formatPrice(appliedPromo.discountAmount)}`}
            </p>
          )}
        </motion.div>
      )}

      {showPricing && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring' as const, stiffness: 100, damping: 20 }}
          className="rounded-[1.75rem] border border-slate-200/40 bg-white p-5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">Total</span>
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{formatPrice(tour.price)}</span>
          </div>
          {discount > 0 && (
            <>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-emerald-600">{appliedPromo ? `${appliedPromo.name} discount` : 'Promo discount'}</span>
                <span className="font-semibold text-emerald-600">-{formatPrice(discount)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-dashed border-slate-200 pt-2">
                <span className="text-sm font-semibold text-slate-700">Final total</span>
                <span className="text-2xl font-extrabold text-emerald-600 tracking-tight">{formatPrice(finalPrice)}</span>
              </div>
            </>
          )}
        </motion.div>
      )}

      <motion.div variants={itemVariants} className="rounded-[1.75rem] border border-slate-200/40 bg-white p-5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
        <p className="text-sm font-bold text-slate-900">Need help?</p>
        <div className="mt-3 flex items-center gap-4 text-sm">
          <a href="tel:+18337642166" className="inline-flex items-center gap-1.5 font-medium text-slate-500 hover:text-emerald-600 transition-colors">
            <Phone className="size-4" /> +1 833 764 2166
          </a>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* --- Main Page --- */

const STORAGE_KEY = 'booking_draft'

const DEFAULT_CONTACT = { firstName: '', lastName: '', email: '', countryCode: '+233', phone: '', location: '', pickupLater: false, pickupLat: null as number | null, pickupLng: null as number | null, pickupArea: '' }
const DEFAULT_PAYMENT = { paymentTiming: 'now' as 'now' | 'later', paymentMethod: 'card' }

interface EditableTourState {
  date: string
  time: string
  travelers: string
  travelersCount: Record<string, number>
  adults: number
  children: number
  infants: number
  selectedDate: string
  selectedTime: string | null
  price: number
  /** Multi-option tours: the sellable option chosen for this booking. */
  optionId?: string | null
}

interface BookingDraftData {
  tour?: unknown
  tourId?: string
  contact?: Partial<typeof DEFAULT_CONTACT>
  editableTour?: EditableTourState
  step?: number
  payment?: Partial<typeof DEFAULT_PAYMENT>
}

function readBookingDraft(): BookingDraftData | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? (JSON.parse(saved) as BookingDraftData) : null
  } catch {
    return null
  }
}

// Default sellable option for a multi-option tour: the supplier's
// defaultOptionId when it is one of the sellable (non-private) options, else
// the first sellable option. Null on single-option tours so nothing ever
// sends an optionId there.
function resolveDefaultOptionId(options: TourOption[], defaultOptionId?: string | null): string | null {
  if (!Array.isArray(options)) return null
  const selectable = options.filter((o) => !o.isPrivate)
  if (selectable.length === 0) return null
  const def = defaultOptionId ?? null
  if (def && selectable.some((o) => o.id === def)) return def
  return selectable[0]?.id ?? null
}

function buildEditableTour(tour: typeof FALLBACK_TOUR): EditableTourState {
  const travelersCount =
    tour.travelersCount && typeof tour.travelersCount === 'object'
      ? (tour.travelersCount as Record<string, number>)
      : { adults: 1, children: 0, infants: 0 }
  return {
    date: String(tour.dateISO || tour.selectedDate || tour.date || ''),
    time: scheduleTimeLabel(tour),
    travelers: String(tour.travelers || '1 adult'),
    travelersCount,
    adults: Number(tour.adults) || 1,
    children: Number(tour.children) || 0,
    infants: Number(tour.infants) || 0,
    selectedDate: String(tour.selectedDate || tour.dateISO || ''),
    selectedTime: (tour.selectedTime as string | null | undefined) ?? null,
    price: Number(tour.price) || 0,
    optionId: resolveDefaultOptionId(tour.options || [], tour.defaultOptionId),
  }
}

export default function BookingPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { tourId: urlTourId } = useParams<{ tourId: string }>()

  // Read the persisted draft once so every piece of booking state can be
  // initialized synchronously from it. Restored data is therefore present from
  // the very first render — a refresh or the sign-in round-trip never starts
  // the form over from empty (no fragile mount-effect restore ordering).
  const draft = useMemo(() => readBookingDraft(), [])
  const freshTour = location.state?.tour

  // A partial router-state tour (e.g. the wishlist's Book Now hand-builds a
  // stub with no supplier meeting/pickup/schedule config) can't drive the
  // booking steps. Treat it like a direct-URL arrival: re-fetch the real tour
  // by its URL id and rebuild the full context from the detail. Only genuine
  // tour ids (backend cuids) are refetched — legacy mock/hash ids have no
  // server record and keep their offline stub.
  const freshTourPartial =
    freshTour != null && !('pickupIncluded' in (freshTour as Record<string, unknown>))
  const plausibleTourId =
    typeof urlTourId === 'string' && urlTourId.length > 0 && /^[A-Za-z0-9_-]{8,}$/.test(urlTourId)

  // The URL carries the tour id (/{tourId}/booking) so a refresh can rebuild
  // the booking context. The persisted draft is only trusted when it belongs
  // to THIS tour — matched against the URL id (refresh / back-from-checkout /
  // sign-in round-trip) or the arriving state tour's own id/slug (browser Back
  // restores that entry's router state, and checkout's back link may deep-link
  // with the slug instead of the id). A stale draft for another tour must
  // never bleed in.
  const freshTourId = freshTour ? String((freshTour as Record<string, unknown>).id || (freshTour as Record<string, unknown>).slug || '') : ''
  // The persisted draft stores the whole tour, so it can be matched against a
  // URL that carries the tour's id OR its slug — checkout's back links deep-link
  // with the slug ({slug}/booking) while the widget navigates with the id.
  const draftTour = (draft?.tour ?? null) as { id?: string; slug?: string } | null | undefined
  const matchesUrlTour =
    !!urlTourId &&
    Boolean(draft) &&
    (urlTourId === String(draft?.tourId ?? '') || urlTourId === draftTour?.id || urlTourId === draftTour?.slug)
  const matchesFreshTour = !!freshTour && Boolean(draft) && freshTourId !== '' && draft?.tourId === freshTourId
  const draftMatches = matchesUrlTour || matchesFreshTour

  // Restore the tour from router state when arriving fresh from a tour detail
  // page, otherwise fall back to the matching persisted draft (refresh /
  // sign-in round-trip). With neither — or with only a partial stub — re-fetch
  // the tour by its URL id so the booking context survives even when the draft
  // is missing or was cleared.
  const needFetch = ((freshTourPartial && plausibleTourId) || (!freshTour && !draftMatches)) && !!urlTourId
  const { data: fetchedTour, isLoading: tourLoading } = useExpeditionTour(needFetch ? urlTourId : undefined)

  const [tour, setTour] = useState(() => {
    if (!freshTourPartial) return freshTour || (draftMatches ? draft?.tour : FALLBACK_TOUR)
    // Partial stub with a refetchable id: hold the placeholder until the
    // by-id fetch rebuilds the full context. Stubs without a plausible id
    // (legacy mock content) stay on the stub itself — no fetch will run.
    return plausibleTourId ? FALLBACK_TOUR : (freshTour as typeof FALLBACK_TOUR)
  })

  // Restore the form fields whenever a draft exists for THIS tour — whether
  // arriving fresh from the tour page (a matching draft means the traveller
  // was mid-booking: returning from checkout or a previous attempt resumes
  // instead of wiping), or on a refresh / sign-in round-trip (no state tour).
  // Drafts for a different tour never restore.
  const canRestore = draftMatches

  const user = useAuthUser()

  // Meeting-point tours with a single sellable option have no meaningful first
  // step — the meeting info is static and nothing there is editable — so the
  // booking skips straight to Lead Traveler Details. Multi-option tours keep
  // step 1 because the "Choose your option" picker lives there.
  const skipMeetingStep =
    tour.meetingMode === 'meeting_point' &&
    (Array.isArray(tour.options) ? (tour.options as TourOption[]).filter((o) => !o.isPrivate).length : 0) <= 1

  const [step, setStep] = useState(() => {
    const restored =
      canRestore && typeof draft?.step === 'number' && draft.step >= 1 && draft.step <= 3 ? draft.step : 1
    // A restored draft parked on the skipped step resumes on Lead Traveler.
    return skipMeetingStep ? Math.max(restored, 2) : restored
  })
  const [attempted, setAttempted] = useState<Record<number, boolean>>({})
  // Prefill with a promo code validated on the tour detail page (the widget
  // passes it through router state); it is re-validated against the backend.
  const [promoCode, setPromoCode] = useState(() => String((freshTour as any)?.promoCode || ''))
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoError, setPromoError] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<{ name: string; discountAmount: number } | null>(null)
  const [discount, setDiscount] = useState(0)

  const [contact, setContact] = useState(() => {
    const restored = canRestore && draft?.contact
      ? { ...DEFAULT_CONTACT, ...draft.contact }
      : { ...DEFAULT_CONTACT }
    // Signed-in traveller: prefill the Lead Traveler email with the login
    // email, but only while the field is still empty — a draft email the user
    // typed (or a deliberate clearing) is never overwritten.
    if (!restored.email.trim() && user?.email) restored.email = user.email
    // Same rule for the name: split the profile's full name into first/last.
    if (!restored.firstName.trim() && !restored.lastName.trim() && user?.name) {
      const parts = user.name.trim().split(/\s+/)
      restored.firstName = parts[0] || ''
      restored.lastName = parts.slice(1).join(' ') || ''
    }
    return restored
  })

  // Signed-in traveller: prefill the phone from the saved profile once, only
  // while the field is still empty (a restored draft or typed value wins).
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    getAccount()
      .then((profile) => {
        if (cancelled || !profile.phone) return
        const split = splitE164Phone(profile.phone)
        if (!split) return
        setContact((prev) => (
          prev.phone.trim()
            ? prev
            : { ...prev, countryCode: split.countryCode, phone: split.nationalNumber }
        ))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.id])

  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false)
  const [editableTour, setEditableTour] = useState<EditableTourState>(() => {
    // When arriving with router-state tour context (fresh widget click, or
    // browser Back restoring that entry) the state tour already carries the
    // traveller's chosen date/time/party — building from it keeps the step
    // selections in sync with the arriving tour. The draft's editableTour is
    // only authoritative when there is no state tour (refresh / deep link).
    if (canRestore && draft?.editableTour && !freshTour) return draft.editableTour
    return buildEditableTour(tour)
  })
  const [payment, setPayment] = useState(() =>
    canRestore && draft?.payment ? { ...DEFAULT_PAYMENT, ...draft.payment } : DEFAULT_PAYMENT,
  )
  const [isBooking, setIsBooking] = useState(false)
  const [showCheckoutTransition, setShowCheckoutTransition] = useState(false)
  const pendingCheckoutUrl = useRef<string | null>(null)

  const [isActive, setIsActive] = useState(false)

  const [isExpired, setIsExpired] = useState(false)
  const [showExpiredModal, setShowExpiredModal] = useState(false)
  const [showSignInPrompt, setShowSignInPrompt] = useState(false)
  const [isCapturingLocation, setIsCapturingLocation] = useState(false)
  const lastActivityAt = useRef(0)

  // Refresh / direct-URL / partial-stub arrival: once the by-URL-id fetch
  // lands, rebuild the tour context (and its editable selection) from the
  // fetched detail so the page never sits on the "Loading..." placeholder.
  // React-recommended "adjust state during render" pattern — guarded so the
  // rebuild runs exactly once (setting the fetched tour's id flips the guard).
  if (needFetch && fetchedTour && !tour?.id) {
    const built = buildBookingTour(fetchedTour)
    setTour(built)
    setEditableTour(buildEditableTour(built))
  } else if (
    needFetch &&
    freshTourPartial &&
    !tourLoading &&
    !fetchedTour &&
    !tour?.id
  ) {
    // The by-id refetch failed (legacy/mock wishlist items have no backend
    // record): fall back to the partial stub so the item still books with the
    // data it carries — no supplier pickup config exists for it anyway.
    const stub = freshTour as typeof FALLBACK_TOUR
    setTour(stub)
    setEditableTour(buildEditableTour(stub))
  }

  // The real tour can arrive after the initial render (by-URL refetch). If it
  // turns out to be a skipped-step meeting-point tour while we're still on
  // step 1, advance to Lead Traveler Details (render-time adjust pattern).
  if (skipMeetingStep && step === 1) {
    setStep(2)
  }

  // Bring a restored later step into view (mount-only; no state changes).
  useEffect(() => {
    if (canRestore && step > 1) {
      requestAnimationFrame(() => {
        document.getElementById(`booking-step-${step}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Save draft to localStorage on field changes (also persists the tour on
     first arrival so a refresh / sign-in round-trip can restore it). */
  useEffect(() => {
    // While the placeholder tour is still being fetched for an unmatched URL,
    // never overwrite an existing draft with the placeholder + reset fields —
    // that would destroy the traveller's data before the real tour arrives.
    if (needFetch && !tour?.id) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        tour,
        tourId: tour.id || tour.slug,
        contact,
        editableTour,
        step,
        payment,
      }))
    } catch { /* ignore */ }
  }, [tour, contact, editableTour, step, payment, needFetch])

  const clearDraft = () => {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }

  /* Validation */
  // The pickup location option only renders for tours where pickup is included
  // (the supplier's Step-13 "pickup" mode or the pickupIncluded flag).
  // Meeting-point / self-guided tours ('meeting_point' or 'none') have
  // travellers make their own way, so the field is hidden there.
  const showPickupLocation = tour.meetingMode === 'pickup' || tour.pickupIncluded === true

  // Geoshape-aware pickup validation (mirrors the backend's geoUtils verdict):
  // once the supplier has drawn service zones, a typed address only counts
  // when it resolves inside a zone (or the traveller picks a named zone).
  // Legacy tours without drawn zones keep the old name-only rule.
  const zonesDrawn = useMemo(
    () => (tour.pickupAreas || []).some((a: PickupAreaShape) => !!a && Array.isArray(a.polygon) && a.polygon.length >= 3),
    [tour.pickupAreas],
  )
  const hasPointAreas = useMemo(
    () => hasLocationOnlyAreas(tour.pickupAreas || []),
    [tour.pickupAreas],
  )
  const pickupZoneStatusValue = useMemo(
    () =>
      showPickupLocation && !contact.pickupLater
        ? pickupZoneStatus({ name: contact.location, lat: contact.pickupLat, lng: contact.pickupLng }, tour.pickupAreas || [])
        : 'none',
    [showPickupLocation, contact.pickupLater, contact.location, contact.pickupLat, contact.pickupLng, tour.pickupAreas],
  )
  const noPickupConfig = showPickupLocation && (tour.pickupAreas || []).length === 0 && (tour.pickupLocations || []).length === 0
  // Single designated pickup point (address mode, one location): there is
  // nothing to choose — the section shows it read-only and auto-fills it — so
  // the step is always valid even before its coordinates resolve.
  const isSinglePoint = (tour.pickupLocations || []).length === 1 && (tour.pickupAreas || []).length === 0
  const pickupLocationValid = useMemo(
    () =>
      !showPickupLocation ||
      noPickupConfig ||
      isSinglePoint ||
      isPickupLocationSatisfied({
        pickupLater: contact.pickupLater,
        pickedArea: contact.pickupArea,
        typed: contact.location,
        status: pickupZoneStatusValue,
        zonesDrawn,
        hasLocationOnlyAreas: hasPointAreas,
      }),
    [showPickupLocation, noPickupConfig, isSinglePoint, contact.pickupLater, contact.pickupArea, contact.location, pickupZoneStatusValue, zonesDrawn, hasPointAreas],
  )

  const contactValid = useMemo(() => ({
    firstName: contact.firstName.trim().length > 1,
    lastName: contact.lastName.trim().length > 1,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email),
    phone: isValidPhoneInput(contact.countryCode, contact.phone),
    all: contact.firstName.trim().length > 1 && contact.lastName.trim().length > 1 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) && isValidPhoneInput(contact.countryCode, contact.phone),
  }), [contact])

  // The pickup location lives in the Meeting and Pickup Info step, so it's
  // validated here rather than in the Lead Traveler Details step. A pickup
  // location isn't required when the traveller opts to choose it later, or for
  // tours without pickup (meeting-point / self-guided).
  const locationValid = pickupLocationValid

  const trackActivity = () => { lastActivityAt.current = Date.now() }

  /* Multi-option tours (GYG parity) — the "Choose your option" picker lives on
     this details step (post-"Book now"), before lead traveler/payment. Only
     tours with >1 sellable (non-private) option show the picker; single-option
     tours stay untouched and never send an optionId. */
  const selectableOptions = useMemo(
    () => (Array.isArray(tour.options) ? (tour.options as TourOption[]).filter((o) => !o.isPrivate) : []),
    [tour.options],
  )
  const hasMultipleOptions = selectableOptions.length > 1
  const optionDefaultId = useMemo(
    () => (hasMultipleOptions ? resolveDefaultOptionId(selectableOptions, tour.defaultOptionId) : null),
    [hasMultipleOptions, selectableOptions, tour.defaultOptionId],
  )
  const selectedOptionId = useMemo(() => {
    if (!hasMultipleOptions) return null
    const stored = editableTour.optionId ?? null
    if (stored && selectableOptions.some((o) => o.id === stored)) return stored
    return optionDefaultId
  }, [hasMultipleOptions, selectableOptions, optionDefaultId, editableTour.optionId])

  const calculateOption = useCalculateCheckout()
  const [optionQuoting, setOptionQuoting] = useState(false)
  const [optionError, setOptionError] = useState('')

  // Re-quote against /travioghana/checkout/calculate whenever the traveller
  // switches option, so the totals stay live for the selected option. Quote
  // failures (e.g. the chosen date/time isn't offered by that option) roll the
  // switch back — another option's date/time or a stale price is never kept.
  const quoteOption = useCallback(async (optionId: string) => {
    const travelDate = editableTour.selectedDate || editableTour.date || ''
    const travelers = editableTour.travelersCount || { adults: 1, children: 0, infants: 0 }
    setOptionQuoting(true)
    setOptionError('')
    try {
      if (travelDate) {
        const res = await calculateOption.mutateAsync({
          tourId: tour.id || tour.slug,
          travelDate,
          travelers,
          ...(editableTour.selectedTime ? { selectedTime: editableTour.selectedTime } : {}),
          optionId,
        })
        if (!res?.available) {
          throw new Error('This option is not available on the selected date.')
        }
        setEditableTour((prev) => ({
          ...prev,
          optionId,
          price: Number(res?.pricing?.total) || prev.price,
        }))
        return
      }
      // No concrete date/time yet — record the option; the price is re-derived
      // once a date/traveler selection is made.
      setEditableTour((prev) => ({ ...prev, optionId }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not update the price for this option. Please try again.'
      setOptionError(msg)
      throw err
    } finally {
      setOptionQuoting(false)
    }
  }, [calculateOption, editableTour.selectedDate, editableTour.date, editableTour.selectedTime, editableTour.travelersCount, tour.id, tour.slug])

  const handleOptionChange = useCallback((optionId: string) => {
    trackActivity()
    if (!hasMultipleOptions) return
    if (optionId === selectedOptionId) return
    void quoteOption(optionId).catch(() => { /* handled inline via optionError */ })
  }, [hasMultipleOptions, selectedOptionId, quoteOption])

  const handleContactChange = (key: string, value: string | boolean | number | null) => {
    trackActivity()
    setContact((prev) => ({ ...prev, [key]: value }))
  }
  const handlePaymentChange = (key: string, value: string) => {
    trackActivity()
    setPayment((prev) => ({ ...prev, [key]: value }))
  }

  // Auto-capture user location for meeting point tours so the backend
  // receives travellers.location (required for all tours).
  useEffect(() => {
    if (tour.meetingMode !== 'meeting_point' || contact.location) return

    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsCapturingLocation(true)

    requestLocation().then((loc) => {
      if (!active || !loc) {
        if (active) setIsCapturingLocation(false)
        return
      }

      reverseGeocode(loc.lat, loc.lng).then((result) => {
        if (active) {
          const address = result?.formatted || `${loc.lat}, ${loc.lng}`
          handleContactChange('location', address)
          handleContactChange('pickupLat', loc.lat)
          handleContactChange('pickupLng', loc.lng)
          setIsCapturingLocation(false)
        }
      }).catch(() => {
        if (active) {
          handleContactChange('location', `${loc.lat}, ${loc.lng}`)
          handleContactChange('pickupLat', loc.lat)
          handleContactChange('pickupLng', loc.lng)
          setIsCapturingLocation(false)
        }
      })
    }).catch(() => {
      if (active) setIsCapturingLocation(false)
    })

    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour.meetingMode])

  const scrollToStep = (n: number) => {
    // Wait for the step-content swap (exit ~0.1s) to settle before scrolling,
    // so the section header lands at the top of the viewport — never cut off.
    setTimeout(() => {
      document.getElementById(`booking-step-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 220)
  }

  /* Clickable-step navigation with validation: jumping forward is only allowed
     when every preceding step is valid. If a previous step has errors, navigate
     to it instead, flag it and tell the user what's wrong. */
  const goToStep = (target: number) => {
    if (target < 1 || target > 3) return

    // Meeting-point tours with no editable step 1 never navigate back to it.
    const resolvedTarget = skipMeetingStep ? Math.max(target, 2) : target

    if (resolvedTarget > step) {
      // Step 1 (Pickup) must be valid before going to Step 2 (Contact)
      if (resolvedTarget >= 2 && !locationValid) {
        setAttempted((p) => ({ ...p, 1: true }))
        setStep(1)
        scrollToStep(1)
        return
      }
      // Step 2 (Contact) must be valid before going to Step 3 (Payment)
      if (resolvedTarget >= 3 && !contactValid.all) {
        setAttempted((p) => ({ ...p, 2: true }))
        setStep(2)
        scrollToStep(2)
        return
      }
    }

    setStep(resolvedTarget)
    if (resolvedTarget !== step) scrollToStep(resolvedTarget)
  }

  const contactHasError = !contactValid.all && attempted[2] === true
  const meetingHasError = !locationValid && attempted[1] === true

  const handleExpire = () => {
    setIsExpired(true)
    setShowExpiredModal(true)
  }

  const handleRehold = () => {
    lastActivityAt.current = Date.now()
    setIsExpired(false)
    setShowExpiredModal(false)
    trackActivity()
  }

  const handleSignInPrompt = () => {
    setShowSignInPrompt(false)
    setAuthReturnTo(location.pathname)
    navigate('/login')
  }

  const handleSaveAndLeave = () => {
    clearDraft()
    navigate('/')
  }

  const createBooking = useCreateBooking()

  // Poll the backend until the webhook reconciles the booking after the
  // server-side Stripe confirm. We do NOT optimistically show success: a
  // card that needs 3DS can still fail, and the webhook arrives async.
  // Reserve-now-pay-later reservations count as success once the booking is
  // committed (PENDING until the deferred charge is collected).
  const pollBooking = useCallback(async (bookingId: string) => {
    if (!bookingId) return
    setIsActive(true)
    const maxAttempts = 30
    try {
      for (let i = 0; i < maxAttempts; i++) {
        let booking: { status?: string; paymentStatus?: string; paymentTiming?: 'now' | 'later'; id: string } | null = null
        try {
          const res = await fetchWithAuth(`/travioghana/bookings/${encodeURIComponent(bookingId)}`)
          const payload = await res.json().catch(() => ({}))
          booking = payload.data?.booking ?? payload.data ?? null
        } catch (e: unknown) {
          if (e && typeof e === 'object' && 'status' in e && (e as { status?: number }).status === 404) {
            // Booking not yet committed on the read path — keep polling briefly.
            booking = null
          }
        }

        if (booking) {
          const { status, paymentStatus, paymentTiming } = booking
          // Success: paid, confirmed, OR a reserve-now-pay-later reservation
          // that's secured (status PENDING / paymentStatus PENDING until the
          // deferred charge lands).
          const payLaterReserved = paymentTiming === 'later' && status === 'PENDING' && paymentStatus === 'PENDING'
          if (paymentStatus === 'SUCCEEDED' || status === 'CONFIRMED' || payLaterReserved) {
            toast.success(payLaterReserved ? 'Reservation confirmed!' : 'Booking confirmed!')
            clearDraft()
            queryClient.invalidateQueries({ queryKey: ['expedition', 'bookings'] })
            navigate(`/booking/confirmation/${encodeURIComponent(booking.id)}`)
            return
          }
          if (paymentStatus === 'FAILED' || status === 'CANCELLED') {
            toast.error('Your booking could not be confirmed — your card was not charged.')
            return
          }
        }

        await new Promise((r) => setTimeout(r, 2000))
      }

      // Webhook still hasn't landed — tell the user it's still processing (not
      // a success) and let the backend's stale-PENDING cleanup reconcile later.
      console.warn('[Booking] polling timed out; booking still settling. Backend cleanup will reconcile.')
      toast.info('Your booking is still being processed. We\'ll email you confirmation shortly — you can also check your bookings page.')
    } finally {
      setIsActive(false)
    }
  }, [navigate, queryClient])

  const handleBook = useCallback(async (paymentMethodId: string | undefined, timing?: 'now' | 'later') => {
    if (isBooking || isActive) return
    if (!user) {
      setShowSignInPrompt(true)
      return
    }
    const paymentTiming = timing ?? payment.paymentTiming ?? 'now'
    if (paymentTiming === 'later' && !paymentMethodId) {
      toast.error('Please enter your card details to continue.')
      return
    }

    setIsBooking(true)
    try {
      // Lead traveler's phone (Lead Traveler Details step) is the booking
      // contact for pickup and last-minute updates.
      const phoneNumber = buildE164Phone(contact.countryCode, contact.phone)
      if (!phoneNumber) {
        toast.error('Please enter a valid international phone number, e.g. +233 24 123 4567.')
        return
      }
      const fullName = `${contact.firstName} ${contact.lastName}`.trim()
      const detailsName = fullName || undefined
      const details = detailsName ? [{ name: detailsName, ageGroup: 'adult' }] : []

      // Authoritative per-category map (adults/children/infants + any supplier
      // categories like seniors/students) so every category is priced at its
      // own rate on confirm.
      const counts: Record<string, number> = editableTour.travelersCount || { adults: 1, children: 0, infants: 0 }

      // Resolved pickup selection, validated and snapshotted server-side by
      // confirmBooking (resolvePickupSelection). A named zone is sent when the
      // traveller picked one of the supplier's zones; otherwise the
      // autocomplete-resolved address + coordinates (coords stay out of the
      // legacy travelers payload on purpose).
      const hasPickupAddress = contact.pickupLat != null && contact.pickupLng != null && contact.location.trim().length > 0
      // An out-of-zone address is allowed: skip server geofencing so the
      // booking succeeds, while the stored address still reaches the supplier
      // (the traveller was cautioned to pick an in-zone location).
      const pickupOutOfZone = pickupZoneStatusValue === 'outside'
      const pickupSelection = contact.pickupLater
        ? { skipValidation: true }
        : showPickupLocation && (contact.pickupArea || hasPickupAddress)
          ? {
              // Any pickup areas (drawn geoshapes or location-only) mean the
              // server validates in area mode — never the location-list mode.
              mode: zonesDrawn || hasPointAreas ? 'area' : tour.pickupType || 'area',
              ...(pickupOutOfZone ? { skipValidation: true } : {}),
              ...(!hasPickupAddress && contact.pickupArea ? { areaName: contact.pickupArea } : {}),
              ...(hasPickupAddress
                ? { address: { name: contact.location.trim(), address: contact.location.trim(), lat: contact.pickupLat, lng: contact.pickupLng } }
                : {}),
            }
          : undefined

      const payload = {
        tourId: tour.id || tour.slug,
        travelDate: editableTour.selectedDate || editableTour.date,
        ...(editableTour.selectedTime ? { selectedTime: editableTour.selectedTime } : {}),
        // Multi-option tours only: the "Choose your option" picker's selection.
        // Single-option tours never send an optionId (legacy behavior).
        ...(hasMultipleOptions && selectedOptionId ? { optionId: selectedOptionId } : {}),
        ...(pickupSelection ? { pickup: pickupSelection } : {}),
        travelers: {
          ...counts,
          phoneNumber,
          // Only send a pickup location when one was collected (pickup-mode
          // tours); meeting-point tours leave it out entirely.
          ...(contact.location.trim() ? { location: contact.location.trim() } : {}),
          details,
        },
        ...(paymentMethodId ? { paymentMethodId } : {}),
        paymentTiming,
        // Pay-now uses the branded Payment Element checkout (the server mints
        // the PaymentIntent; the amount is never trusted from the browser).
        ...(paymentTiming === 'now' ? { checkoutFlow: 'payment-element' as const } : {}),
        specialRequests: '',
        // Lead traveler details from the "Lead Traveler Details" step so the
        // supplier dashboard and confirmation emails show the traveler rather
        // than the booking-owner account.
        leadTraveler: {
          name: fullName,
          email: contact.email,
          phone: phoneNumber,
        },
        // Only forward a code that was validated against the backend; the
        // confirm endpoint re-prices authoritatively with it.
        ...(appliedPromo ? { promoCode: promoCode.trim().toUpperCase() } : {}),
      }

      const result = await createBooking.mutateAsync(payload)

      // Pay now (branded Payment Element): the backend minted an unconfirmed
      // PaymentIntent for the reserved spot. Continue on our own checkout page —
      // success is settled ONLY by the payment_intent.succeeded webhook, and the
      // confirmation page polls the by-session endpoint until it lands.
      if (result?.payment?.clientSecret) {
        pendingCheckoutUrl.current = `/booking/checkout?draft=${encodeURIComponent(result.payment.draftId)}`
        setShowCheckoutTransition(true)
        return
      }

      // Legacy pay-now: hosted Stripe Checkout URL (kept for other storefronts).
      if (result?.checkout?.url) {
        window.location.assign(result.checkout.url)
        return
      }

      // Reserve-now-pay-later: booking is committed PENDING until the deferred
      // auto-charge (payLaterSweep) settles it near the activity date.
      if (result?.booking?.id) {
        await pollBooking(result.booking.id)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Booking failed. Please try again.'
      toast.error(msg)
    } finally {
      setIsBooking(false)
    }
  }, [createBooking, contact, editableTour, tour, showPickupLocation, zonesDrawn, hasPointAreas, pickupZoneStatusValue, isBooking, isActive, pollBooking, user, payment.paymentTiming, appliedPromo, promoCode, hasMultipleOptions, selectedOptionId])

  const handleCheckoutTransitionDone = useCallback(() => {
    if (pendingCheckoutUrl.current) {
      navigate(pendingCheckoutUrl.current)
      pendingCheckoutUrl.current = null
    }
  }, [navigate])

  const handleApplyPromo = useCallback(async () => {
    const code = promoCode.trim().toUpperCase()
    if (!code) return
    if (code.length < 3) {
      setPromoError('Promo code must be at least 3 characters')
      return
    }
    const selectedDate = editableTour.selectedDate || editableTour.date
    if (!selectedDate) {
      setPromoError('Select a date first to validate the code')
      return
    }
    // A promo can never be applied on a day the tour doesn't run.
    if (!isSupplierOperatingDay(editableTour as TourScheduleInfo, new Date(`${selectedDate}T00:00:00`))) {
      setPromoError('This tour does not run on the selected date')
      return
    }
    setPromoLoading(true)
    setPromoError('')
    try {
      // Real validation against the backend special-offer engine — the same
      // endpoint the tour detail widget uses (POST /tours/offers/validate-promo).
      const quantity = Object.values(editableTour.travelersCount || {}).reduce(
        (sum, n) => sum + (typeof n === 'number' ? n : 0), 0,
      )
      const res = await fetchWithAuth('/tours/offers/validate-promo', {
        method: 'POST',
        body: JSON.stringify({
          promoCode: code,
          tourId: tour.id || tour.slug,
          travelDate: selectedDate,
          quantity: Math.max(quantity, 1),
          ...(tour.price != null && Number.isFinite(tour.price) ? { basePrice: tour.price } : {}),
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.message || `Promo validation failed (${res.status})`)
      }
      const data = payload.data ?? payload
      if (!data.valid) {
        setDiscount(0)
        setAppliedPromo(null)
        setPromoError(data.message || 'This promo code is not valid for this tour and date')
        return
      }
      setDiscount(Math.min(Number(data.discount?.amount) || 0, editableTour.price))
      setAppliedPromo({
        name: data.offer?.name || code,
        discountAmount: Number(data.discount?.amount) || 0,
      })
      setPromoError('')
      toast.success('Promo code applied')
    } catch (err) {
      setDiscount(0)
      setAppliedPromo(null)
      setPromoError(err instanceof Error ? err.message : 'This promo code is not valid for this tour and date')
    } finally {
      setPromoLoading(false)
    }
  }, [promoCode, editableTour, tour.id, tour.slug])

  // A promo code carried over from the tour detail widget is auto-validated
  // once on arrival so the sidebar shows the discount the widget quoted.
  // Deferred off the synchronous effect body so the validation's setState
  // calls never cascade from within the effect itself.
  const autoPromoRef = useRef(false)
  useEffect(() => {
    if (autoPromoRef.current) return
    if ((freshTour as any)?.promoCode) {
      autoPromoRef.current = true
      const timer = setTimeout(() => {
        handleApplyPromo()
      }, 0)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finalPrice = editableTour.price - discount
  const activeTour = useMemo(
    () => ({ ...tour, ...editableTour, price: finalPrice }),
    [tour, editableTour, finalPrice],
  )

  // Refresh / direct-URL arrival with no usable draft (or only a partial
  // router-state stub): show a spinner while the tour is re-fetched by the
  // URL id, instead of a broken "Loading..." placeholder or a stub that hides
  // the supplier's pickup configuration.
  if (needFetch && tourLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white">
        <Loader2 className="size-8 animate-spin text-emerald-600" />
        <p className="mt-3 text-sm font-medium text-slate-500">Loading tour…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="relative mx-auto flex w-full max-w-[1200px] items-center justify-center px-4 pt-5 sm:justify-between sm:px-6 lg:px-8">
        <motion.button
          onClick={() => navigate(-1)}
          whileTap={{ scale: 0.97 }}
          aria-label="Back"
          className="absolute left-4 top-1/2 -translate-y-1/2 inline-flex size-10 items-center justify-center rounded-full border border-slate-200/60 bg-white text-slate-400 shadow-sm transition hover:border-emerald-200 hover:text-emerald-600 sm:hidden"
        >
          <ArrowLeft className="size-4" />
        </motion.button>
        <a href="/" className="inline-flex items-center gap-2">
          <img src={logoSrc} alt="Travio Ghana" className="h-[30px] w-auto sm:h-[38px]" />
        </a>
      </div>

      <main className="flex-1">
        <div className="mx-auto max-w-[1200px] px-4 pb-20 pt-1 sm:px-6 lg:px-8">
          <motion.button
            onClick={() => navigate(-1)}
            whileTap={{ scale: 0.97 }}
            aria-label="Back"
            className="mb-2 hidden size-10 items-center justify-center rounded-full border border-slate-200/60 bg-white text-slate-400 shadow-sm transition hover:border-emerald-200 hover:text-emerald-600 sm:inline-flex"
          >
            <ArrowLeft className="size-4" />
          </motion.button>

          <div className="rounded-[2.5rem] bg-[#f9fafb] p-4 sm:p-6 lg:p-8">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="mb-6 bg-[#f9fafb] pt-4 md:hidden">
              <HoldTimer onExpire={handleExpire} lastActivityAt={lastActivityAt} isExpired={isExpired} />
            </div>

            <div className="grid gap-8 md:grid-cols-[1fr_380px]">
              <div className="min-w-0 space-y-6">
                {/* On mobile the tour card leads, then the form follows. */}
                <div className="md:hidden">
                  <BookingTourCard tour={activeTour} onChangeClick={() => setIsChangeModalOpen(true)} />
                </div>
                <ActivityDetailsStep
                  tour={activeTour}
                  onNext={() => goToStep(2)}
                  step={step}
                  onNavigate={goToStep}
                  hasError={meetingHasError}
                  disabled={isExpired}
                  contact={{ location: contact.location, pickupLater: contact.pickupLater, pickupLat: contact.pickupLat, pickupLng: contact.pickupLng, pickupArea: contact.pickupArea }}
                  onContactChange={handleContactChange}
                  showPickupLocation={showPickupLocation}
                  locationValid={locationValid}
                  isCapturingLocation={isCapturingLocation}
                  options={hasMultipleOptions ? selectableOptions : undefined}
                  optionValue={selectedOptionId}
                  onOptionChange={handleOptionChange}
                  optionQuoting={optionQuoting}
                  optionError={optionError}
                  staticInfo={skipMeetingStep}
                />
                <ContactDetailsStep
                  tour={activeTour}
                  data={contact}
                  onChange={handleContactChange}
                  onNext={() => goToStep(3)}
                  valid={contactValid}
                  step={step}
                  onNavigate={goToStep}
                  hasError={contactHasError}
                  disabled={isExpired}
                />
                <PaymentDetailsStep
                  data={payment}
                  onChange={handlePaymentChange}
                  tour={activeTour}
                  onBook={handleBook}
                  step={step}
                  onNavigate={scrollToStep}
                  disabled={isExpired}
                  isBooking={isBooking}
                />
              </div>

              <aside className="md:sticky md:top-28 md:self-start">
                <div className="space-y-4">
                  <div className="hidden md:block">
                    <HoldTimer onExpire={handleExpire} lastActivityAt={lastActivityAt} isExpired={isExpired} />
                  </div>
                  <div className="hidden md:block">
                    <BookingTourCard tour={activeTour} onChangeClick={() => setIsChangeModalOpen(true)} />
                  </div>
                  <BookingSidebar
                    tour={activeTour}
                    promoCode={promoCode}
                    setPromoCode={(v) => {
                      // Editing the code releases the previously applied
                      // discount until the new code is validated.
                      setPromoCode(v)
                      setDiscount(0)
                      setAppliedPromo(null)
                      setPromoError('')
                    }}
                    onApplyPromo={handleApplyPromo}
                    promoLoading={promoLoading}
                    promoError={promoError}
                    appliedPromo={appliedPromo}
                    discount={discount}
                    finalPrice={finalPrice}
                    contact={{ firstName: contact.firstName, lastName: contact.lastName, email: contact.email, countryCode: contact.countryCode, phone: contact.phone, location: contact.location, pickupLater: contact.pickupLater, pickupArea: contact.pickupArea }}
                    step={step}
                  />
                </div>
              </aside>
            </div>
          </motion.div>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {isChangeModalOpen && (
          <ChangeBookingModal
            tour={activeTour}
            isOpen={isChangeModalOpen}
            onClose={() => setIsChangeModalOpen(false)}
            initialTravelers={(activeTour.adults || 0) + (activeTour.children || 0) + (activeTour.infants || 0)}
            initialDate={editableTour.selectedDate || ''}
            travelersCount={editableTour.travelersCount}
            optionId={selectedOptionId}
            onReserve={(updates) => setEditableTour((prev) => {
              // The modal prices a specific travellers mix; use that exact
              // payload so the displayed total matches what gets confirmed.
              const payload = updates.travelersPayload ?? { ...(prev.travelersCount || {}), adults: updates.travelersCount || 1 }
              return {
                ...prev,
                ...updates,
                travelersCount: payload,
                adults: typeof payload.adults === 'number' ? payload.adults : (prev.adults || 0),
                children: typeof payload.children === 'number' ? payload.children : (prev.children || 0),
                infants: typeof payload.infants === 'number' ? payload.infants : (prev.infants || 0),
                price: updates.price,
              }
            })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExpiredModal && (
          <ExpiredHoldModal
            contact={contact}
            onRehold={handleRehold}
            onSaveAndLeave={handleSaveAndLeave}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSignInPrompt && (
          <SignInPromptModal
            onSignIn={handleSignInPrompt}
            onClose={() => setShowSignInPrompt(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCheckoutTransition && (
          <BookingTransition
            onDone={handleCheckoutTransitionDone}
            animationSrc="/animations/vintage-car.lottie"
            caption="Redirecting to checkout"
          />
        )}
      </AnimatePresence>

      <Footer />
    </div>
  )
}
