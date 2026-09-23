import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface BookingDeadlineTimerProps {
  /** ISO instant when the supplier stops accepting bookings for this date. */
  closesAt?: string | null
}

function computeHoursLeft(closesAt: string | null): number | null {
  if (!closesAt) return null
  const deadline = new Date(closesAt)
  if (Number.isNaN(deadline.getTime())) return null
  const diff = deadline.getTime() - Date.now()
  if (diff <= 0) return 0
  return Math.ceil(diff / (1000 * 60 * 60))
}

/**
 * Banner shown in the booking widget after a date is selected, displaying how
 * many hours remain before the supplier stops accepting bookings for that
 * date. Only rendered when the deadline is within the near-horizon window
 * (≤ 48 h).
 */
export default function BookingDeadlineTimer({ closesAt }: BookingDeadlineTimerProps) {
  const { t } = useTranslation()
  const [hoursLeft, setHoursLeft] = useState<number | null>(() => computeHoursLeft(closesAt ?? null))
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)

    const tick = () => {
      const updated = computeHoursLeft(closesAt ?? null)
      setHoursLeft(updated)
      if (updated == null || updated <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }

    intervalRef.current = setInterval(tick, 60_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [closesAt])

  if (hoursLeft == null || hoursLeft <= 0 || hoursLeft > 48) return null

  return (
    <div className="booking-deadline-timer" role="status" aria-live="polite">
      <div className="booking-deadline-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="#b71c1c" strokeWidth="2" />
          <line className="clock-hour-hand" x1="12" y1="12" x2="12" y2="8" stroke="#b71c1c" strokeWidth="2" strokeLinecap="round" />
          <line className="clock-minute-hand" x1="12" y1="12" x2="12" y2="5" stroke="#b71c1c" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div className="booking-deadline-text">
        <p className="booking-deadline-headline">
          {t('booking.hoursLeftToBook', '{{hours}} hours left to book', { hours: hoursLeft })}
        </p>
        <p className="booking-deadline-sub">
          {t('booking.deadlineSubtext', 'The tour operator will stop accepting bookings for your date soon.')}
        </p>
        <p className="booking-deadline-sub">
          {t('booking.refundWindowEndingSoon', 'The refund window for this tour will be ending soon.')}
        </p>
      </div>
    </div>
  )
}
