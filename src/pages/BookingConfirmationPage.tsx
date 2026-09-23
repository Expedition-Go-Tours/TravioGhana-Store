import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import confetti from 'canvas-confetti'
import { Check, CalendarDays, Clock, Users, MapPin, CreditCard, ShieldCheck, Phone, Mail, Printer, Star, Ticket, Globe, AlertTriangle, Loader2 } from 'lucide-react'
import { useExpeditionBookingDetail, useBookingBySession } from '../hooks/useExpeditionBookings'
import { extractMeetingInfo, extractAvailabilitySchedule, formatCancellationPolicy, formatDuration } from '../hooks/useExpeditionTours'
import { buildE164Phone, isValidPhoneInput } from '../lib/phone'
import { formatTime12h, weeklyHoursRange, openingHoursForDay, formatTimeSlotList } from '../lib/tourAvailability'
import { useAuthUser } from '../hooks/useAuthUser'
import { evaluateCancellationPolicy } from '../lib/bookingUi'
import { currencySymbol } from '../lib/currencySymbol'
import OptimizedImage from '@/components/shared/OptimizedImage'
import ConfirmationSections from '../components/booking/ConfirmationSections'
import AddToCalendar from '../components/booking/AddToCalendar'
import './BookingConfirmationPage.css'

interface TravelerRecord {
  adults?: number
  children?: number
  infants?: number
  phoneNumber?: string
  location?: string
  details?: { name?: string; ageGroup?: string; specialRequests?: string }[]
  [key: string]: unknown
}

interface ConfirmationTour {
  id?: string
  slug?: string
  title?: string
  description?: string | null
  coverPhoto?: string | null
  photos?: string[]
  durationMinutes?: number | null
  city?: string | null
  country?: string | null
  productContent?: unknown
  bookingAndTickets?: unknown
  schedulesAndPricing?: unknown
  cancellationPolicy?: unknown
  supplier?: { id?: string; name?: string | null; photoURL?: string | null; phone?: string | null; email?: string | null }
}

interface ConfirmationBooking {
  id?: string
  bookingNumber?: string
  status?: string
  paymentStatus?: string
  paymentTiming?: 'now' | 'later'
  travelDate?: string
  selectedTime?: string | null
  travelers?: TravelerRecord
  subtotal?: number | string
  taxes?: number | string
  fees?: number | string
  discounts?: number | string
  grossAmount?: number | string
  currency?: string
  specialRequests?: string | null
  paidAt?: string | null
  createdAt?: string
  tour?: ConfirmationTour
  /** Resolved pickup selection snapshotted at booking time (server-validated). */
  pickup?: {
    status?: 'deferred' | 'selected' | 'confirmed'
    mode?: string
    pickupLater?: boolean
    skipValidation?: boolean
    areaName?: string
    locationName?: string
    place?: string
    address?: { name?: string; address?: string } | null
    time?: string
    instructions?: string
    lat?: number | null
    lng?: number | null
  } | null
}

