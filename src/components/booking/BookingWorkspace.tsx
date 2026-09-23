import { useMemo, useState, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Ticket,
  Copy,
  Check,
  Printer,
  CalendarDays,
  Users,
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  Info,
  AlertTriangle,
  ChevronRight,
  Navigation,
  Flag,
} from 'lucide-react'
import { useChat } from '../../chat/ChatContext'
import { useExpeditionBookingDetail, useCancelBooking, useBookingPaymentState, useStartPayLaterPayNow } from '../../hooks/useExpeditionBookings'
import { extractMeetingInfo, formatDuration, type TourCardData } from '../../hooks/useExpeditionTours'
import { useRecommendedTours, type RecommendedTour } from '../../hooks/useRecommendedTours'
import { formatItineraryDuration, type ItineraryDay } from '../../lib/tourTypes'
import { currencySymbol } from '../../lib/currencySymbol'
import CancelBookingModal from './CancelBookingModal'
import {
  bookingStatusMeta,
  evaluateCancellationPolicy,
  formatFullDate,
  formatTimeString,
  partyLabel,
  toFiniteNumber,
  formatDeadlineLabel,
  type PartyCount,
} from '../../lib/bookingUi'
import BookingPointMap from './BookingPointMap'
import { extractItinerary } from '../../hooks/useExpeditionTours'
import TourCard from '../TourCard'
import './bookingTheme.css'
import './BookingWorkspace.css'

interface TravelerRow {
  name?: string
  ageGroup?: string
  specialRequests?: string
}

interface TravelersJson {
  adults?: number
  children?: number
  infants?: number
  phoneNumber?: string
  location?: string
  details?: TravelerRow[]
}

function copyText(value: string): Promise<boolean> {
  return (async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value)
        return true
      }
    } catch {
      /* fall through */
    }
    const el = document.createElement('textarea')
    el.value = value
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    try {
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      document.body.removeChild(el)
    }
  })()
}

function startLabel(detail: Record<string, unknown>, pickupTime?: string | null): string {
  const slot = typeof detail.selectedTime === 'string' ? detail.selectedTime : ''
  if (slot) return formatTimeString(slot)
  if (pickupTime) return `Pickup ${formatTimeString(pickupTime)}`
  return 'Flexible'
}

const KNOW_BEFORE_PREVIEW_COUNT = 5

