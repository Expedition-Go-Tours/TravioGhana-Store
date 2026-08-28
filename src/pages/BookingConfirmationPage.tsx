import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, CalendarDays, Clock, Users, MapPin, CreditCard, ShieldCheck, Phone, Mail, Printer, Star, Ticket, Globe, AlertTriangle } from 'lucide-react'
import { useExpeditionBookingDetail, useBookingBySession } from '../hooks/useExpeditionBookings'
import { extractMeetingInfo, extractAvailabilitySchedule, formatDuration } from '../hooks/useExpeditionTours'
import { buildE164Phone, isValidPhoneInput } from '../lib/phone'
import { formatTime12h, weeklyHoursRange, openingHoursForDay, formatTimeSlotList } from '../lib/tourAvailability'
import { useAuthUser } from '../hooks/useAuthUser'
import OptimizedImage from '@/components/shared/OptimizedImage'
import './BookingConfirmationPage.css'

interface TravelerRecord {
  adults?: number
  children?: number
  infants?: number
  phoneNumber?: string
  location?: string
  details?: { name?: string; age?: number | null; ageGroup?: string; specialRequests?: string }[]
  [key: string]: unknown
}

interface ConfirmationTour {
  id?: string
  slug?: string
  title?: string
  coverPhoto?: string | null
  photos?: string[]
  durationMinutes?: number | null
  city?: string | null
  country?: string | null
  productContent?: unknown
  bookingAndTickets?: unknown
  schedulesAndPricing?: unknown
  cancellationPolicy?: string | null
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
  total?: number | string
  currency?: string
  specialRequests?: string | null
  paidAt?: string | null
  createdAt?: string
  tour?: ConfirmationTour
  /** Resolved pickup selection snapshotted at booking time (server-validated). */
  pickup?: {
    mode?: string
    areaName?: string
    locationName?: string
    address?: { name?: string; address?: string } | null
    time?: string
    instructions?: string
  } | null
}