function formatDate(value?: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

const num = (v?: number | string | null): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export default function BookingConfirmationPage() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const navigate = useNavigate()
  const { t } = useTranslation()
  const user = useAuthUser()

  // Pay-now: poll by session id (no Booking exists yet).
  // Pay-later / legacy: poll by booking id (Booking exists immediately).
  const sessionQuery = useBookingBySession(sessionId)
  const bookingQuery = useExpeditionBookingDetail(bookingId)
  const queryClient = useQueryClient()

  // Decide which data source to use.
  const isSessionMode = !!sessionId
  const sessionData = sessionQuery.data as { status?: string; booking?: { id: string; [k: string]: unknown } } | undefined
  const sessionStatus = sessionData?.status
  const sessionBooking = sessionData?.booking

  const booking = isSessionMode ? sessionBooking ?? null : bookingQuery.data ?? null
  const isLoading = isSessionMode ? sessionQuery.isLoading : bookingQuery.isLoading
  const isError = isSessionMode ? sessionQuery.isError : bookingQuery.isError
  const refetch = isSessionMode ? sessionQuery.refetch : bookingQuery.refetch

  // ── Session mode: redirect to confirmation once materialized ────────
  // Move to the canonical /booking/confirmation/:bookingId URL (replace keeps
  // history clean). Seed the booking-detail cache with the session payload so
  // the receipt renders instantly with no loading flash — the query then
  // refetches in the background and reconciles the full record.
  const navigatedToBookingRef = useRef(false)
  useEffect(() => {
    const materializedId = sessionBooking?.id
    if (isSessionMode && materializedId && !navigatedToBookingRef.current) {
      navigatedToBookingRef.current = true
      queryClient.setQueryData(['expedition', 'bookings', materializedId, 'detail'], sessionBooking)
      navigate(`/booking/confirmation/${materializedId}`, { replace: true })
    }
  }, [isSessionMode, sessionBooking?.id, queryClient, navigate])

  // ── Session mode: stop polling once terminal ────────────────────────
  const sessionPollStoppedRef = useRef(false)
  useEffect(() => {
    if (isSessionMode && (sessionStatus === 'EXPIRED' || sessionStatus === 'REFUNDED') && !sessionPollStoppedRef.current) {
      sessionPollStoppedRef.current = true
    }
  }, [isSessionMode, sessionStatus])

  // ── Legacy mode: poll PENDING pay-now bookings (shouldn't happen with
  //    the new hold-based flow, but kept for backwards compat). ──────────
  const [pollStopped, setPollStopped] = useState(false)
  const confirmingPayment =
    !isSessionMode &&
    !!booking &&
    booking.status === 'PENDING' &&
    booking.paymentStatus === 'PENDING' &&
    booking.paymentTiming !== 'later' &&
    !pollStopped

  useEffect(() => {
    if (!confirmingPayment) return
    let attempts = 0
    const timer = setInterval(() => {
      attempts += 1
      if (attempts > 15) {
        clearInterval(timer)
        setPollStopped(true)
        return
      }
      void refetch()
    }, 2000)
    return () => clearInterval(timer)
  }, [confirmingPayment, refetch])

  const meeting = useMemo(() => extractMeetingInfo(booking?.tour ?? {}), [booking])
  const schedule = useMemo(() => extractAvailabilitySchedule(booking?.tour ?? {}), [booking])

  const cancellationDeadline = useMemo(() => {
    const bt = booking?.tour?.bookingAndTickets
    const travelDate = booking?.travelDate
    if (!bt || !travelDate) return null
    const verdict = evaluateCancellationPolicy(bt, travelDate)
    return verdict.deadline
  }, [booking?.tour?.bookingAndTickets, booking?.travelDate])

  // Fire confetti when a confirmed booking loads
  const confettiFiredRef = useRef(false)
  useEffect(() => {
    if (confettiFiredRef.current) return
    if (!booking) return
    const b = booking as ConfirmationBooking
    const isPaid = b.paymentStatus === 'SUCCEEDED'
    if (!isPaid) return
    confettiFiredRef.current = true

    const defaults = { startVelocity: 30, spread: 360, ticks: 80, zIndex: 99999 }
    const end = Date.now() + 3000

    const frame = () => {
      confetti({
        ...defaults,
        particleCount: 3,
        origin: { x: Math.random(), y: 0 },
        colors: ['#166534', '#22c55e', '#facc15', '#60a5fa', '#f472b6'],
      })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }, [booking])

  if (!user) {
    return (
      <div className="confirmation-page">
        <div className="confirmation-card">
          <p className="confirmation-message">{t('confirmation.signInRequired')}</p>
          <div className="confirmation-actions">
            <button className="confirmation-btn-primary" onClick={() => navigate('/login')}>
              {t('confirmation.signIn')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="confirmation-page">
        <div className="confirmation-card">
          <p className="confirmation-message">{t('confirmation.loading')}</p>
        </div>
      </div>
    )
  }

  // ── Session mode: terminal failure states (no booking will ever appear) ──
  const sessionTerminal = isSessionMode && (sessionStatus === 'EXPIRED' || sessionStatus === 'REFUNDED')
  const isRefunded = sessionStatus === 'REFUNDED'
  if (sessionTerminal) {
    return (
      <div className="confirmation-page">
        <div className="confirmation-card">
          <div className={`confirmation-icon ${isRefunded ? 'warning' : 'error'}`}>
            {isRefunded ? <AlertTriangle className="size-10" /> : <span className="text-3xl">⏰</span>}
          </div>
          <h2 className="confirmation-title">
            {isRefunded ? t('confirmation.refundedTitle') : t('confirmation.expiredTitle')}
          </h2>
          <p className="confirmation-message">
            {isRefunded ? t('confirmation.refundedBody') : t('confirmation.expiredBody')}
          </p>
          <div className="confirmation-actions">
            <button className="confirmation-btn-primary" onClick={() => navigate('/')}>
              {t('confirmation.backToHome')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Session mode: payment not yet materialized (HOLDING / PAID w/o booking).
  //    Rendered regardless of poll in-flight state so the customer never sees a
  //    misleading "expired / no money charged" message while the webhook lands.
  const sessionProcessing = isSessionMode && !sessionBooking && sessionStatus !== undefined
  if (sessionProcessing) {
    return (
      <div className="confirmation-page">
        <div className="confirmation-card confirmation-card-processing">
          <div className="confirmation-icon processing">
            <Loader2 className="size-10 confirmation-spinner" />
          </div>
          <h2 className="confirmation-title">{t('confirmation.processingTitle')}</h2>
          <p className="confirmation-message">{t('confirmation.processingBody')}</p>
          <div className="confirmation-actions">
            <button className="confirmation-btn-primary" onClick={() => navigate('/dashboard/bookings')}>
              {t('confirmation.viewBookings')}
            </button>
            <button className="confirmation-btn-secondary" onClick={() => navigate('/')}>
              {t('confirmation.backToHome')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isError || !booking) {
    return (
      <div className="confirmation-page">
        <div className="confirmation-card">
          <p className="confirmation-message">{t('confirmation.notFound')}</p>
          <div className="confirmation-actions">
            <button className="confirmation-btn-primary" onClick={() => navigate('/')}>
              {t('confirmation.backToHome')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const b = booking as ConfirmationBooking
  const tour = b.tour ?? {}
  const travelers = b.travelers ?? {}
  const image = tour.coverPhoto || tour.photos?.[0] || ''
  const location = [tour.city, tour.country].filter(Boolean).join(', ')

  // Paid only when payment actually settled. Reserve-now-pay-later bookings are
  // PENDING/unpaid until the deferred charge lands, so they show as "Reserved".
  // A PAID booking still PENDING (manual-confirmation tour) is awaiting the
  // supplier's acceptance — show that instead of "Confirmed".
  const isPaid = b.paymentStatus === 'SUCCEEDED'
  const awaitingConfirmation = isPaid && b.status === 'PENDING'
  const statusLabel = awaitingConfirmation
    ? t('confirmation.statusAwaiting')
    : isPaid
      ? t('confirmation.statusConfirmed')
      : t('confirmation.statusReserved')

  const arrivalLabel = (() => {
    if (meeting.meetingMode !== 'meeting_point') return ''
    if (meeting.arrivalTimeType === 'custom') {
      return meeting.arrivalTimeCustom ? t('tourDetail.arriveBy', { time: meeting.arrivalTimeCustom }) : ''
    }
    switch (meeting.arrivalTimeType) {
      case '5min': return t('tourDetail.arriveBefore', { minutes: 5 })
      case '10min': return t('tourDetail.arriveBefore', { minutes: 10 })
      case '15min': return t('tourDetail.arriveBefore', { minutes: 15 })
      case '30min': return t('tourDetail.arriveBefore', { minutes: 30 })
      case 'notified': return t('tourDetail.arrivalTimeNotified')
      default: return ''
    }
  })()

  const timeLabel = (() => {
    if (b.selectedTime) return formatTime12h(b.selectedTime)
    if (schedule.scheduleType === 'operatingHours') {
      const day = b.travelDate ? openingHoursForDay(schedule, new Date(b.travelDate)) : ''
      if (day) return day
      const range = weeklyHoursRange(schedule)
      if (range) return range
    }
    if (schedule.timeSlots.length > 0) return formatTimeSlotList(schedule.timeSlots)
    return t('confirmation.flexible')
  })()

  const travelerCounts: { label: string; count: number }[] = []
  for (const [key, val] of Object.entries(travelers)) {
    if (['phoneNumber', 'location', 'details'].includes(key)) continue
    if (typeof val === 'number' && val > 0) {
      travelerCounts.push({ label: key.charAt(0).toUpperCase() + key.slice(1), count: val })
    }
  }
  const travelerTotal = travelerCounts.reduce((s, c) => s + c.count, 0)

  const leadName = travelers.details?.[0]?.name
  const phoneNumber = isValidPhoneInput('+', travelers.phoneNumber || '')
    ? travelers.phoneNumber
    : (buildE164Phone('+', travelers.phoneNumber || '') ?? travelers.phoneNumber)

  const bt = (tour.bookingAndTickets ?? {}) as { cancellationPolicy?: unknown; meetingPoint?: unknown }
  const cancellation = (() => {
    const rawPolicy = bt.cancellationPolicy ?? tour.cancellationPolicy ?? null
    return formatCancellationPolicy(rawPolicy) || t('confirmation.cancellationDefault')
  })()

  const hasMeeting = meeting.meetingMode === 'meeting_point' && (meeting.meetingPoint || meeting.meetingPointAddress || arrivalLabel)
  const pickupAreas = (meeting.pickupAreas || []).filter((a: { name?: string; address?: string }) => a && (a.name || a.address))
  const pickupLocations = (meeting.pickupLocations || []).filter((l: { name?: string; address?: string }) => l && (l.name || l.address))
  const hasPickup = meeting.meetingMode === 'pickup' && (pickupAreas.length > 0 || pickupLocations.length > 0 || meeting.pickupDescription)

  // Review routing prefers the tour's canonical slug (matches the rest of the
  // app); fall back to a title-derived slug for legacy records without one.
  const reviewSlug = tour.title
    ? tour.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    : ''
  const effectiveReviewSlug = tour.slug || reviewSlug

  return (
    <div className="confirmation-page">
      <div className="confirmation-print-area">
        {/* Header — typographic confirmation (GYG-style) */}
        <div className="confirmation-card confirmation-card-hero">
          <div className="confirmation-hero">
            <div className="confirmation-hero-kicker">
              <span className={`confirmation-status-pill${isPaid ? ' is-confirmed' : ' is-reserved'}`}>
                <Check size={13} strokeWidth={3} />
                {statusLabel}
              </span>
            </div>
            <h1 className="confirmation-title">{t('confirmation.title')}</h1>
            <p className="confirmation-subtitle">{t('confirmation.subtitle')}</p>

            <ul className="confirmation-hero-facts">
              {user?.email && (
                <li>
                  <Mail size={14} />
                  <span>
                    {t('confirmation.emailSentTo')} <strong>{user.email}</strong>
                  </span>
                </li>
              )}
              <li>
                <Ticket size={14} />
                <span>
                  {t('confirmation.bookingReference')}: <span className="confirmation-ref">{b.bookingNumber}</span>
                </span>
              </li>
            </ul>

            {awaitingConfirmation && (
              <p className="confirmation-note confirmation-awaiting-note">
                {t('confirmation.awaitingConfirmation')}
              </p>
            )}
            {confirmingPayment && (
              <p className="confirmation-note confirmation-pending-note">
                {t('confirmation.confirmingPayment')}
              </p>
            )}

            <div className="confirmation-hero-actions">
              <AddToCalendar
                title={tour.title || ''}
                date={booking?.travelDate}
                time={booking?.selectedTime}
                location={location}
              />
            </div>
          </div>
        </div>

        <div className="confirmation-body">
          <div className="confirmation-main">
        {/* Tour card */}
        <div className="confirmation-card confirmation-tour-card">
          <div className="confirmation-tour">
            {image && (
              <div className="confirmation-tour-image">
                <OptimizedImage src={image} alt={tour.title || ''} width={900} />
              </div>
            )}
            <div className="confirmation-tour-info">
              <h2 className="confirmation-tour-title">{tour.title}</h2>
              {tour.description ? (
                <p className="confirmation-tour-desc">
                  {tour.description.length > 170
                    ? `${tour.description.slice(0, 170).trimEnd()}…`
                    : tour.description}
                </p>
              ) : null}
              <div className="confirmation-tour-rows">
                {location && (
                  <p className="confirmation-tour-row">
                    <MapPin size={15} />
                    <span>{location}</span>
                  </p>
                )}
                {tour.durationMinutes != null && (
                  <p className="confirmation-tour-row">
                    <Clock size={15} />
                    <span>{formatDuration(Number(tour.durationMinutes))}</span>
                  </p>
                )}
                {tour.supplier?.name && (
                  <p className="confirmation-tour-row">
                    <Globe size={15} />
                    <span>
                      {t('confirmation.operator')}: {tour.supplier.name}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="confirmation-card">
          <div className="confirmation-section-title">{t('confirmation.schedule')}</div>
          <div className="confirmation-grid">
            <div className="confirmation-grid-item">
              <CalendarDays size={16} />
              <div>
                <span className="confirmation-grid-label">{t('confirmation.date')}</span>
                <span className="confirmation-grid-value">{formatDate(b.travelDate)}</span>
              </div>
            </div>
            <div className="confirmation-grid-item">
              <Clock size={16} />
              <div>
                <span className="confirmation-grid-label">
                  {schedule.scheduleType === 'fixedTimeSlot' ? t('confirmation.timeSlots') : t('confirmation.openingHours')}
                </span>
                <span className="confirmation-grid-value">{timeLabel}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Travelers */}
        <div className="confirmation-card">
          <div className="confirmation-section-title">{t('confirmation.travelers')}</div>
          <div className="confirmation-grid">
            {leadName && (
              <div className="confirmation-grid-item">
                <Users size={16} />
                <div>
                  <span className="confirmation-grid-label">{t('confirmation.leadTraveler')}</span>
                  <span className="confirmation-grid-value">{leadName}</span>
                </div>
              </div>
            )}
            {phoneNumber && (
              <div className="confirmation-grid-item">
                <Phone size={16} />
                <div>
                  <span className="confirmation-grid-label">{t('confirmation.phone')}</span>
                  <span className="confirmation-grid-value">{phoneNumber}</span>
                </div>
              </div>
            )}
            {travelerTotal > 0 && (
              <div className="confirmation-grid-item confirmation-grid-item-wide">
                <Users size={16} />
                <div>
                  <span className="confirmation-grid-label">{t('confirmation.partyBreakdown')}</span>
                  <span className="confirmation-grid-value">
                    {travelerCounts.map((c) => `${c.count} ${c.label}`).join(', ')}
                  </span>
                </div>
              </div>
            )}
          </div>
          {travelers.details && travelers.details.length > 1 && (
            <ul className="confirmation-list">
              {travelers.details.map((d, i) => (
                <li key={i}>
                  {d.name || `${t('confirmation.traveler')} ${i + 1}`}
                  {d.ageGroup ? ` — ${d.ageGroup}` : ''}
                </li>
              ))}
            </ul>
          )}
          {b.specialRequests && (
            <p className="confirmation-note">
              {t('confirmation.specialRequests')}: {b.specialRequests}
            </p>
          )}
        </div>

        {/* Meeting & pickup */}
        {(hasMeeting || hasPickup || b.pickup) && (
          <div className="confirmation-card">
            <div className="confirmation-section-title">{t('confirmation.meetingPoint')}</div>
            {b.pickup && (
              <div className="confirmation-grid">
                <div className="confirmation-grid-item confirmation-grid-item-wide">
                  <MapPin size={16} />
                  <div>
                    {(() => {
                      const deferred =
                        b.pickup?.pickupLater ||
                        (b.pickup as { skipValidation?: boolean })?.skipValidation ||
                        b.pickup?.status === 'deferred'
                      const hasPlace = !!(b.pickup?.areaName || b.pickup?.locationName || b.pickup?.address?.name || b.pickup?.address?.address)
                      if (!hasPlace) {
                        return (
                          <>
                            <span className="confirmation-grid-label">{t('confirmation.meetingPointLabel')}</span>
                            <span className="confirmation-grid-value">
                              {t('confirmation.pickupPending')}
                            </span>
                            <span className="confirmation-grid-sub">
                              {t('confirmation.pickupPendingHint')}
                            </span>
                            <button
                              onClick={() => navigate(`/booking/${b.id}/pickup`)}
                              className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                            >
                              {t('confirmation.pickupAdd')}
                            </button>
                          </>
                        )
                      }
                      return (
                        <>
                          <span className="confirmation-grid-label">{b.pickup?.areaName ? t('tourDetail.pickupAreas') : t('confirmation.meetingPointLabel')}</span>
                          <span className="confirmation-grid-value">
                            {b.pickup?.areaName || b.pickup?.locationName || b.pickup?.address?.name || b.pickup?.address?.address}
                          </span>
                          {b.pickup?.time && <span className="confirmation-grid-sub">{t('confirmation.pickupTime', { time: b.pickup.time })}</span>}
                          {b.pickup?.instructions && <span className="confirmation-grid-sub">{b.pickup.instructions}</span>}
                          {deferred && (
                            <span className="confirmation-grid-sub text-amber-700">
                              This pickup location is outside the pickup zone — please confirm a location within the zone before your tour date.
                            </span>
                          )}
                          <button
                            onClick={() => navigate(`/booking/${b.id}/pickup`)}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 underline underline-offset-2"
                          >
                            {t('confirmation.pickupUpdate')}
                          </button>
                        </>
                      )
                    })()}
                  </div>
                </div>
              </div>
            )}
            {hasMeeting && (
              <div className="confirmation-grid">
                <div className="confirmation-grid-item confirmation-grid-item-wide">
                  <MapPin size={16} />
                  <div>
                    <span className="confirmation-grid-label">{t('confirmation.meetingPointLabel')}</span>
                    <span className="confirmation-grid-value">
                      {[meeting.meetingPoint, meeting.meetingPointAddress].filter(Boolean).join(' — ')}
                    </span>
                    {arrivalLabel && <span className="confirmation-grid-sub">{arrivalLabel}</span>}
                    {meeting.meetingPointDescription && (
                      <span className="confirmation-grid-sub">{meeting.meetingPointDescription}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            {!b.pickup && hasPickup && (
              <div className="confirmation-grid">
                {pickupAreas.length > 0 && (
                  <div className="confirmation-grid-item confirmation-grid-item-wide">
                    <MapPin size={16} />
                    <div>
                      <span className="confirmation-grid-label">{t('tourDetail.pickupAreas')}</span>
                      <span className="confirmation-grid-value">
                        {pickupAreas.map((a: { name?: string; address?: string }) => a.name || a.address).join(', ')}
                      </span>
                    </div>
                  </div>
                )}
                {pickupLocations.length > 0 && (
                  <div className="confirmation-grid-item confirmation-grid-item-wide">
                    <MapPin size={16} />
                    <div>
                      <span className="confirmation-grid-label">{t('tourDetail.pickupLocations')}</span>
                      <span className="confirmation-grid-value">
                        {pickupLocations.map((l: { name?: string; address?: string }) => l.name || l.address).join(', ')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

          </div>

          <aside className="confirmation-aside">
        {/* Price breakdown */}
        <div className="confirmation-card confirmation-price-card">
          <div className="confirmation-section-title">{t('confirmation.priceBreakdown')}</div>
          <div className="confirmation-price">
            <div className="confirmation-price-row">
              <span>{t('confirmation.subtotal')}</span>
              <span>{currencySymbol(b.currency)}{num(b.subtotal).toFixed(2)}</span>
            </div>
            {num(b.fees) > 0 && (
              <div className="confirmation-price-row">
                <span>{t('confirmation.fees')}</span>
                <span>{currencySymbol(b.currency)}{num(b.fees).toFixed(2)}</span>
              </div>
            )}
            {num(b.taxes) > 0 && (
              <div className="confirmation-price-row">
                <span>{t('confirmation.taxes')}</span>
                <span>{currencySymbol(b.currency)}{num(b.taxes).toFixed(2)}</span>
              </div>
            )}
            {num(b.discounts) > 0 && (
              <div className="confirmation-price-row confirmation-price-row-discount">
                <span>{t('confirmation.discount')}</span>
                <span>-{currencySymbol(b.currency)}{num(b.discounts).toFixed(2)}</span>
              </div>
            )}
            <div className="confirmation-price-total">
              <span>{t('confirmation.total')}</span>
              <span>{currencySymbol(b.currency)}{num(b.grossAmount).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Cancellation + supplier + email note */}
        <div className="confirmation-card">
          <div className="confirmation-grid">
            <div className="confirmation-grid-item confirmation-grid-item-wide">
              <ShieldCheck size={16} />
              <div>
                <span className="confirmation-grid-label">{t('confirmation.cancellationPolicy')}</span>
                <span className="confirmation-grid-value">{cancellation}</span>
              </div>
            </div>
            {tour.supplier?.phone && (
              <div className="confirmation-grid-item">
                <Phone size={16} />
                <div>
                  <span className="confirmation-grid-label">{t('confirmation.contactSupplier')}</span>
                  <span className="confirmation-grid-value">{tour.supplier.phone}</span>
                </div>
              </div>
            )}
            {tour.supplier?.email && (
              <div className="confirmation-grid-item">
                <Mail size={16} />
                <div>
                  <span className="confirmation-grid-label">{t('confirmation.supplierEmail')}</span>
                  <span className="confirmation-grid-value">{tour.supplier.email}</span>
                </div>
              </div>
            )}
          </div>
          <p className="confirmation-note">{t('confirmation.emailSent')}</p>
          </div>
          </aside>
          </div>
      </div>

      <div className="confirmation-sections confirmation-no-print">
        <ConfirmationSections
          tourSlug={tour.slug}
          supplierId={tour.supplier?.id}
          supplierName={tour.supplier?.name || undefined}
          excludeTourId={tour.id}
          cancellationDeadline={cancellationDeadline}
        />
      </div>

      {/* Quiet text actions */}
      <div className="confirmation-footer-links confirmation-no-print">
        <button type="button" className="confirmation-text-link" onClick={() => window.print()}>
          <Printer size={15} />
          {t('confirmation.printTicket')}
        </button>
        {effectiveReviewSlug && b.status === 'COMPLETED' && (
          <button
            type="button"
            className="confirmation-text-link"
            onClick={() =>
              navigate(`/review/${encodeURIComponent(effectiveReviewSlug)}`, {
                state: {
                  tour: { title: tour.title, slug: effectiveReviewSlug, tourId: tour.id },
                  bookingId: b.id,
                },
              })
            }
          >
            <Star size={15} />
            {t('confirmation.writeReview')}
          </button>
        )}
        <button type="button" className="confirmation-text-link" onClick={() => navigate('/dashboard/bookings')}>
          <CreditCard size={15} />
          {t('confirmation.viewBookings')}
        </button>
        <button type="button" className="confirmation-text-link" onClick={() => navigate('/')}>
          {t('confirmation.backToHome')}
        </button>
      </div>
    </div>
  )
}
