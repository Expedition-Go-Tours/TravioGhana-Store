import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarCheck, CalendarDays, Clock, CreditCard, Globe, MapPin, ShieldCheck, Ticket, Users } from 'lucide-react'
import StarRating from '../StarRating'
import OptimizedImage from '@/components/shared/OptimizedImage'
import { useCurrency } from '../../contexts/CurrencyContext'
import { cancellationStatus } from '../../lib/cancellationLabel'
import { formatTime12h, formatTimeSlotList, scheduleTimeLabel } from '../../lib/tourAvailability'
import type { BookingTour } from '../../lib/bookingTour'
import { useCombinedTourStats } from '../../hooks/useExternalReviews'

const DAY_MONTH_YEAR_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// Day-Month-Year label for the summary card's Date row, e.g.
// "2026-08-20" → "20 Aug 2026". Returns null for empty/invalid input.
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

/**
 * The booking summary card.
 *
 * The headline rating/review count combines the in-app numbers with the
 * scraped TripAdvisor/GetYourGuide stats (`useCombinedTourStats`) exactly like
 * `TourCard` and the tour detail page. The backend rows for the scraped
 * catalogue carry `averageRating: null, reviewCount: 0`, so reading the raw
 * fields here showed "0 reviews" on tours with 100+ reviews everywhere else.
 */
export default function BookingTourCard({ tour, onChangeClick }: { tour: BookingTour; onChangeClick: () => void }) {
  const { t } = useTranslation()
  const { formatPrice } = useCurrency()

  // Scraped social proof is attributed by title/location/supplier — the
  // BookingTour carries the supplier as `provider`.
  const combinedStats = useCombinedTourStats({
    title: tour.title,
    location: tour.location,
    supplierName: tour.provider,
    rating: tour.rating,
    reviewCount: tour.reviews,
  })
  const displayRating = combinedStats.reviewCount > 0
    ? combinedStats.rating.toFixed(1)
    : (tour.rating ? String(tour.rating) : '0')
  const displayReviews = combinedStats.reviewCount > 0 ? combinedStats.reviewCount : tour.reviews

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
            <span className="text-sm font-bold text-slate-900">{displayRating}</span>
            <div className="flex items-center gap-0.5">
              <StarRating
                value={combinedStats.reviewCount > 0 ? combinedStats.rating : tour.rating}
                size={12}
                gap={2}
                filledColor="#10b981"
                emptyColor="#e2e8f0"
              />
            </div>
            <span className="text-xs text-slate-400">({displayReviews})</span>
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