function KnowBeforeYouGo({
  included,
  excluded,
  notes,
  highlights,
}: {
  included: string[]
  excluded: string[]
  notes: string
  highlights: string[]
}) {
  const [expanded, setExpanded] = useState(false)
  const hasLongList = included.length > KNOW_BEFORE_PREVIEW_COUNT || excluded.length > KNOW_BEFORE_PREVIEW_COUNT
  const visibleInc = expanded ? included : included.slice(0, KNOW_BEFORE_PREVIEW_COUNT)
  const visibleExc = expanded ? excluded : excluded.slice(0, KNOW_BEFORE_PREVIEW_COUNT)
  const truncated = !expanded && hasLongList

  return (
    <section className="ws-card ws-kyb">
      <h2 className="ws-kyb-title">Know before you go</h2>

      {highlights.length > 0 && (
        <div className="ws-kyb-row">
          <span className="ws-kyb-label">Highlights</span>
          <ul className="ws-kyb-items">
            {highlights.map((item, i) => (
              <li key={i} className="ws-kyb-item">
                <svg className="ws-kyb-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00aa6c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {included.length > 0 && (
        <div className="ws-kyb-row">
          <span className="ws-kyb-label">Includes</span>
          <ul className="ws-kyb-items">
            {visibleInc.map((item, i) => (
              <li key={i} className="ws-kyb-item">
                <svg className="ws-kyb-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00aa6c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {excluded.length > 0 && (
        <div className="ws-kyb-row">
          <span className="ws-kyb-label">What&apos;s not included</span>
          <ul className="ws-kyb-items">
            {visibleExc.map((item, i) => (
              <li key={i} className="ws-kyb-item ws-kyb-item-exc">
                <svg className="ws-kyb-x" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d93b3b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {notes && (
        <div className="ws-kyb-row">
          <span className="ws-kyb-label">Notes from the activity provider</span>
          <p className="ws-kyb-notes">{notes}</p>
        </div>
      )}

      {truncated && (
        <button type="button" className="ws-kyb-toggle" onClick={() => setExpanded(true)}>
          More <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
      )}
      {expanded && hasLongList && (
        <button type="button" className="ws-kyb-toggle" onClick={() => setExpanded(false)}>
          Less <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
        </button>
      )}
    </section>
  )
}

function ItineraryAccordion({
  itinerary,
  meeting,
  dropoff,
}: {
  itinerary: ItineraryDay[]
  meeting?: { meetingMode?: string; meetingPoint?: string; pickupType?: string; pickupAreas?: { name?: string; address?: string }[]; pickupLocations?: { name?: string; address?: string }[] }
  dropoff?: { dropoffOption?: string; dropoffLocation?: string; dropoffLocationAddress?: string }
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (!itinerary || itinerary.length === 0) return null

  const isMultiDay = itinerary.some((stop) => (stop.day || 1) > 1)

  const admissionLabel = (stop: ItineraryDay) => {
    if (stop.admissionIncluded === 'yes') return 'Ticket included'
    if (stop.admissionIncluded === 'no') return 'Pay separately'
    if (stop.admissionIncluded === 'passby') return 'Pass by'
    return stop.additionalFee ? 'Pay separately' : 'Ticket included'
  }

  const formatStopMeta = (stop: ItineraryDay) => {
    const parts: string[] = []
    const dur = formatItineraryDuration(stop.duration, stop.durationUnit)
    if (dur) parts.push(dur)
    parts.push(admissionLabel(stop))
    return parts.join(' \u00B7 ')
  }

  // Build pickup label
  const pickupLabel = (() => {
    if (!meeting) return null
    if (meeting.meetingMode === 'pickup') {
      if (meeting.pickupType === 'area') {
        return meeting.pickupAreas?.map((a) => a.name || a.address).filter(Boolean).join(', ') || 'Pickup areas'
      }
      return meeting.pickupLocations?.map((l) => l.name || l.address).filter(Boolean).join(', ') || 'Pickup locations'
    }
    if (meeting.meetingMode === 'meeting_point') return meeting.meetingPoint || 'Meeting point'
    return null
  })()

  const pickupAddress = (() => {
    if (!meeting || meeting.meetingMode !== 'meeting_point') return null
    return meeting.meetingPoint || null
  })()

  // Group stops by day for multi-day
  const stopsByDay = isMultiDay
    ? Array.from(
        itinerary.reduce((map, stop) => {
          const d = stop.day || 1
          if (!map.has(d)) map.set(d, [])
          map.get(d)!.push(stop)
          return map
        }, new Map<number, ItineraryDay[]>())
      )
    : null

  return (
    <section className="ws-card ws-itinerary-accordion">
      <h2 className="ws-card-title">Your itinerary</h2>
      <div className="ws-itin-list">
        {/* Pickup / Start node */}
        {pickupLabel && (
          <div className="ws-itin-node ws-itin-start">
            <div className="ws-itin-node-icon-wrap ws-itin-node-icon-start">
              <MapPin size={16} strokeWidth={2.4} />
            </div>
            <div className="ws-itin-node-body">
              <p className="ws-itin-node-label">Pickup</p>
              <p className="ws-itin-node-text">{pickupLabel}</p>
              {pickupAddress && <p className="ws-itin-node-sub">{pickupAddress}</p>}
            </div>
          </div>
        )}

        {/* Stops */}
        {isMultiDay && stopsByDay ? (
          stopsByDay.map(([day, stops]) => (
            <div key={day} className="ws-itin-day-group">
              <div className="ws-itin-day-badge">Day {day}</div>
              {stops.map((stop, i) => {
                const globalIdx = itinerary.indexOf(stop)
                const isOpen = openIndex === globalIdx
                const title = stop.locationName || stop.title
                const meta = formatStopMeta(stop)
                const locLine = [stop.locationCity, stop.locationCountry].filter(Boolean).join(', ')
                return (
                  <div key={i} className={`ws-itin-stop${isOpen ? ' open' : ''}`}>
                    <button
                      type="button"
                      className="ws-itin-stop-header"
                      onClick={() => setOpenIndex(isOpen ? null : globalIdx)}
                      aria-expanded={isOpen}
                    >
                      <div className="ws-itin-node-icon-wrap ws-itin-node-icon-stop">
                        <span className="ws-itin-stop-num">{stops.indexOf(stop) + 1}</span>
                      </div>
                      <div className="ws-itin-stop-info">
                        <p className="ws-itin-stop-title">{title}</p>
                        <p className="ws-itin-stop-meta">{meta}</p>
                      </div>
                      <ChevronRight
                        size={16}
                        className={`ws-itin-chevron${isOpen ? ' rotated' : ''}`}
                      />
                    </button>
                    {isOpen && (
                      <div className="ws-itin-stop-detail">
                        {locLine && <p className="ws-itin-stop-loc">{locLine}</p>}
                        {stop.locationAddress && <p className="ws-itin-stop-addr">{stop.locationAddress}</p>}
                        {stop.description && <p className="ws-itin-stop-desc">{stop.description}</p>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))
        ) : (
          itinerary.map((stop, i) => {
            const isOpen = openIndex === i
            const title = stop.locationName || stop.title
            const meta = formatStopMeta(stop)
            const locLine = [stop.locationCity, stop.locationCountry].filter(Boolean).join(', ')
            return (
              <div key={i} className={`ws-itin-stop${isOpen ? ' open' : ''}`}>
                <button
                  type="button"
                  className="ws-itin-stop-header"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <div className="ws-itin-node-icon-wrap ws-itin-node-icon-stop">
                    <span className="ws-itin-stop-num">{i + 1}</span>
                  </div>
                  <div className="ws-itin-stop-info">
                    <p className="ws-itin-stop-title">{title}</p>
                    <p className="ws-itin-stop-meta">{meta}</p>
                  </div>
                  <ChevronRight
                    size={16}
                    className={`ws-itin-chevron${isOpen ? ' rotated' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="ws-itin-stop-detail">
                    {locLine && <p className="ws-itin-stop-loc">{locLine}</p>}
                    {stop.locationAddress && <p className="ws-itin-stop-addr">{stop.locationAddress}</p>}
                    {stop.description && <p className="ws-itin-stop-desc">{stop.description}</p>}
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* Drop-off / End node */}
        {dropoff && dropoff.dropoffOption !== 'none' && (
          <div className="ws-itin-node ws-itin-end">
            <div className="ws-itin-node-icon-wrap ws-itin-node-icon-end">
              <Flag size={16} strokeWidth={2.4} />
            </div>
            <div className="ws-itin-node-body">
              <p className="ws-itin-node-label">
                {dropoff.dropoffOption === 'same_location' ? 'Returns to pickup point' : 'Drop-off'}
              </p>
              {dropoff.dropoffOption === 'different_location' && dropoff.dropoffLocation && (
                <>
                  <p className="ws-itin-node-text">{dropoff.dropoffLocation}</p>
                  {dropoff.dropoffLocationAddress && <p className="ws-itin-node-sub">{dropoff.dropoffLocationAddress}</p>}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function recDurationLabel(min: number | null | undefined): string {
  if (!min || min <= 0) return ''
  if (min >= 1440) {
    const d = Math.round(min / 1440)
    return d === 1 ? '1 day' : `${d} days`
  }
  const h = Math.round(min / 60)
  return h === 1 ? '1 hour' : `${h} hours`
}

function toRecommendedCardData(tour: RecommendedTour): TourCardData {
  return {
    id: tour.id,
    title: tour.title || '',
    slug: tour.slug || '',
    category: tour.category || '',
    duration: recDurationLabel(tour.durationMinutes),
    features: '',
    price: tour.startingPrice != null ? `$${tour.startingPrice}` : '',
    priceValue: tour.startingPrice,
    rating: tour.averageRating != null ? String(tour.averageRating) : '',
    reviews: tour.reviewCount ?? 0,
    location: [tour.city, tour.country].filter(Boolean).join(', '),
    image: tour.coverPhoto || (tour.photos && tour.photos[0]) || '',
    photos: tour.photos,
    source: 'expedition-go',
    specialOffers: (tour.specialOffers ?? []) as unknown as TourCardData['specialOffers'],
    isNew: tour.isNew,
    likelyToSellOut: tour.likelyToSellOut,
  }
}

function RecommendedExperiences({ tourId, location }: { tourId: string; location: string }) {
  const { data, isLoading } = useRecommendedTours(tourId, 6)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const tours = useMemo(() => data?.data?.tours ?? [], [data])

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 10)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10)
  }, [])

  const scroll = useCallback((dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const slot = el.querySelector<HTMLElement>('.ws-rec-card-slot')
    const step = slot ? slot.offsetWidth + 16 : 300
    el.scrollBy({ left: dir === 'left' ? -step : step, behavior: 'smooth' })
    setTimeout(checkScroll, 350)
  }, [checkScroll])

  if (isLoading || tours.length === 0) return null

  return (
    <section className="ws-recommended">
      <div className="ws-recommended-header">
        <h2 className="ws-recommended-title">More popular experiences</h2>
        {location && (
          <p className="ws-recommended-subtitle">
            Recommended activities for you near <strong>{location}</strong>
          </p>
        )}
      </div>
      <div className="ws-recommended-scroll-wrap">
        {canScrollLeft && (
          <button type="button" className="ws-recommended-arrow ws-recommended-arrow-left" onClick={() => scroll('left')} aria-label="Scroll left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        )}
        <div ref={scrollRef} className="ws-recommended-scroll" onScroll={checkScroll}>
          {tours.map(({ id: recordId, tour }) => (
            <div key={recordId} className="ws-rec-card-slot">
              <TourCard {...toRecommendedCardData(tour)} />
            </div>
          ))}
        </div>
        {canScrollRight && (
          <button type="button" className="ws-recommended-arrow ws-recommended-arrow-right" onClick={() => scroll('right')} aria-label="Scroll right">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        )}
      </div>
      {location && (
        <Link to={`/tours?place=${encodeURIComponent(location)}`} className="ws-recommended-link">
          Find more things to do in {location} &rsaquo;
        </Link>
      )}
    </section>
  )
}

export default function BookingWorkspace({ id, onClose }: { id?: string; onClose?: () => void }) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)

  const detailQuery = useExpeditionBookingDetail(id)
  const detail = detailQuery.data as Record<string, any> | undefined
  const cancelBooking = useCancelBooking()
  const { data: paymentState } = useBookingPaymentState(id)
  const startPayLater = useStartPayLaterPayNow()
  const [payNowError, setPayNowError] = useState<string | null>(null)

  // Reserve-now-pay-later: complete the deferred payment now (3DS / card update
  // / pay early) by redirecting to the hosted Stripe Checkout session.
  const handlePayLaterPayNow = async () => {
    if (!id || startPayLater.isPending) return
    setPayNowError(null)
    try {
      const url = await startPayLater.mutateAsync(id)
      if (!url) throw new Error('Payment could not be started — please try again.')
      window.location.assign(url)
    } catch (err) {
      setPayNowError(err instanceof Error ? err.message : 'Payment could not be started — please try again.')
    }
  }

  const tour = detail?.tour && typeof detail.tour === 'object' ? (detail.tour as Record<string, any>) : null
  const rawSupplier =
    tour?.supplier && typeof tour.supplier === 'object'
      ? (tour.supplier as Record<string, unknown>)
      : null
  const supplierName = typeof rawSupplier?.name === 'string' ? rawSupplier.name : ''
  const supplierPhone = typeof rawSupplier?.phone === 'string' ? rawSupplier.phone : ''
  const operatorId = typeof rawSupplier?.id === 'string' ? rawSupplier.id : ''
  const operatorPhoto = typeof rawSupplier?.photoURL === 'string' ? rawSupplier.photoURL : null
  const chat = useChat()
  const travelDate = typeof detail?.travelDate === 'string' ? detail.travelDate : ''
  const meeting = useMemo(() => extractMeetingInfo(tour ?? {}), [tour])

  const travelers = ((detail?.travelers ?? {}) as TravelersJson) || {}
  const party: PartyCount = {
    adults: Number(travelers.adults) || 0,
    children: Number(travelers.children) || 0,
    infants: Number(travelers.infants) || 0,
    total:
      (travelers.details?.length ?? 0) > 0
        ? travelers.details!.length
        : (Number(travelers.adults) || 0) + (Number(travelers.children) || 0) + (Number(travelers.infants) || 0),
  }
  const leadName =
    travelers.details?.[0]?.name || (typeof detail?.leadTravelerName === 'string' ? detail.leadTravelerName : '') || ''

  const pickup =
    detail?.pickup && typeof detail.pickup === 'object'
      ? (detail.pickup as Record<string, unknown>)
      : null
  const pickupAddress =
    pickup?.address && typeof pickup.address === 'object'
      ? (pickup.address as Record<string, unknown>)
      : null
  const pickupLocation = String(
    pickup?.place || pickup?.areaName || pickup?.locationName || pickupAddress?.name || pickupAddress?.address || ''
  ).trim()
  // Customer-facing location: the exact pickup point when one is stored; the
  // supplier zone label is operator context only and is never shown to customers.
  // For area-type pickups the address may only live in travelers.location
  // (the checkout payload), so fall back to it when pickup.address is empty.
  const travelerLocation = typeof travelers.location === 'string' ? travelers.location.trim() : ''
  const pickupAddressText = String(pickupAddress?.name || pickupAddress?.address || travelerLocation || '').trim()
  const hasStoredPickupLocation = !!(pickupLocation || pickupAddressText)
  // A stored out-of-zone choice is persisted as deferred (skipValidation) with
  // the address kept — show the address, not the "not yet assigned" state.
  const pickupFlagged = !!(
    pickup && (pickup.pickupLater || pickup.skipValidation || pickup.status === 'deferred')
  )
  const pickupDeferred = pickupFlagged && !hasStoredPickupLocation
  const pickupOutOfZone = pickupFlagged && hasStoredPickupLocation
  const pickupTime = pickup?.time ? String(pickup.time) : null
  const pickupInstructionsText =
    typeof pickup?.instructions === 'string' ? pickup.instructions.trim() : ''
  const pickupPrimary = pickupAddressText || pickupLocation
  const pickupKicker = pickupAddressText
    ? 'Pickup point'
    : pickup?.areaName
      ? 'Pickup area'
      : 'Pickup location'

  const arrivalLabel = (() => {
    if (meeting.meetingMode !== 'meeting_point') return ''
    if (meeting.arrivalTimeType === 'custom') {
      return meeting.arrivalTimeCustom ? `Arrive by ${meeting.arrivalTimeCustom}` : ''
    }
    switch (meeting.arrivalTimeType) {
      case '5min': return 'Arrive 5 minutes before the activity'
      case '10min': return 'Arrive 10 minutes before the activity'
      case '15min': return 'Arrive 15 minutes before the activity'
      case '30min': return 'Arrive 30 minutes before the activity'
      case 'notified': return 'Arrival time will be notified'
      default: return ''
    }
  })()

  const hasMeeting =
    meeting.meetingMode === 'meeting_point' && (meeting.meetingPoint || meeting.meetingPointAddress || arrivalLabel)
  const bookingIsPickup = meeting.meetingMode === 'pickup'

  const mapPoint = useMemo(() => {
    if (!pickup && !hasMeeting) return null
    if (pickup) {
      const lat = toFiniteNumber(pickup.lat)
      const lng = toFiniteNumber(pickup.lng)
      if (lat != null && lng != null) return { lat, lng }
      const aLat = pickupAddress ? toFiniteNumber(pickupAddress.lat) : null
      const aLng = pickupAddress ? toFiniteNumber(pickupAddress.lng) : null
      if (aLat != null && aLng != null) return { lat: aLat, lng: aLng }
      if (pickup?.areaName) {
        const zone = (meeting.pickupAreas as { name?: string; address?: string; lat?: number; lng?: number }[]).find(
          (a) => a && (a.name === pickup.areaName || a.address === pickup.areaName)
        )
        const zLat = toFiniteNumber(zone?.lat)
        const zLng = toFiniteNumber(zone?.lng)
        if (zLat != null && zLng != null) return { lat: zLat, lng: zLng }
      }
      return null
    }
    const mLat = meeting.meetingPointLat
    const mLng = meeting.meetingPointLng
    if (mLat != null && mLng != null) return { lat: mLat, lng: mLng }
    return null
  }, [pickup, pickupAddress, hasMeeting, meeting])

  const status = typeof detail?.status === 'string' ? detail.status : ''
  const isPaid = detail?.paymentStatus === 'SUCCEEDED'
  const meta = bookingStatusMeta(status, detail?.paymentTiming ?? null, detail?.paymentStatus ?? null, detail?.refundState ?? null)
  const activeStatus = status === 'PENDING' || status === 'CONFIRMED'

  // Completed + paid + travel date passed + never-reviewed → eligible (mirrors
  // the backend's review eligibility check exactly).
  const travelMs = typeof detail?.travelDate === 'string' ? new Date(detail.travelDate).getTime() : NaN
  // eslint-disable-next-line react-hooks/purity -- wall-clock read for review eligibility
  const tripPassed = Number.isFinite(travelMs) && travelMs <= Date.now()
  const canWriteReview = status === 'COMPLETED' && isPaid && tripPassed && !(detail && detail.review)

  const currency = typeof detail?.currency === 'string' ? detail.currency : 'USD'
  const gross = Number(detail?.grossAmount ?? 0) || 0

  const cancellation = useMemo(
    () =>
      evaluateCancellationPolicy(
        tour?.bookingAndTickets,
        typeof detail?.travelDate === 'string' ? detail.travelDate : undefined
      ),
    [tour, detail]
  )
  const showCancel = activeStatus && !!detail
  const policyNote = (() => {
    if (!detail) return ''
    if (cancellation.type === 'all_sales_final' || cancellation.refundPct === 0) {
      return 'This booking is non-refundable, so no refund will be issued.'
    }
    if (cancellation.allowed) {
      if (!isPaid) return 'Reserved — no payment has been taken yet.'
      if (cancellation.refundPct >= 100) {
        return cancellation.windowHours > 0 && cancellation.deadline
          ? `Free cancellation — full refund until ${formatDeadlineLabel(cancellation.deadline)}.`
          : 'Free cancellation — full refund.'
      }
      return `Cancellation available — you will receive a ${cancellation.refundPct}% refund.`
    }
    return cancellation.deadline
      ? `Free cancellation ended ${formatDeadlineLabel(cancellation.deadline)}.`
      : 'Cancellations are no longer available for this booking.'
  })()

  const copyReference = async () => {
    if (!detail?.bookingNumber) return
    if (await copyText(String(detail.bookingNumber))) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    }
  }

  const handleCancel = () => {
    if (!detail?.id) return
    setCancelError(null)
    setCancelModalOpen(true)
  }

  const handleCancelConfirm = (reason: string) => {
    if (!detail?.id) return
    cancelBooking.mutate(
      { id: detail.id, reason },
      {
        onSuccess: closeDetail,
        onError: (err: Error) => setCancelError(err.message),
      }
    )
  }

  const handleWriteReview = () => {
    if (!id || !detail) return
    const title = typeof tour?.title === 'string' ? tour.title : ''
    const slug =
      typeof tour?.slug === 'string' && tour.slug
        ? tour.slug
        : title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    navigate(`/review/${encodeURIComponent(slug)}`, {
      state: {
        tour: { title, slug, tourId: detail?.tourId },
        bookingId: id,
        returnTo: `/dashboard/bookings?booking=${encodeURIComponent(id)}`,
      },
    })
  }

  const closeDetail = () => {
    if (onClose) onClose()
    else navigate('/dashboard/bookings')
  }
  const back = closeDetail
  const statusMeta = meta

  // Open a SUPPLIER_CUSTOMER conversation with this booking's operator — the
  // same thread the operator opens via Bookings → "Message customer". Reuses
  // any existing thread with the operator (including a prior support thread,
  // e.g. SUPPLIER_CUSTOMER or EXPEDITION_CUSTOMER, when the operator doubles as
  // the support identity) so we never strand messages in a duplicate. Falls
  // back to the shared Expedition support channel when the tour has no
  // operator user.
  const handleMessageOperator = async () => {
    try {
      if (operatorId) {
        const existing = chat.conversations
          .filter(
            (c) =>
              (c.type === 'SUPPLIER_CUSTOMER' || c.type === 'EXPEDITION_CUSTOMER') &&
              c.participants?.some((p) => p.userId === operatorId),
          )
          .sort((a, b) => {
            const aHas = (a.messages?.length ?? 0) > 0 ? 1 : 0
            const bHas = (b.messages?.length ?? 0) > 0 ? 1 : 0
            if (aHas !== bHas) return bHas - aHas
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          })[0]

        if (existing) {
          chat.openConversation(existing.id)
          navigate(`/dashboard/chat?conversation=${existing.id}`)
          return
        }

        const conv = await chat.startChat(
          { id: operatorId, name: supplierName || 'Operator', photoURL: operatorPhoto },
          'SUPPLIER_CUSTOMER',
          {
            bookingId: detail?.id,
            bookingNumber: detail?.bookingNumber,
            tourTitle: typeof tour?.title === 'string' ? tour.title : undefined,
          },
        )
        navigate(`/dashboard/chat?conversation=${conv.id}`)
        return
      }
      await chat.openSupportChat()
      navigate('/dashboard/chat')
    } catch {
      toast.error('Unable to open chat. Please try again.')
    }
  }

  if (detailQuery.isLoading) {
    return (
      <div className="ws">
        <button type="button" className="ws-back" onClick={back}>
          <ArrowLeft size={15} /> Back to bookings
        </button>
        <div className="ws-skel-block" aria-hidden="true">
          <div className="bk-skel ws-skel-title" />
          <div className="bk-skel ws-skel-sub" />
          <div className="bk-skel ws-skel-card" />
        </div>
      </div>
    )
  }

  if (detailQuery.isError || !detail) {
    return (
      <div className="ws">
        <button type="button" className="ws-back" onClick={back}>
          <ArrowLeft size={15} /> Back to bookings
        </button>
        <div className="bk-state ws-error">
          <AlertTriangle size={26} />
          <h3>Couldn't load this booking</h3>
          <p>It may no longer be available. Head back to your bookings and try again.</p>
          <button type="button" className="bk-btn bk-btn-primary" onClick={back}>
            Back to bookings
          </button>
        </div>
      </div>
    )
  }

  const title = tour?.title || (typeof detail.tourTitle === 'string' ? detail.tourTitle : 'Booking')
  const duration = tour?.durationMinutes ? formatDuration(Number(tour.durationMinutes)) : ''

  // Extract product content for includes/excludes/itinerary/knowBeforeYouGo
  const productContent = tour?.productContent && typeof tour.productContent === 'object'
    ? (tour.productContent as Record<string, any>)
    : null
  const includedItems: string[] = Array.isArray(productContent?.included) ? productContent.included : []
  const excludedItems: string[] = Array.isArray(productContent?.excluded) ? productContent.excluded : []
  const knowBeforeYouGo = typeof productContent?.knowBeforeYouGo === 'string' ? productContent.knowBeforeYouGo
    : typeof productContent?.additionalInfo === 'string' ? productContent.additionalInfo : ''
  const highlights: string[] = Array.isArray(productContent?.highlights) ? productContent.highlights : []
  const itinerary = extractItinerary(detail.tour)

  // Drop-off info
  const btData = tour?.bookingAndTickets && typeof tour.bookingAndTickets === 'object'
    ? (tour.bookingAndTickets as Record<string, any>)
    : null
  const dropoffOption = productContent?.dropoffOption || btData?.dropoffOption || ''
  const dropoffLocationName = productContent?.dropoffLocation?.name || btData?.dropoffLocation?.name || ''
  const dropoffLocationAddr = productContent?.dropoffLocation?.address || btData?.dropoffLocation?.address || ''
  const hasDropoff = dropoffOption === 'different_location' && (dropoffLocationName || dropoffLocationAddr)

  return (
    <div className="ws">
      <button type="button" className="ws-back no-print" onClick={back}>
        <ArrowLeft size={15} /> Back to bookings
      </button>

      <header className="ws-head">
        <div className="ws-head-top">
          <span className={`bk-chip bk-chip-${statusMeta.kind}`}>
            <span className="bk-chip-dot" />
            {statusMeta.label}
          </span>
          <span className="ws-paid">{isPaid ? `Paid ${currencySymbol(currency)}${gross.toFixed(2)}` : 'Reserved'}</span>
        </div>
        <h1 className="ws-title">{title}</h1>
        {duration && (
          <p className="ws-duration"><Clock size={14} /> Duration: {duration}</p>
        )}
        <p className="ws-ref">
          <span className="ws-ref-label">Booking</span>
          <Ticket size={13} />
          <code>{detail.bookingNumber}</code>
          <button type="button" className={`bk-copy${copied ? ' is-copied' : ''}`} onClick={copyReference}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </p>
      </header>

      {policyNote && activeStatus && !showCancel && (
        <p className="ws-policy-note no-print">
          <Info size={15} /> {policyNote}
        </p>
      )}

      {paymentState?.canPayNow && (
        <div className="ws-paylater no-print">
          <div className="ws-paylater-copy">
            <p className="ws-paylater-title">
              {paymentState.requiresAction ? 'Action needed to keep your spot' : 'Pay now — optional'}
            </p>
            <p className="ws-paylater-desc">
              {paymentState.requiresAction
                ? `We could not charge your card automatically for ${currencySymbol(currency)}${gross.toFixed(2)}. Complete your payment (or update your card) to keep this reservation.`
                : `This reservation is reserved and will be charged before your activity date. You can also pay now with a different card.`}
            </p>
          </div>
          <button
            type="button"
            className="bk-btn bk-btn-primary ws-paylater-btn"
            onClick={handlePayLaterPayNow}
            disabled={startPayLater.isPending}
          >
            {startPayLater.isPending ? 'Starting secure payment…' : paymentState.requiresAction ? 'Complete payment' : 'Pay now'}
          </button>
          {payNowError && <p className="ws-paylater-error">{payNowError}</p>}
        </div>
      )}

      <div className="ws-layout">
        <div className="ws-main">
          {/* Digital ticket */}
          <section className="ws-card ws-voucher">
            <div className="ws-voucher-top">
              <span className="ws-eyebrow">Digital ticket</span>
              <span className="ws-voucher-check">
                <Ticket size={14} /> Show at check-in
              </span>
            </div>
            <div className="ws-voucher-code">
              <span className="ws-voucher-label">Booking reference</span>
              <code>{detail.bookingNumber}</code>
            </div>
            <dl className="ws-voucher-facts">
              {leadName && (
                <div>
                  <dt>Lead traveler</dt>
                  <dd>{leadName}</dd>
                </div>
              )}
              {party.total > 0 && (
                <div>
                  <dt>Travelers</dt>
                  <dd>{partyLabel(party)}</dd>
                </div>
              )}
              <div>
                <dt>Date</dt>
                <dd>{formatFullDate(travelDate)}</dd>
              </div>
            </dl>
            <button type="button" className="bk-btn bk-btn-secondary bk-btn-sm no-print" onClick={() => window.print()}>
              <Printer size={14} /> Download PDF ticket
            </button>
          </section>

          {/* Trip details */}
          <section className="ws-card">
            <h2 className="ws-card-title">Trip details</h2>
            <dl className="ws-grid">
              <div className="ws-grid-row">
                <dt><CalendarDays size={15} /> Date</dt>
                <dd>{formatFullDate(travelDate)}</dd>
              </div>
              <div className="ws-grid-row">
                <dt><Clock size={15} /> Start</dt>
                <dd>{startLabel(detail, pickupTime)}</dd>
              </div>
              <div className="ws-grid-row">
                <dt><Users size={15} /> Travelers</dt>
                <dd>
                  {partyLabel(party) || '—'}
                  {Array.isArray(travelers.details) && travelers.details.length > 1 && (
                    <span className="ws-subtext">
                      {travelers.details
                        .map(
                          (t, i) =>
                            `${t.name || `Traveler ${i + 1}`}${t.ageGroup ? ` · ${t.ageGroup}` : ''}`
                        )
                        .join(', ')}
                    </span>
                  )}
                </dd>
              </div>
              {pickupInstructionsText && (
                <div className="ws-grid-row">
                  <dt><Info size={15} /> Additional info</dt>
                  <dd>
                    <span className="ws-subtext">{pickupInstructionsText}</span>
                  </dd>
                </div>
              )}
              {hasDropoff && (
                <div className="ws-grid-row">
                  <dt><Navigation size={15} /> Drop-off</dt>
                  <dd>
                    {dropoffLocationName && <span>{dropoffLocationName}</span>}
                    {dropoffLocationAddr && dropoffLocationAddr !== dropoffLocationName && (
                      <span className="ws-subtext">{dropoffLocationAddr}</span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
            {typeof detail.specialRequests === 'string' && detail.specialRequests && (
              <p className="ws-note">
                Special requests: {detail.specialRequests}
              </p>
            )}
          </section>

          {/* Know before you go */}
          {(includedItems.length > 0 || excludedItems.length > 0 || knowBeforeYouGo || highlights.length > 0) && (
            <KnowBeforeYouGo
              included={includedItems}
              excluded={excludedItems}
              notes={knowBeforeYouGo}
              highlights={highlights}
            />
          )}

          {/* Itinerary */}
          {itinerary.length > 0 && (
            <ItineraryAccordion
              itinerary={itinerary}
              meeting={meeting}
              dropoff={productContent ? {
                dropoffOption: productContent.dropoffOption,
                dropoffLocation: productContent.dropoffLocation?.name,
                dropoffLocationAddress: productContent.dropoffLocation?.address,
              } : undefined}
            />
          )}

          {/* Where to go */}
          {(bookingIsPickup || hasMeeting) && (
            <section className="ws-card">
              <h2 className="ws-card-title">Where to go</h2>
              {bookingIsPickup ? (
                pickupDeferred || !pickupPrimary ? (
                  <div className="ws-amber">
                    <p className="ws-amber-title">
                      {pickupDeferred ? 'Pickup location not yet assigned' : 'Pickup details pending'}
                    </p>
                    <p className="ws-amber-text">
                      We&rsquo;ll contact you to arrange it, or add your location now.
                    </p>
                    {activeStatus && (
                      <button
                        type="button"
                        className="bk-btn bk-btn-primary bk-btn-sm no-print"
                        onClick={() => navigate(`/booking/${detail.id}/pickup`)}
                      >
                        Add pickup location
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {mapPoint && (
                      <BookingPointMap lat={mapPoint.lat} lng={mapPoint.lng} label={pickupAddressText || pickupLocation} />
                    )}
                    <div className="ws-loc">
                      <p className="ws-loc-kicker">
                        <MapPin size={13} /> {pickupKicker}
                      </p>
                      <p className="ws-loc-title">{pickupPrimary}</p>
                    </div>
                    {pickupOutOfZone && (
                      <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-xs font-medium leading-relaxed text-amber-800">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                        This pickup location is outside the pickup zone. Please confirm a pickup location within the zone before your tour date.
                      </p>
                    )}
                    {activeStatus && (
                      <button
                        type="button"
                        className="ws-link no-print"
                        onClick={() => navigate(`/booking/${detail.id}/pickup`)}
                      >
                        Update pickup
                      </button>
                    )}
                  </>
                )
              ) : hasMeeting ? (
                <>
                  {mapPoint && (
                    <BookingPointMap
                      lat={mapPoint.lat}
                      lng={mapPoint.lng}
                      label={[meeting.meetingPoint, meeting.meetingPointAddress].filter(Boolean).join(' — ')}
                    />
                  )}
                  <div className="ws-loc">
                    <p className="ws-loc-kicker">
                      <MapPin size={13} /> Meeting point
                    </p>
                    <p className="ws-loc-title">
                      {[meeting.meetingPoint, meeting.meetingPointAddress].filter(Boolean).join(' — ')}
                    </p>
                    {arrivalLabel && <p className="ws-loc-sub">{arrivalLabel}</p>}
                    {meeting.meetingPointDescription && (
                      <p className="ws-loc-sub">{meeting.meetingPointDescription}</p>
                    )}
                  </div>
                </>
              ) : null}
            </section>
          )}
        </div>

        {/* Right rail — actions + operator */}
        <aside className="ws-aside no-print">
          {/* Manage this booking */}
          <section className="ws-card ws-manage-card">
            <h2 className="ws-card-title">Manage your booking</h2>

            {/* Review invitation — completed + paid + travel date passed + not yet reviewed */}
            {canWriteReview && (
              <div className="ws-review-invite">
                <p className="ws-review-invite-label">Booking complete</p>
                <h3 className="ws-review-invite-title">Your trip is complete</h3>
                <p className="ws-review-invite-text">
                  How was it? Share your experience to help other travelers choose well.
                </p>
                <button
                  type="button"
                  className="bk-btn bk-btn-primary ws-action-btn"
                  onClick={handleWriteReview}
                >
                  Write a review now
                </button>
              </div>
            )}

            {/* Self-service edits — party size / date / time */}
            {activeStatus && detail?.modify?.allowed === true && (
              <div className="ws-manage-section ws-modify-section">
                <p className="ws-manage-label">Changes</p>
                <p className="ws-manage-policy">
                  {detail.modify.pendingPayment
                    ? 'A change on this booking is waiting to be paid.'
                    : 'Need to adjust the date, time or number of travellers?'}
                </p>
                {detail.modify.deadline && (
                  <p className="ws-manage-deadline">
                    <Clock size={13} />
                    Changes open until {formatDeadlineLabel(detail.modify.deadline)}
                  </p>
                )}
                <button
                  type="button"
                  className="bk-btn bk-btn-secondary ws-action-btn"
                  onClick={() => navigate(`/dashboard/bookings/${encodeURIComponent(detail.id)}/modify`)}
                >
                  {detail.modify.pendingPayment ? 'Review pending change' : 'Edit trip'}
                </button>
              </div>
            )}

            {/* Cancellation info */}
            {activeStatus && (
              <div className="ws-manage-section">
                <p className="ws-manage-label">Cancellation policy</p>
                {policyNote && <p className="ws-manage-policy">{policyNote}</p>}
                {cancellation.deadline && cancellation.allowed && (
                  <p className="ws-manage-deadline">
                    <Clock size={13} />
                    Deadline: {formatDeadlineLabel(cancellation.deadline)}
                  </p>
                )}
                {showCancel && (
                  <button
                    type="button"
                    className="bk-btn bk-btn-danger ws-action-btn"
                    onClick={handleCancel}
                    disabled={cancelBooking.isPending}
                  >
                    {cancelBooking.isPending ? 'Cancelling…' : 'Cancel booking'}
                  </button>
                )}
                {cancelError && <p className="ws-cancel-error">{cancelError}</p>}
              </div>
            )}

            {!activeStatus && policyNote && (
              <div className="ws-manage-section">
                <p className="ws-manage-policy">{policyNote}</p>
              </div>
            )}

            {/* Contact provider */}
            {supplierName && (
              <div className="ws-manage-section ws-manage-contact">
                <p className="ws-manage-label">Organized by</p>
                <div className="ws-operator-row">
                  {operatorPhoto ? (
                    <button
                      type="button"
                      className="ws-operator-avatar-btn"
                      onClick={handleMessageOperator}
                      title={`Message ${supplierName}`}
                    >
                      <img src={operatorPhoto} alt={supplierName} className="ws-operator-avatar" />
                      <span className="ws-operator-avatar-badge">
                        <MessageCircle size={11} />
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ws-operator-avatar-btn ws-operator-avatar-fallback"
                      onClick={handleMessageOperator}
                      title={`Message ${supplierName}`}
                    >
                      <span className="ws-operator-avatar-initial">
                        {supplierName.charAt(0).toUpperCase()}
                      </span>
                      <span className="ws-operator-avatar-badge">
                        <MessageCircle size={11} />
                      </span>
                    </button>
                  )}
                  <div className="ws-operator-info">
                    <p className="ws-manage-operator">{supplierName}</p>
                    {supplierPhone && (
                      <a className="ws-operator-phone" href={`tel:${supplierPhone}`}>
                        <Phone size={12} /> {supplierPhone}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Need help? */}
          <section className="ws-card">
            <h2 className="ws-card-title">Need help?</h2>
            <p className="ws-help-text">
              For questions about meeting or pickup point, activity details, or special requests, contact your activity provider.
            </p>
            {supplierPhone && (
              <a className="ws-help-link" href={`tel:${supplierPhone}`}>
                <Phone size={14} /> {supplierPhone}
              </a>
            )}
            <button
              type="button"
              className="bk-btn bk-btn-secondary ws-action-btn"
              onClick={handleMessageOperator}
            >
              <MessageCircle size={15} /> Message your activity provider
            </button>
          </section>
        </aside>
      </div>

      {/* Footer message */}
      <div className="ws-footer-thanks">
        <p className="ws-thanks-text">
          <strong>Thanks for booking with us and enjoy your journey.</strong>
        </p>
      </div>

      {/* Recommended experiences near the tour location */}
      {detail?.tourId && (
        <RecommendedExperiences
          tourId={detail.tourId}
          location={tour?.destinationCity || tour?.city || tour?.country || ''}
        />
      )}

      {/* Cancel booking confirmation modal */}
      <CancelBookingModal
        isOpen={cancelModalOpen}
        onClose={() => { if (!cancelBooking.isPending) setCancelModalOpen(false) }}
        onConfirm={handleCancelConfirm}
        isPending={cancelBooking.isPending}
        error={cancelError}
        refundPct={cancellation.allowed ? cancellation.refundPct : 0}
        isPaid={isPaid}
        bookingNumber={detail?.bookingNumber}
        tourTitle={tour?.title}
        refundAmount={cancellation.allowed && cancellation.refundPct > 0 && isPaid ? gross * cancellation.refundPct / 100 : undefined}
        currency={currency}
      />
    </div>
  )
}
