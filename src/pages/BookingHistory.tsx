import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import { useSearchParams, useLocation, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Ticket, AlertTriangle, ArrowRight, CheckCircle2, Wallet, RotateCcw } from 'lucide-react'
import {
  useMyExpeditionBookings,
  useMyBookingsCount,
  type ExpeditionBookingSummary,
} from '../hooks/useExpeditionBookings'
import { useMoodKeywords } from '../hooks/useHomepageSections'
import { useAuthUser } from '@/hooks/useAuthUser'
import BookingCard from '../components/booking/BookingCard'
import RequestRefundModal from '../components/booking/RequestRefundModal'
import TravelEmptyAnimation from '../components/booking/TravelEmptyAnimation'
const BookingWorkspace = lazy(() => import('../components/booking/BookingWorkspace'))
import { formatHeadingDate, toDateKey, isSameCalendarDay } from '../lib/bookingUi'
import { writeBookingsSeen } from '../lib/bookingsBadge'
import { currencySymbol } from '../lib/currencySymbol'
import '../components/booking/bookingTheme.css'
import './BookingHistory.css'

type Bucket = 'upcoming' | 'confirmed' | 'reserved' | 'cancelled' | 'refund' | 'past'

const BUCKETS: { value: Bucket; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refund', label: 'Refund' },
  { value: 'past', label: 'Past' },
]

type Booking = ExpeditionBookingSummary

function formatSpent(amount: number, currency: string): string {
  const symbol = currencySymbol(currency)
  const rounded = Math.round((amount || 0) * 100) / 100
  if (rounded >= 1000) return `${symbol}${(rounded / 1000).toFixed(1)}k`
  return `${symbol}${rounded.toFixed(2)}`
}

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED']

function isActiveBooking(status: string): boolean {
  return ACTIVE_STATUSES.includes(status)
}

/** Unpaid reserve-now-pay-later — always tagged "Reserved". */
function isReservedBooking(b: Booking): boolean {
  return isActiveBooking(b.status) && b.paymentTiming === 'later' && b.paymentStatus !== 'SUCCEEDED'
}

/** Paid = the money actually settled (SUCCEEDED) or legacy pay-now records. */
function isPaidBooking(b: Booking): boolean {
  return b.paymentStatus === 'SUCCEEDED' || b.paymentTiming === 'now'
}

function hasRefundLifecycle(b: Booking): boolean {
  return b.refundState === 'open' || b.refundState === 'closed'
}

function isCancelledBooking(b: Booking): boolean {
  return b.status === 'CANCELLED' && !hasRefundLifecycle(b)
}

function isFinishedBooking(b: Booking): boolean {
  return b.status === 'COMPLETED' || b.status === 'NO_SHOW'
}

/** Travel date is today or later. */
function isUpcomingDate(b: Booking): boolean {
  return dateMs(b.travelDate) >= startOfToday()
}

/** Active, not refunded/cancelled, and still ahead of (or on) its date. */
function isActiveUpcoming(b: Booking): boolean {
  if (!isActiveBooking(b.status)) return false
  if (hasRefundLifecycle(b) || b.status === 'CANCELLED') return false
  return isUpcomingDate(b)
}

/**
 * A booking may belong to more than one tab — a reserve-now-pay-later trip is
 * both "Upcoming" and "Reserved", and a paid trip is both "Upcoming" and
 * "Confirmed". This keeps the default Upcoming view a true catch-all while the
 * Confirmed/Reserved tabs are quick paid/unpaid filters.
 */
