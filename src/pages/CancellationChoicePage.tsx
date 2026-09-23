import { useState, useEffect, useRef, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import confetti from 'canvas-confetti'
import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, CreditCard, Loader2 } from 'lucide-react'
import SEO from '../components/SEO'
import Footer from '../components/Footer'
import { useCancellationChoicePreview, useSubmitCancellationChoice } from '../hooks/useCancellationChoice'
import {
  choiceErrorMessage,
  formatChoiceAmount,
  formatChoiceDate,
  hoursLeftLabel,
  isChoiceDeadlineOpen,
  minRescheduleDate,
  refundStatusText,
} from '../lib/cancellationChoice'
import type { CancellationChoiceSuccess } from '../lib/cancellationChoice'
import { formatDeadlineLabel } from '../lib/bookingUi'
import '../components/booking/bookingTheme.css'
import './CancellationChoicePage.css'

type Outcome =
  | { choice: 'REFUND'; data: CancellationChoiceSuccess }
  | { choice: 'RESCHEDULE'; newDate: string; data: CancellationChoiceSuccess }

/**
 * Public, token-driven decision page for a supplier-cancelled booking:
 * the customer picks "new date" or "full refund", or reads the outcome if
 * they already answered. Route: /cancellation-choice?token=…
 */
export default function CancellationChoicePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const preview = useCancellationChoicePreview(token)
  const submit = useSubmitCancellationChoice()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  // Celebration for the reschedule success state (mirrors BookingConfirmationPage).
  const confettiFiredRef = useRef(false)
  useEffect(() => {
    if (confettiFiredRef.current) return
    if (outcome?.choice !== 'RESCHEDULE') return
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
  }, [outcome])

  const booking = preview.data

  const requestRefund = () => {
    if (!token) return
    setConfirmOpen(false)
    setError(null)
    submit.mutate(
      { token, choice: 'REFUND' },
      {
        onSuccess: (data) => {
          setOutcome({ choice: 'REFUND', data })
          toast.success('Your refund has been requested')
        },
        onError: (err) => {
          const message = choiceErrorMessage(err)
          setError(message)
          toast.error(message)
        },
      }
    )
  }

  const requestReschedule = (e: FormEvent) => {
    e.preventDefault()
    if (!token || !newDate) return
    setError(null)
    submit.mutate(
      { token, choice: 'RESCHEDULE', newTravelDate: newDate },
      {
        onSuccess: (data) => {
          setOutcome({ choice: 'RESCHEDULE', newDate, data })
          toast.success('Your new date is confirmed')
        },
        onError: (err) => {
          const message = choiceErrorMessage(err)
          setError(message)
          toast.error(message)
        },
      }
    )
  }

  /* ---------------- invalid / loading / error states ---------------- */

  if (!token) {
    return (
      <div className="cc-page">
        <SEO title="Choose a new date or refund" robots="noindex, nofollow" />
        <div className="cc-card cc-card-message">
          <div className="cc-message-icon cc-message-icon-warn">
            <AlertTriangle size={22} />
          </div>
          <h1 className="cc-title">This link isn&rsquo;t valid</h1>
          <p className="cc-text">
            The cancellation choice link is missing its token. Open the link from your email or
            from the banner on your booking, or head to your bookings to see its current status.
          </p>
          <Link className="bk-btn bk-btn-primary" to="/dashboard/bookings">
            Go to my bookings
          </Link>
        </div>
        <Footer />
      </div>
    )
  }

  if (preview.isLoading) {
    return (
      <div className="cc-page">
        <SEO title="Choose a new date or refund" robots="noindex, nofollow" />
        <div className="cc-card cc-card-message" role="status" aria-live="polite">
          <div className="cc-spinner" />
          <p className="cc-text">Loading your options…</p>
        </div>
        <Footer />
      </div>
    )
  }

  if (preview.isError || !booking) {
    return (
      <div className="cc-page">
        <SEO title="Choose a new date or refund" robots="noindex, nofollow" />
        <div className="cc-card cc-card-message">
          <div className="cc-message-icon cc-message-icon-warn">
            <AlertTriangle size={22} />
          </div>
          <h1 className="cc-title">We couldn&rsquo;t open this choice</h1>
          <p className="cc-text cc-error-text" role="alert">
            {choiceErrorMessage(preview.error)}
          </p>
          <div className="cc-message-actions">
            <button type="button" className="bk-btn bk-btn-primary" onClick={() => preview.refetch()}>
              Try Again
            </button>
            <Link className="bk-btn bk-btn-secondary" to="/dashboard/bookings">
              Go to my bookings
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  /* ----------------------- read-only outcome ------------------------ */

  const answeredChoice =
    outcome?.choice ?? booking.customerChoice ?? (booking.resolvedStatus === 'RESCHEDULED' ? 'RESCHEDULE' : null)
  const deadlinePassed = booking.choiceDeadline ? !isChoiceDeadlineOpen(booking.choiceDeadline) : false
  const hoursLeft = hoursLeftLabel(booking.choiceDeadline)
  const amount = formatChoiceAmount(booking.refundAmount, booking.currency)

  if (answeredChoice) {
    const rescheduledOn = outcome?.choice === 'RESCHEDULE' ? outcome.newDate : booking.travelDate
    const dateLabel = formatChoiceDate(rescheduledOn) || 'your new date'
    return (
      <div className="cc-page">
        <SEO title="Your cancellation choice" robots="noindex, nofollow" />
        <div className="cc-card cc-card-outcome">
          <div className="cc-message-icon cc-message-icon-ok">
            <CheckCircle2 size={22} />
          </div>
          {answeredChoice === 'RESCHEDULE' ? (
            <>
              <h1 className="cc-title">Your booking is confirmed again on {dateLabel}</h1>
              <p className="cc-text">
                You chose a new date — nothing else to do. We&rsquo;ll see you there.
              </p>
            </>
          ) : (
            <>
              <h1 className="cc-title">You chose a refund</h1>
              <p className="cc-text">{refundStatusText(booking)}</p>
            </>
          )}
          <div className="cc-summary-line">
            <span>{booking.tourTitle || 'Your booking'}</span>
            {booking.bookingNumber && <span className="cc-summary-ref">{booking.bookingNumber}</span>}
          </div>
          <Link className="bk-btn bk-btn-primary" to="/dashboard/bookings">
            Go to my bookings
          </Link>
        </div>
        <Footer />
      </div>
    )
  }

  /* --------------------------- decision ----------------------------- */

  return (
    <div className="cc-page">
      <SEO
        title="Choose a new date or refund"
        description="Your booking was cancelled by the supplier. Choose a new date or take a full refund."
        robots="noindex, nofollow"
      />
      <div className="cc-card">
        <Link className="cc-back" to="/dashboard/bookings">
          <ArrowLeft size={15} /> My bookings
        </Link>

        <div className="cc-head">
          {booking.coverPhoto && <img className="cc-cover" src={booking.coverPhoto} alt="" />}
          <div className="cc-head-text">
            <p className="cc-kicker">Cancelled by supplier — your decision is needed</p>
            <h1 className="cc-title">{booking.tourTitle || 'Your booking was cancelled'}</h1>
            <div className="cc-meta">
              {booking.travelDate && (
                <span>
                  <CalendarDays size={14} /> {formatChoiceDate(booking.travelDate)}
                </span>
              )}
              {booking.bookingNumber && <span className="cc-summary-ref">{booking.bookingNumber}</span>}
            </div>
            {booking.choiceDeadline && (
              <p className={`cc-deadline${deadlinePassed ? ' is-passed' : ''}`}>
                Decide by {formatDeadlineLabel(booking.choiceDeadline)}
                {!deadlinePassed && hoursLeft && <span className="cc-deadline-chip">{hoursLeft}</span>}
                {deadlinePassed && <span className="cc-deadline-chip">Deadline passed</span>}
              </p>
            )}
          </div>
        </div>

        <p className="cc-intro">
          Your supplier cancelled this booking. Pick one of the two options below — either way,
          you are covered.
        </p>

        {error && (
          <p className="cc-error" role="alert">
            {error}
          </p>
        )}

        <div className="cc-options">
          {/* Option 1 — refund */}
          <section className="cc-option" aria-labelledby="cc-refund-title">
            <div className="cc-option-icon">
              <CreditCard size={18} />
            </div>
            <h2 className="cc-option-title" id="cc-refund-title">
              Get a full refund
            </h2>
            <p className="cc-option-amount">{amount || 'Full refund'}</p>
            <p className="cc-option-text">{refundStatusText(booking)}</p>
            <button
              type="button"
              className="bk-btn bk-btn-primary"
              onClick={() => setConfirmOpen(true)}
              disabled={submit.isPending}
            >
              Get a full refund
            </button>
          </section>

          {/* Option 2 — reschedule */}
          <section className="cc-option" aria-labelledby="cc-reschedule-title">
            <div className="cc-option-icon">
              <CalendarDays size={18} />
            </div>
            <h2 className="cc-option-title" id="cc-reschedule-title">
              Choose a new date
            </h2>
            <p className="cc-option-text">
              Keep the same booking and move it to a date that works for you.
            </p>
            <form className="cc-date-form" onSubmit={requestReschedule}>
              <label className="cc-date-label" htmlFor="cc-new-date">
                New travel date
              </label>
              <input
                id="cc-new-date"
                className="cc-date-input"
                type="date"
                min={minRescheduleDate()}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                required
              />
              <button
                type="submit"
                className="bk-btn bk-btn-primary"
                disabled={!newDate || submit.isPending}
              >
                {submit.isPending && submit.variables?.choice === 'RESCHEDULE' ? (
                  <>
                    <Loader2 size={15} className="cc-btn-spin" /> Confirming…
                  </>
                ) : (
                  'Confirm new date'
                )}
              </button>
            </form>
          </section>
        </div>
      </div>

      {/* Refund confirmation dialog */}
      {confirmOpen && (
        <div className="cc-dialog-backdrop" onClick={() => setConfirmOpen(false)}>
          <div
            className="cc-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-dialog-title"
            aria-describedby="cc-dialog-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="cc-dialog-title" id="cc-dialog-title">
              Request a full refund?
            </h2>
            <p className="cc-dialog-text" id="cc-dialog-desc">
              {amount ? <>We&rsquo;ll refund {amount} to your original payment method. </> : null}
              {refundStatusText(booking)} This can&rsquo;t be undone from here.
            </p>
            <div className="cc-dialog-actions">
              <button
                type="button"
                className="bk-btn bk-btn-primary"
                onClick={requestRefund}
                disabled={submit.isPending}
              >
                {submit.isPending && submit.variables?.choice === 'REFUND' ? (
                  <>
                    <Loader2 size={15} className="cc-btn-spin" /> Requesting…
                  </>
                ) : (
                  'Yes, refund me'
                )}
              </button>
              <button
                type="button"
                className="bk-btn bk-btn-secondary"
                onClick={() => setConfirmOpen(false)}
                disabled={submit.isPending}
              >
                Keep my options open
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
