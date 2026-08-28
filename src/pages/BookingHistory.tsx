import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { X, MapPin, Calendar, Users, Ticket, CreditCard, Phone, Info, AlertTriangle, Clock } from 'lucide-react'
import { Button } from '../components/ui/button'
import { currencySymbol } from '../lib/currencySymbol'
import {
  useMyExpeditionBookings,
  useExpeditionBookingDetail,
  useCancelBooking,
  type ExpeditionBookingSummary,
} from '../hooks/useExpeditionBookings'
import { extractMeetingInfo, extractAvailabilitySchedule } from '../hooks/useExpeditionTours'
import { formatTime12h, weeklyHoursRange, openingHoursForDay, formatTimeSlotList } from '../lib/tourAvailability'
import './BookingHistory.css'
import OptimizedImage from '@/components/shared/OptimizedImage'

type TabStatus = 'ALL' | 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

interface TravelersJson {
  adults?: number
  children?: number
  infants?: number
  phoneNumber?: string
  location?: string
  details?: { name?: string; age?: number | string; ageGroup?: string; specialRequests?: string }[]
}

export default function BookingHistory() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabStatus>('ALL')
  const [selectedBooking, setSelectedBooking] = useState<ExpeditionBookingSummary | null>(null)
  const [modalTab, setModalTab] = useState<'tour' | 'travelers'>('tour')
  const [cancelError, setCancelError] = useState<string | null>(null)

  const {
    data: bookings = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useMyExpeditionBookings(1, activeTab === 'ALL' ? undefined : activeTab, 100)

  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailError,
  } = useExpeditionBookingDetail(selectedBooking?.id)

  const cancelBooking = useCancelBooking()

  const travelers = (detail?.travelers ?? {}) as TravelersJson
  const participantCount =
    travelers.details?.length ??
    (travelers.adults || 0) + (travelers.children || 0) + (travelers.infants || 0)

  const detailTour = detail?.tour
  const meeting = useMemo(() => extractMeetingInfo(detailTour ?? {}), [detailTour])
  const schedule = useMemo(() => extractAvailabilitySchedule(detailTour ?? {}), [detailTour])

  const timeLabel = (() => {
    if (detail?.selectedTime) return formatTime12h(detail.selectedTime)
    if (schedule.scheduleType === 'operatingHours') {
      const day = detail?.travelDate ? openingHoursForDay(schedule, new Date(detail.travelDate)) : ''
      if (day) return day
      const range = weeklyHoursRange(schedule)
      if (range) return range
    }
    if (schedule.timeSlots.length > 0) return formatTimeSlotList(schedule.timeSlots)
    return 'Flexible'
  })()

  const arrivalLabel = (() => {
    if (meeting.meetingMode !== 'meeting_point') return ''
    if (meeting.arrivalTimeType === 'custom') return meeting.arrivalTimeCustom ? `Arrive by ${meeting.arrivalTimeCustom}` : ''
    switch (meeting.arrivalTimeType) {
      case '5min': return 'Arrive 5 minutes before the activity'
      case '10min': return 'Arrive 10 minutes before the activity'
      case '15min': return 'Arrive 15 minutes before the activity'
      case '30min': return 'Arrive 30 minutes before the activity'
      case 'notified': return 'Arrival time will be notified'
      default: return ''
    }
  })()

  const hasMeeting = meeting.meetingMode === 'meeting_point' && (meeting.meetingPoint || meeting.meetingPointAddress || arrivalLabel)
  const pickupAreas = (meeting.pickupAreas || []).filter((a: { name?: string; address?: string }) => a && (a.name || a.address))
  const pickupLocations = (meeting.pickupLocations || []).filter((l: { name?: string; address?: string }) => l && (l.name || l.address))
  const hasPickup = meeting.meetingMode === 'pickup' && (pickupAreas.length > 0 || pickupLocations.length > 0 || meeting.pickupDescription)

  const price = (v?: number | string | null) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  const sym = (c?: string) => (c === 'GHS' ? 'GH₵' : c === 'EUR' ? '€' : c === 'GBP' ? '£' : '$')
  const showBreakdown = detail && (price(detail.subtotal) > 0 || price(detail.taxes) > 0 || price(detail.fees) > 0 || price(detail.discounts) > 0)

  const openBooking = (booking: ExpeditionBookingSummary) => {
    setModalTab('tour')
    setCancelError(null)
    setSelectedBooking(booking)
  }

  const closeBooking = () => {
    setSelectedBooking(null)
    setCancelError(null)
  }

  const handleCancel = () => {
    if (!selectedBooking) return
    setCancelError(null)
    const confirmed = window.confirm(
      'Cancel this booking? Refunds are processed per the tour cancellation policy.'
    )
    if (!confirmed) return

    cancelBooking.mutate(
      { id: selectedBooking.id, reason: 'Customer requested cancellation' },
      {
        onSuccess: () => closeBooking(),
        onError: (err: Error) => setCancelError(err.message),
      }
    )
  }

  const tabs: { value: TabStatus; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'CONFIRMED', label: 'Confirmed' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ]

  // Lock background scroll while the details modal is open
  useEffect(() => {
    if (!selectedBooking) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [selectedBooking])

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'COMPLETED':
        return 'status-completed'
      case 'PENDING':
      case 'CONFIRMED':
        return status === 'CONFIRMED' ? 'status-confirmed' : 'status-pending'
      case 'CANCELLED':
        return 'status-cancelled'
      default:
        return ''
    }
  }

  const statusLabel = (status: string) => STATUS_LABELS[status] ?? status

  const listStatus = isError
    ? 'error'
    : isLoading
      ? 'loading'
      : 'ready'

  return (
    <div className="booking-history">
      <div className="booking-tabs-container">
        <div className="booking-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              className={`booking-tab ${activeTab === tab.value ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
              {activeTab === tab.value && (
                <motion.div
                  layoutId="booking-tab-indicator"
                  className="booking-tab-indicator"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="booking-content">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {listStatus === 'error' && (
              <div className="empty-state">
                <div className="empty-icon">
                  <AlertTriangle size={40} />
                </div>
                <motion.h3
                  className="empty-title"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                >
                  Couldn't load your bookings
                </motion.h3>
                <motion.p
                  className="empty-text"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                >
                  {(error as Error)?.message || 'Something went wrong while fetching your bookings.'}
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                >
                  <Button onClick={() => refetch()} className="empty-cta">
                    Try Again
                  </Button>
                </motion.div>
              </div>
            )}

            {listStatus === 'loading' && (
              <div className="empty-state">
                <div className="loading-spinner" />
                <motion.h3
                  className="empty-title"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                >
                  Loading your bookings…
                </motion.h3>
              </div>
            )}

            {listStatus === 'ready' && bookings.length === 0 && (
              <div
                className="empty-state"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    delay: 0.2,
                    type: "spring",
                    stiffness: 200,
                    damping: 15
                  }}
                >
                  <motion.svg
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="empty-icon"
                    animate={{
                      rotate: [0, 360]
                    }}
                    transition={{
                      duration: 20,
                      repeat: Infinity,
                      ease: "linear"
                    }}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <motion.polyline
                      points="12 6 12 12 16 14"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1, delay: 0.3 }}
                    />
                  </motion.svg>
                </motion.div>

                <motion.h3
                  className="empty-title"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                >
                  No Booking History
                </motion.h3>

                <motion.p
                  className="empty-text"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.4 }}
                >
                  You haven't made any bookings yet. Start exploring our amazing tours!
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.4 }}
                >
                  <Button onClick={() => window.location.href = '/'} className="empty-cta">
                    Find an Experience
                  </Button>
                </motion.div>

                {[0, 30, 60].map((angle, i) => (
                  <motion.div
                    key={i}
                    className="clock-tick"
                    style={{
                      transform: `rotate(${angle}deg) translateY(-40px)`,
                      position: 'absolute',
                      top: '50%',
                      left: '50%'
                    }}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                      opacity: [0, 0.2, 0],
                      scale: [0, 1.5, 0]
                    }}
                    transition={{
                      duration: 2,
                      delay: 1.5 + i * 0.3,
                      repeat: Infinity,
                      repeatDelay: 2
                    }}
                  >
                    <div style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      background: 'var(--dash-accent)'
                    }} />
                  </motion.div>
                ))}
              </div>
            )}

            {listStatus === 'ready' && bookings.length > 0 && (
              <div className="booking-list">
                {bookings.map((booking) => (
                  <div key={booking.id} className="booking-item">
                    <div className="booking-item-image">
                      {booking.tourImage ? (
                        <OptimizedImage src={booking.tourImage} alt={booking.tourTitle} width={200} />
                      ) : (
                        <div className="booking-item-image-placeholder" />
                      )}
                      <span className={`booking-status-badge ${getStatusColor(booking.status)}`}>
                        {statusLabel(booking.status)}
                      </span>
                      {booking.paymentTiming === 'later' && booking.paymentStatus !== 'SUCCEEDED' && (
                        <span className="booking-awaiting-payment">Awaiting payment</span>
                      )}
                    </div>

                    <div className="booking-item-content">
                      <div className="booking-item-header">
                        <h3 className="booking-item-title">{booking.tourTitle}</h3>
                        <div className="booking-item-location">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span>{booking.tourLocation || '—'}</span>
                        </div>
                      </div>

                      <div className="booking-item-details">
                        <div className="booking-detail">
                          <span className="booking-detail-label">Date</span>
                          <span className="booking-detail-value">
                            {new Date(booking.travelDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                        <div className="booking-detail">
                          <span className="booking-detail-label">Confirmation</span>
                          <span className={`booking-detail-value booking-code`}>{booking.bookingNumber}</span>
                        </div>
                        <div className="booking-detail">
                          <span className="booking-detail-label">Total</span>
                          <span className={`booking-detail-value booking-price`}>
                            {currencySymbol(booking.currency)}{booking.total.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="booking-item-footer">
                        <Button size="sm" className="booking-view-btn" onClick={() => openBooking(booking)}>
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Booking Details Modal */}
      <AnimatePresence>
        {selectedBooking && (
          <motion.div
            className="booking-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            onClick={closeBooking}
          >
            <motion.div
              className="booking-modal"
              initial={{ opacity: 0, y: 40, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              transition={{
                type: 'spring',
                stiffness: 320,
                damping: 30,
                mass: 0.9,
                opacity: { duration: 0.2, ease: 'easeOut' },
              }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Booking details"
            >
              <button
                className="booking-modal-close"
                onClick={closeBooking}
                aria-label="Close details"
              >
                <X size={18} />
              </button>

              {/* Hero image */}
              <div className="booking-modal-hero">
                {selectedBooking.tourImage ? (
                  <OptimizedImage src={selectedBooking.tourImage} alt={selectedBooking.tourTitle} width={200} />
                ) : (
                  <div className="booking-modal-hero-placeholder" />
                )}
                <div className="booking-modal-hero-overlay" />
                <span className={`booking-status-badge booking-modal-status ${getStatusColor(selectedBooking.status)}`}>
                  {statusLabel(selectedBooking.status)}
                </span>
                <div className="booking-modal-hero-text">
                  <h3 className="booking-modal-title">{selectedBooking.tourTitle}</h3>
                  <div className="booking-modal-location">
                    <MapPin size={15} />
                    <span>{selectedBooking.tourLocation || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="booking-modal-tabs">
                <button
                  className={`booking-modal-tab ${modalTab === 'tour' ? 'active' : ''}`}
                  onClick={() => setModalTab('tour')}
                >
                  Tour Details
                  {modalTab === 'tour' && (
                    <motion.span layoutId="booking-modal-tab-indicator" className="booking-modal-tab-indicator" />
                  )}
                </button>
                <button
                  className={`booking-modal-tab ${modalTab === 'travelers' ? 'active' : ''}`}
                  onClick={() => setModalTab('travelers')}
                >
                  Travelers
                  {modalTab === 'travelers' && (
                    <motion.span layoutId="booking-modal-tab-indicator" className="booking-modal-tab-indicator" />
                  )}
                </button>
              </div>

              {/* Tab panels */}
              <div className="booking-modal-body">
                <AnimatePresence mode="wait">
                  {modalTab === 'tour' ? (
                    <motion.div
                      key="tour"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.22, ease: 'easeInOut' }}
                      className="booking-modal-tour"
                    >
                      <div className="booking-modal-grid">
                        <div className="booking-modal-detail">
                          <div className="booking-modal-detail-icon"><Ticket size={16} /></div>
                          <div>
                            <span className="booking-modal-detail-label">Confirmation</span>
                            <span className="booking-modal-detail-value">{selectedBooking.bookingNumber}</span>
                          </div>
                        </div>
                        <div className="booking-modal-detail">
                          <div className="booking-modal-detail-icon"><Calendar size={16} /></div>
                          <div>
                            <span className="booking-modal-detail-label">Date</span>
                            <span className="booking-modal-detail-value">
                              {new Date(selectedBooking.travelDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                        <div className="booking-modal-detail">
                          <div className="booking-modal-detail-icon"><Clock size={16} /></div>
                          <div>
                            <span className="booking-modal-detail-label">{schedule.scheduleType === 'fixedTimeSlot' ? 'Time slots' : 'Opening hours'}</span>
                            <span className="booking-modal-detail-value">{timeLabel}</span>
                          </div>
                        </div>
                        <div className="booking-modal-detail">
                          <div className="booking-modal-detail-icon"><MapPin size={16} /></div>
                          <div>
                            <span className="booking-modal-detail-label">Location</span>
                            <span className="booking-modal-detail-value">{selectedBooking.tourLocation || '—'}</span>
                          </div>
                        </div>
                        <div className="booking-modal-detail">
                          <div className="booking-modal-detail-icon"><Users size={16} /></div>
                          <div>
                            <span className="booking-modal-detail-label">Participants</span>
                            <span className="booking-modal-detail-value">
                              {detailLoading ? '…' : `${participantCount} ${participantCount === 1 ? 'Person' : 'People'}`}
                            </span>
                          </div>
                        </div>
                        <div className="booking-modal-detail">
                          <div className="booking-modal-detail-icon"><CreditCard size={16} /></div>
                          <div>
                            <span className="booking-modal-detail-label">Total Paid</span>
                            <span className="booking-modal-detail-value booking-modal-price">
                              {selectedBooking.currency === 'GHS' ? 'GH₵' : '$'}{selectedBooking.total.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {(hasMeeting || hasPickup) && (
                        <div className="booking-modal-section">
                          <span className="booking-modal-section-title">Meeting &amp; Pickup</span>
                          {hasMeeting && (
                            <p className="booking-modal-text">
                              <strong>{meeting.meetingPoint}</strong>
                              {meeting.meetingPointAddress && meeting.meetingPointAddress !== meeting.meetingPoint ? ` — ${meeting.meetingPointAddress}` : ''}
                            </p>
                          )}
                          {arrivalLabel && <p className="booking-modal-text">{arrivalLabel}</p>}
                          {meeting.meetingPointDescription && <p className="booking-modal-text">{meeting.meetingPointDescription}</p>}
                          {pickupAreas.length > 0 && (
                            <p className="booking-modal-text">Pickup areas: {pickupAreas.map((a: { name?: string; address?: string }) => a.name || a.address).join(', ')}</p>
                          )}
                          {pickupLocations.length > 0 && (
                            <p className="booking-modal-text">Pickup locations: {pickupLocations.map((l: { name?: string; address?: string }) => l.name || l.address).join(', ')}</p>
                          )}
                        </div>
                      )}

                      {showBreakdown && (
                        <div className="booking-modal-section">
                          <span className="booking-modal-section-title">Price Breakdown</span>
                          <div className="booking-modal-price-grid">
                            <span>Subtotal</span><span>{sym(detail.currency)}{price(detail.subtotal).toFixed(2)}</span>
                            {price(detail.fees) > 0 && (<><span>Fees</span><span>{sym(detail.currency)}{price(detail.fees).toFixed(2)}</span></>)}
                            {price(detail.taxes) > 0 && (<><span>Taxes</span><span>{sym(detail.currency)}{price(detail.taxes).toFixed(2)}</span></>)}
                            {price(detail.discounts) > 0 && (<><span>Discount</span><span>-{sym(detail.currency)}{price(detail.discounts).toFixed(2)}</span></>)}
                            <span className="booking-modal-price-total">Total</span>
                            <span className="booking-modal-price-total">{sym(detail.currency)}{price(detail.total).toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      <button className="booking-modal-view-confirmation" onClick={() => navigate(`/booking/confirmation/${selectedBooking.id}`)}>
                        View full confirmation →
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="travelers"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.22, ease: 'easeInOut' }}
                      className="booking-modal-customer"
                    >
                      {detailError ? (
                        <div className="booking-modal-customer-row">
                          <Info size={15} />
                          <span>Couldn't load traveler details.</span>
                        </div>
                      ) : detailLoading ? (
                        <div className="booking-modal-customer-row">
                          <Info size={15} />
                          <span>Loading traveler details…</span>
                        </div>
                      ) : (
                        <>
                          <div className="booking-modal-customer-head">
                            <div className="booking-modal-avatar">
                              <Users size={16} />
                            </div>
                            <div>
                              <span className="booking-modal-customer-name">
                                {travelers.adults || 0} Adult{travelers.adults === 1 ? '' : 's'}
                                {travelers.children ? `, ${travelers.children} Children` : ''}
                                {travelers.infants ? `, ${travelers.infants} Infants` : ''}
                              </span>
                              <span className="booking-modal-customer-sub">Party summary</span>
                            </div>
                          </div>

                          <div className="booking-modal-customer-list">
                            {travelers.details?.map((t, i) => (
                              <div key={i} className="booking-modal-customer-row">
                                <Users size={15} />
                                <span>
                                  {t.name || `Traveler ${i + 1}`}
                                  {t.age != null ? ` (${t.age})` : ''}
                                  {t.ageGroup ? ` — ${t.ageGroup}` : ''}
                                  {t.specialRequests ? ` · ${t.specialRequests}` : ''}
                                </span>
                              </div>
                            ))}
                            {travelers.phoneNumber && (
                              <div className="booking-modal-customer-row">
                                <Phone size={15} />
                                <span>{travelers.phoneNumber}</span>
                              </div>
                            )}
                            {travelers.location && (
                              <div className="booking-modal-customer-row">
                                <MapPin size={15} />
                                <span>{travelers.location}</span>
                              </div>
                            )}
                            {detail.specialRequests && (
                              <div className="booking-modal-customer-row">
                                <Info size={15} />
                                <span>{detail.specialRequests}</span>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="booking-modal-footer">
                {cancelError && (
                  <p className="booking-modal-cancel-error">{cancelError}</p>
                )}
                {(selectedBooking.status === 'PENDING' || selectedBooking.status === 'CONFIRMED') && (
                  <Button
                    className="booking-modal-cancel-btn"
                    onClick={handleCancel}
                    disabled={cancelBooking.isPending}
                  >
                    {cancelBooking.isPending ? 'Cancelling…' : 'Cancel Booking'}
                  </Button>
                )}
                <Button className="booking-modal-close-btn" onClick={closeBooking}>
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}