function belongsToTab(b: Booking, tab: Bucket): boolean {
  switch (tab) {
    case 'upcoming':
      return isActiveUpcoming(b) && (isPaidBooking(b) || isReservedBooking(b))
    case 'confirmed':
      return isActiveUpcoming(b) && isPaidBooking(b)
    case 'reserved':
      return isReservedBooking(b)
    case 'refund':
      return hasRefundLifecycle(b)
    case 'cancelled':
      return isCancelledBooking(b)
    case 'past':
      if (isFinishedBooking(b)) return true
      // Paid trips whose date already passed (and aren't auto-completed yet)
      // read as Past — but keep refunds/cancellations in their own tabs.
      return (
        isPaidBooking(b) &&
        isActiveBooking(b.status) &&
        !hasRefundLifecycle(b) &&
        b.status !== 'CANCELLED' &&
        !isUpcomingDate(b)
      )
    default:
      return false
  }
}

function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function dateMs(value: string): number {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? 0 : d.getTime()
}

function groupHeading(dateKey: string, labelForHeading: string): string {
  const today = new Date()
  const target = new Date(dateKey + 'T00:00:00')
  if (isSameCalendarDay(target, today)) return 'Today'
  const tomorrow = new Date(today.getTime() + 86400000)
  if (isSameCalendarDay(target, tomorrow)) return 'Tomorrow'
  return labelForHeading
}