function formatDate(value?: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

import { currencySymbol } from '../lib/currencySymbol'

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
  const [navigatedToBooking, setNavigatedToBooking] = useState(false)
  useEffect(() => {
    if (isSessionMode && sessionBooking?.id && !navigatedToBooking) {
      // Update the URL to the canonical booking confirmation path so
      // deep-links and refreshes work (replaceState avoids history pollution).
      window.history.replaceState({}, '', `/booking/confirmation/${sessionBooking.id}`)
      setNavigatedToBooking(true)
    }
  }, [isSessionMode, sessionBooking?.id, navigatedToBooking])

  // ── Session mode: stop polling once terminal ────────────────────────
  const [sessionPollStopped, setSessionPollStopped] = useState(false)
  useEffect(() => {
    if (isSessionMode && (sessionStatus === 'EXPIRED' || sessionStatus === 'REFUNDED') && !sessionPollStopped) {
      setSessionPollStopped(true)
    }
  }, [isSessionMode, sessionStatus, sessionPollStopped])

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

  // ── Session mode: terminal states (no booking exists yet) ──────────
  if (isSessionMode && sessionStatus && sessionStatus !== 'PAID') {
    const isRefunded = sessionStatus === 'REFUNDED'
    return (
      <div className="confirmation-page">
        <div className="confirmation-card">
          <div className={`confirmation-icon ${isRefunded ? 'warning' : 'error'}`}>
            {isRefunded ? <AlertTriangle className="size-10" /> : <span className="text-3xl">⏰</span>}
          </div>
          <h2 className="confirmation-title">
            {isRefunded ? 'Payment received but spots sold out' : 'Checkout not completed'}
          </h2>
          <p className="confirmation-message">
            {isRefunded
              ? 'Your payment was processed but the last spots were claimed by another customer while your checkout was in progress. You have been fully refunded.'
              : 'Your session expired before payment was completed. No spots were held and no money was charged.'}
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

  // ── Session mode: polling timed out (webhook hasn't landed) ────────
  if (isSessionMode && sessionStatus === 'HOLDING' && !sessionQuery.isFetching) {
    return (
      <div className="confirmation-page">
        <div className="confirmation-card">
          <div className="confirmation-icon warning">
            <AlertTriangle className="size-10" />
          </div>
          <h2 className="confirmation-title">Still processing</h2>
          <p className="confirmation-message">
            Your payment is being confirmed. This usually takes a few seconds but can take longer during busy periods.
            We'll email you once your booking is confirmed — you can also check your bookings page.
          </p>
          <div className="confirmation-actions">
            <button className="confirmation-btn-primary" onClick={() => navigate('/bookings')}>
              View My Bookings
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

  const bt = (tour.bookingAndTickets ?? {}) as { cancellationPolicy?: string | null; meetingPoint?: unknown }
  const cancellation = (() => {
    const raw = bt.cancellationPolicy || tour.cancellationPolicy || ''
    const lower = String(raw).toLowerCase()
    if (lower === 'all_sales_final' || lower === 'non-refundable' || lower === 'non_refundable') {
      return t('confirmation.nonRefundable')
    }
    return raw || t('confirmation.cancellationDefault')
  })()

  const hasMeeting = meeting.meetingMode === 'meeting_point' && (meeting.meetingPoint || meeting.meetingPointAddress || arrivalLabel)
  const pickupAreas = (meeting.pickupAreas || []).filter((a: { name?: string; address?: string }) => a && (a.name || a.address))
  const pickupLocations = (meeting.pickupLocations || []).filter((l: { name?: string; address?: string }) => l && (l.name || l.address))
  const hasPickup = meeting.meetingMode === 'pickup' && (pickupAreas.length > 0 || pickupLocations.length > 0 || meeting.pickupDescription)

  const reviewSlug = tour.title
    ? tour.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    : ''

  return (
    <div className="confirmation-page">
      <div className="confirmation-print-area">
        {/* Header */}
        <div className="confirmation-card confirmation-card-hero">
          <div className="confirmation-hero">
            <span className="confirmation-hero-icon">
              <Check size={28} strokeWidth={2.6} />
            </span>
            <h1 className="confirmation-title">{t('confirmation.title')}</h1>
            <p className="confirmation-subtitle">{t('confirmation.subtitle')}</p>
            <div className="confirmation-badges">
              <span className="confirmation-badge confirmation-badge-code">
                <Ticket size={14} />
                {b.bookingNumber}
              </span>
              <span className={`confirmation-badge ${isPaid ? 'confirmation-badge-paid' : 'confirmation-badge-pending'}`}>
                {statusLabel}
              </span>
            </div>
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
          </div>
        </div>

        {/* Tour card */}
        <div className="confirmation-card">
          <div className="confirmation-section-title">{t('confirmation.tourDetails')}</div>
          <div className="confirmation-tour">
            {image && (
              <div className="confirmation-tour-image">
                <OptimizedImage src={image} alt={tour.title || ''} width={400} />
              </div>
            )}
            <div className="confirmation-tour-info">
              <h2 className="confirmation-tour-title">{tour.title}</h2>
              {location && (
                <p className="confirmation-tour-row">
                  <MapPin size={14} />
                  {location}
                </p>
              )}
              {tour.durationMinutes != null && (
                <p className="confirmation-tour-row">
                  <Clock size={14} />
                  {formatDuration(Number(tour.durationMinutes))}
                </p>
              )}
              {tour.supplier?.name && (
                <p className="confirmation-tour-row">
                  <Globe size={14} />
                  {t('confirmation.operator')}: {tour.supplier.name}
                </p>
              )}
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
                  {d.age != null ? ` (${d.age})` : ''}
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
                    <span className="confirmation-grid-label">{b.pickup.areaName ? t('tourDetail.pickupAreas') : t('confirmation.meetingPointLabel')}</span>
                    <span className="confirmation-grid-value">
                      {b.pickup.areaName || b.pickup.locationName || b.pickup.address?.name || b.pickup.address?.address || 'Pickup arranged after booking'}
                    </span>
                    {b.pickup.time && <span className="confirmation-grid-sub">Pickup {b.pickup.time}</span>}
                    {b.pickup.instructions && <span className="confirmation-grid-sub">{b.pickup.instructions}</span>}
                    {!b.pickup.areaName && !b.pickup.locationName && !b.pickup.address?.name && (
                      <span className="confirmation-grid-sub">
                        The tour operator will confirm your exact pickup point and time directly.
                      </span>
                    )}
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
            {hasPickup && (
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

        {/* Price breakdown */}
        <div className="confirmation-card">
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
              <span>{currencySymbol(b.currency)}{num(b.total).toFixed(2)}</span>
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
      </div>

      {/* Actions (hidden when printing) */}
      <div className="confirmation-actions confirmation-no-print">
        <button className="confirmation-btn-primary" onClick={() => window.print()}>
          <Printer size={16} />
          {t('confirmation.printTicket')}
        </button>
        {reviewSlug && (
          <button
            className="confirmation-btn-secondary"
            onClick={() =>
              navigate(`/review/${reviewSlug}`, {
                state: {
                  tour: { title: tour.title, slug: reviewSlug, tourId: tour.id },
                  bookingId: b.id,
                },
              })
            }
          >
            <Star size={16} />
            {t('confirmation.writeReview')}
          </button>
        )}
        <button className="confirmation-btn-secondary" onClick={() => navigate('/dashboard/bookings')}>
          <CreditCard size={16} />
          {t('confirmation.viewBookings')}
        </button>
        <button className="confirmation-btn-ghost" onClick={() => navigate('/')}>
          {t('confirmation.backToHome')}
        </button>
      </div>
    </div>
  )
}