export default function BookingHistory() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const bookingId = searchParams.get('booking')
  const listScrollRef = useRef(0)
  const user = useAuthUser()

  const [bucket, setBucket] = useState<Bucket>('upcoming')
  const [query, setQuery] = useState('')
  const [refundBooking, setRefundBooking] = useState<Booking | null>(null)

  const { data: bookings = [], isLoading, isError, error, refetch } = useMyExpeditionBookings(
    1,
    undefined,
    100
  )

  // Curated "ways to explore" chips for the zero-bookings state (same source
  // as the homepage mood rail — each keyword has live tours behind it).
  const { data: moodKeywords, isLoading: moodsLoading } = useMoodKeywords(4)

  // Live total of CONFIRMED/PENDING bookings — the number the navbar badge
  // compares against. Watching it here keeps the badge's "seen" marker in sync
  // so opening Bookings from any entry point (top tab, bottom bar, mobile
  // drawer, or the navbar icon) dismisses the badge once the list is visible.
  const { data: liveCount } = useMyBookingsCount('CONFIRMED,PENDING', !!user)

  // DashboardLayout keeps every visited pane mounted, so only persist the
  // seen-marker while this Bookings list is the pane actually on screen.
  useEffect(() => {
    if (!user || liveCount == null) return
    if (location.pathname !== '/dashboard/bookings') return
    writeBookingsSeen(liveCount)
  }, [user, liveCount, location.pathname])

  // Banner stats
  const bannerStats = useMemo(() => {
    const c: Record<Bucket, number> = { upcoming: 0, confirmed: 0, reserved: 0, cancelled: 0, refund: 0, past: 0 }
    let totalSpent = 0
    let spentCurrency: string | null = null
    for (const b of bookings) {
      for (const tab of Object.keys(c) as Bucket[]) {
        if (belongsToTab(b, tab)) c[tab] += 1
      }
      // Only count money actually paid (not reserved/refunded/cancelled).
      if (b.paymentStatus === 'SUCCEEDED' && !hasRefundLifecycle(b)) {
        totalSpent += b.total ?? 0
        if (!spentCurrency) spentCurrency = b.currency
      }
    }
    return { total: bookings.length, ...c, totalSpent, spentCurrency }
  }, [bookings])

  // Next upcoming trip for the greeting
  const nextTrip = useMemo(() => {
    const now = new Date()
    const upcoming = bookings
      .filter((b) => isActiveBooking(b.status) && new Date(b.travelDate) > now)
      .sort((a, b) => new Date(a.travelDate).getTime() - new Date(b.travelDate).getTime())
    return upcoming[0] ?? null
  }, [bookings])

  const daysUntilNext = useMemo(() => {
    if (!nextTrip) return null
    // eslint-disable-next-line react-hooks/purity -- wall-clock label intentionally uses Date.now
    const diff = Math.ceil((new Date(nextTrip.travelDate).getTime() - Date.now()) / 86400000)
    return diff <= 0 ? 'today' : diff === 1 ? 'tomorrow' : `in ${diff} days`
  }, [nextTrip])

  // Open a booking without changing the route — the list below stays mounted.
  const openBooking = (booking: ExpeditionBookingSummary) => {
    setSearchParams({ booking: booking.id }, { replace: false })
  }

  const closeDetail = () => {
    setSearchParams({})
  }

  /** Same eligibility as the workspace detail (COMPLETED + paid + not reviewed). */
  const isReviewable = (b: Booking): boolean =>
    b.status === 'COMPLETED' &&
    isPaidBooking(b) &&
    !hasRefundLifecycle(b) &&
    !b.reviewed &&
    // eslint-disable-next-line react-hooks/purity -- wall-clock read for review eligibility
    dateMs(b.travelDate) <= Date.now()

  const openReview = (b: Booking) => {
    const title = b.tourTitle
    const slug =
      b.tourSlug ||
      title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    navigate(`/review/${encodeURIComponent(slug)}`, {
      state: {
        tour: { title, slug, tourId: b.tourId },
        bookingId: b.id,
        returnTo: `/dashboard/bookings?booking=${encodeURIComponent(b.id)}`,
      },
    })
  }

  // Completed + paid + no refund already open/closed + within the 30-day claim
  // window → the "Request refund" action shows on the card.
  const isClaimable = (b: Booking): boolean =>
    b.status === 'COMPLETED' &&
    isPaidBooking(b) &&
    (b.refundState === undefined || b.refundState === null) &&
    // eslint-disable-next-line react-hooks/purity -- wall-clock read for claim window
    Date.now() - dateMs(b.travelDate) <= 30 * 24 * 60 * 60 * 1000

  // Keep the list's scroll position across the slide.
  useEffect(() => {
    if (bookingId) {
      listScrollRef.current = window.scrollY
      window.scrollTo({ top: 0, behavior: 'auto' })
    } else if (listScrollRef.current) {
      window.scrollTo({ top: listScrollRef.current, behavior: 'auto' })
      listScrollRef.current = 0
    }
  }, [bookingId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = bookings.filter((b) => {
      if (!belongsToTab(b, bucket)) return false
      if (!q) return true
      return (
        b.tourTitle.toLowerCase().includes(q) ||
        b.bookingNumber.toLowerCase().includes(q) ||
        b.tourLocation.toLowerCase().includes(q)
      )
    })

    // Date-forward tabs sort by soonest travel date; the history/status tabs
    // (cancelled / refund / past) sort newest-first.
    const dateForward = bucket === 'upcoming' || bucket === 'confirmed' || bucket === 'reserved'
    return [...base].sort((a, b) =>
      dateForward
        ? dateMs(a.travelDate) - dateMs(b.travelDate)
        : dateMs(b.travelDate) - dateMs(a.travelDate)
    )
  }, [bookings, bucket, query])

  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { upcoming: 0, confirmed: 0, reserved: 0, cancelled: 0, refund: 0, past: 0 }
    for (const b of bookings) {
      for (const tab of Object.keys(c) as Bucket[]) {
        if (belongsToTab(b, tab)) c[tab] += 1
      }
    }
    return c
  }, [bookings])

  const upcomingGroups = useMemo(() => {
    const groups: { key: string; label: string; items: ExpeditionBookingSummary[] }[] = []
    for (const b of filtered) {
      const key = toDateKey(b.travelDate)
      const last = groups[groups.length - 1]
      if (!key) {
        groups.push({ key: 'unknown', label: 'Date not set', items: [b] })
      } else if (last && last.key === key) {
        last.items.push(b)
      } else {
        groups.push({ key, label: groupHeading(key, formatHeadingDate(key)), items: [b] })
      }
    }
    return groups
  }, [filtered])

  const listStatus = isError ? 'error' : isLoading ? 'loading' : 'ready'
  const activeLabel =
    bucket === 'upcoming'
      ? 'upcoming trip'
      : bucket === 'confirmed'
        ? 'confirmed trip'
        : bucket === 'reserved'
          ? 'reserved trip'
          : bucket === 'cancelled'
            ? 'cancelled trip'
            : bucket === 'refund'
              ? 'refund'
              : 'past trip'

  return (
    <div className="bk-page">
      <div className="bk-swap">
        {/* Pane 1 — bookings list (always mounted) */}
        <section
          className={`bk-pane bk-pane-list${bookingId ? ' off' : ' on'}`}
          aria-hidden={!!bookingId}
        >
          {/* Welcome banner */}
          {bookings.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="bk-banner"
            >
              <div className="bk-banner-text">
                <h2 className="bk-banner-greeting">
                  Welcome back, {user?.name?.split(' ')[0] || 'there'}
                </h2>
                <p className="bk-banner-sub">
                  {nextTrip
                    ? <>Your next trip: <strong>{nextTrip.tourTitle}</strong> {daysUntilNext}</>
                    : "Here's an overview of your trips."
                  }
                </p>
              </div>

              <div className="bk-banner-stats">
                <button type="button" className="bk-banner-stat" onClick={() => setBucket('upcoming')}>
                  <span className="bk-banner-stat-dot bg-[var(--bv-success-dot)]" />
                  <span className="bk-banner-stat-value">{bannerStats.upcoming}</span>
                  <span className="bk-banner-stat-label">Upcoming</span>
                </button>
                <button type="button" className="bk-banner-stat" onClick={() => setBucket('reserved')}>
                  <Wallet size={18} className="bk-banner-stat-icon" />
                  <span className="bk-banner-stat-value">{bannerStats.reserved}</span>
                  <span className="bk-banner-stat-label">Reserved</span>
                </button>
                <button type="button" className="bk-banner-stat" onClick={() => setBucket('cancelled')}>
                  <Ticket size={18} className="bk-banner-stat-icon" />
                  <span className="bk-banner-stat-value">{bannerStats.cancelled}</span>
                  <span className="bk-banner-stat-label">Cancelled</span>
                </button>
                <button type="button" className="bk-banner-stat" onClick={() => setBucket('refund')}>
                  <RotateCcw size={18} className="bk-banner-stat-icon" />
                  <span className="bk-banner-stat-value">{bannerStats.refund}</span>
                  <span className="bk-banner-stat-label">Refunded</span>
                </button>
                <button type="button" className="bk-banner-stat" onClick={() => setBucket('past')}>
                  <CheckCircle2 size={18} className="bk-banner-stat-icon" />
                  <span className="bk-banner-stat-value">{bannerStats.past}</span>
                  <span className="bk-banner-stat-label">Past</span>
                </button>
                <div className="bk-banner-stat">
                  <Wallet size={18} className="bk-banner-stat-icon" />
                  <span className="bk-banner-stat-value">
                    {formatSpent(bannerStats.totalSpent, bannerStats.spentCurrency ?? 'USD')}
                  </span>
                  <span className="bk-banner-stat-label">Spent</span>
                </div>
              </div>
            </motion.div>
          )}

          <div className="bk-toolbar">
            <div className="bk-seg" role="group" aria-label="Filter bookings by time">
              {BUCKETS.map((b) => {
                const active = bucket === b.value
                return (
                  <button
                    key={b.value}
                    type="button"
                    className={`bk-seg-btn${active ? ' active' : ''}`}
                    aria-pressed={active}
                    onClick={() => setBucket(b.value)}
                  >
                    {active && <span className="bk-seg-indicator" />}
                    <span className="bk-seg-inner">
                      <span className="bk-seg-label">{b.label}</span>
                      <span className="bk-seg-count">{counts[b.value]}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            <label className="bk-search">
              <Search size={15} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by tour or booking reference"
                aria-label="Search bookings by tour or reference"
              />
            </label>
          </div>

          {listStatus === 'error' ? (
            <div className="bk-state">
              <AlertTriangle size={26} />
              <h3>Couldn't load your bookings</h3>
              <p>{(error as Error)?.message || 'Something went wrong while fetching your bookings.'}</p>
              <button type="button" className="bk-btn bk-btn-primary" onClick={() => refetch()}>
                Try again
              </button>
            </div>
          ) : listStatus === 'loading' ? (
            <div className="bk-list">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bk-card bk-card-skeleton" aria-hidden="true">
                  <div className="bk-media">
                    <div className="bk-skel bk-skel-media" />
                  </div>
                  <div className="bk-body">
                    <div className="bk-skel bk-skel-line bk-skel-w30" />
                    <div className="bk-skel bk-skel-line bk-skel-w80" />
                    <div className="bk-skel bk-skel-line bk-skel-w60" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            bookings.length === 0 && !query ? (
              <motion.div
                className="bk-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                {/* Animated hero */}
                <div className="bk-empty-hero">
                  <motion.div
                    className="bk-empty-anim"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
                  >
                    <TravelEmptyAnimation />
                  </motion.div>

                  <motion.h2
                    className="bk-empty-title"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                  >
                    No trips yet
                  </motion.h2>
                  <motion.p
                    className="bk-empty-text"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                  >
                    Every adventure starts with a booking. Explore unforgettable experiences
                    and we&apos;ll handle the rest. Your trips will live here.
                  </motion.p>

                  <motion.div
                    className="bk-empty-actions"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                  >
                    <Link className="bk-btn bk-btn-primary bk-empty-primary" to="/tours">
                      Browse all tours
                    </Link>
                  </motion.div>
                </div>

                {/* Chips */}
                <motion.div
                  className="bk-empty-chips-block"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                >
                  <p className="bk-empty-chips-label">Popular ways to explore</p>
                  {moodsLoading && !moodKeywords ? (
                    <div className="bk-empty-chips bk-empty-chips-loading" aria-hidden="true">
                      {[0, 1, 2, 3].map((i) => (
                        <span key={i} className="bk-chip-skel" />
                      ))}
                    </div>
                  ) : (
                    moodKeywords && moodKeywords.filter((k) => (k.tourCount ?? 0) > 0).length > 0 && (
                      <div className="bk-empty-chips">
                        {moodKeywords
                          .filter((k) => (k.tourCount ?? 0) > 0)
                          .map((k) => (
                            <Link
                              key={k.keyword}
                              className="bk-empty-chip"
                              to={`/tours?mood=${encodeURIComponent(k.keyword)}`}
                            >
                              {k.keyword}
                            </Link>
                          ))}
                      </div>
                    )
                  )}
                </motion.div>

                {/* How it works */}
                <motion.div
                  className="bk-empty-steps"
                  aria-label="How it works"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.7 }}
                >
                  {[
                    { num: '1', title: 'Pick an experience', desc: 'Browse tours, compare reviews, and find your match.' },
                    { num: '2', title: 'Reserve in seconds', desc: 'Secure your spot instantly with a simple checkout.' },
                    { num: '3', title: 'We confirm & you go', desc: 'Manage your trip and get reminders right here.' },
                  ].map((step) => (
                    <div key={step.num} className="bk-empty-step">
                      <span className="bk-empty-step-num">{step.num}</span>
                      <div>
                        <p className="bk-empty-step-title">{step.title}</p>
                        <p className="bk-empty-step-text">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </motion.div>

                <motion.p
                  className="bk-empty-note"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.8 }}
                >
                  Payments are secure and cancellations are easy.
                </motion.p>
              </motion.div>
            ) : (
              <div className="bk-state">
                <Ticket size={26} />
                <h3>
                  {query
                    ? 'No bookings match your search'
                    : bucket === 'upcoming'
                      ? 'No upcoming trips'
                      : bucket === 'confirmed'
                        ? 'No confirmed trips yet'
                        : bucket === 'reserved'
                          ? 'No reservations yet'
                          : bucket === 'cancelled'
                            ? 'No cancelled bookings'
                            : bucket === 'refund'
                              ? 'No refunds'
                              : 'No past trips yet'}
                </h3>
                <p>
                  {query
                    ? 'Try a different tour name or booking reference.'
                    : bucket === 'upcoming'
                      ? 'When you book an experience it will appear here.'
                      : bucket === 'confirmed'
                        ? 'Bookings you have fully paid for will appear here.'
                        : bucket === 'reserved'
                          ? 'Reserved trips you haven\u2019t paid for yet will appear here.'
                          : bucket === 'cancelled'
                            ? 'Bookings you have cancelled will appear here.'
                            : bucket === 'refund'
                              ? 'Refunds and money-back bookings will appear here.'
                              : 'Trips you have been on, or no-shows, will be kept here for your records.'}
                </p>
                <div className="bk-state-actions">
                  {!query && bucket === 'upcoming' && (
                    <Link className="bk-btn bk-btn-primary" to="/tours">
                      Browse all tours <ArrowRight size={15} />
                    </Link>
                  )}
                  {!query && (bucket === 'confirmed' || bucket === 'reserved' || bucket === 'past' || bucket === 'cancelled' || bucket === 'refund') && (
                    <button type="button" className="bk-btn bk-btn-secondary" onClick={() => setBucket('upcoming')}>
                      View upcoming trips
                    </button>
                  )}
                  {query && (
                    <button type="button" className="bk-btn bk-btn-secondary" onClick={() => setQuery('')}>
                      Clear search
                    </button>
                  )}
                </div>
              </div>
            )
          ) : ['past', 'cancelled', 'refund'].includes(bucket) ? (
            <>
              <div className="bk-list">
                {filtered.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    onOpen={() => openBooking(booking)}
                    chipLabel={bucket === 'past' && booking.status !== 'NO_SHOW' ? 'Completed' : undefined}
                    onWriteReview={isReviewable(booking) ? () => openReview(booking) : undefined}
                    canRequestRefund={isClaimable(booking)}
                    onRequestRefund={isClaimable(booking) ? () => setRefundBooking(booking) : undefined}
                  />
                ))}
              </div>
              <p className="bk-list-foot">
                Showing {filtered.length} {filtered.length === 1 ? activeLabel : `${activeLabel}s`}.
              </p>
            </>
          ) : (
            upcomingGroups.map((group) => (
              <section key={group.key} className="bk-group">
                <h2 className="bk-group-title">
                  {group.label}
                  <span className="bk-group-count">
                    {group.items.length} {group.items.length === 1 ? 'booking' : 'bookings'}
                  </span>
                </h2>
                <div className="bk-list">
                  {group.items.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      onOpen={() => openBooking(booking)}
                      onWriteReview={isReviewable(booking) ? () => openReview(booking) : undefined}
                      canRequestRefund={isClaimable(booking)}
                      onRequestRefund={isClaimable(booking) ? () => setRefundBooking(booking) : undefined}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </section>

        {/* Pane 2 — booking workspace (slides over the list) */}
        <section className={`bk-pane bk-pane-detail${bookingId ? ' on' : ' off'}`}>
          {bookingId ? (
            <Suspense
              fallback={
                <div className="ws-loading">
                  <div className="ws-loading-spinner" />
                </div>
              }
            >
              <BookingWorkspace id={bookingId} onClose={closeDetail} />
            </Suspense>
          ) : (
            <div className="bk-pane-empty" />
          )}
        </section>
      </div>

      {refundBooking && (
        <RequestRefundModal
          booking={refundBooking}
          onClose={() => setRefundBooking(null)}
          onSubmitted={() => {
            setRefundBooking(null)
            refetch()
          }}
        />
      )}
    </div>
  )
}
