import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, CreditCard, Loader2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useCancellationChoicePreview, useSubmitCancellationChoice } from '../hooks/useCancellationChoice'
import {
  choiceErrorMessage,
  formatChoiceAmount,
  formatChoiceDate,
  formatChoiceDeadline,
  hoursLeftLabel,
  isChoiceDeadlineOpen,
  minRescheduleDate,
  refundStatusText,
} from '../lib/cancellationChoice'
import type { CancellationChoiceSuccess } from '../lib/cancellationChoice'
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
        <div className="cc-card cc-card-message">
          <div className="cc-message-icon cc-message-icon-warn">
            <AlertTriangle size={22} />
          </div>
          <h1 className="cc-title">This link isn&rsquo;t valid</h1>
          <p className="cc-text">
            The cancellation choice link is missing its token. Open the link from your email or
            from the banner on your booking, or head to your bookings to see its current status.
          </p>
          <Button asChild className="cc-primary-btn">
            <Link to="/dashboard/bookings">Go to my bookings</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (preview.isLoading) {
    return (
      <div className="cc-page">
        <div className="cc-card cc-card-message" role="status" aria-live="polite">
          <div className="cc-spinner" />
          <p className="cc-text">Loading your options…</p>
        </div>
      </div>
    )
  }

  if (preview.isError || !booking) {
    return (
      <div className="cc-page">
        <div className="cc-card cc-card-message">
          <div className="cc-message-icon cc-message-icon-warn">
            <AlertTriangle size={22} />
          </div>
          <h1 className="cc-title">We couldn&rsquo;t open this choice</h1>
          <p className="cc-text cc-error-text" role="alert">
            {choiceErrorMessage(preview.error)}
          </p>
          <div className="cc-message-actions">
            <Button onClick={() => preview.refetch()} className="cc-primary-btn">
              Try Again
            </Button>
            <Button asChild variant="outline" className="cc-secondary-btn">
              <Link to="/dashboard/bookings">Go to my bookings</Link>
            </Button>
          </div>
        </div>
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
    const rescheduledOn =
      outcome?.choice === 'RESCHEDULE' ? outcome.newDate : booking.travelDate
    const dateLabel = formatChoiceDate(rescheduledOn) || 'your new date'
    return (
      <div className="cc-page">
        <div className="cc-card cc-card-outcome">
          <div className="cc-message-icon cc-message-icon-ok">
            <CheckCircle2 size={22} />
          </div>
          {answeredChoice === 'RESCHEDULE' ? (
            <>
              <h1 className="cc-title">
                Your booking is confirmed again on {dateLabel}
              </h1>
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
          <Button asChild className="cc-primary-btn">
            <Link to="/dashboard/bookings">Go to my bookings</Link>
          </Button>
        </div>
      </div>
    )
  }

  /* --------------------------- decision ----------------------------- */

  return (
    <div className="cc-page">
      <div className="cc-card">
        <Link className="cc-back" to="/dashboard/bookings">
          <ArrowLeft size={15} /> My bookings
        </Link>

        <div className="cc-head">
          {booking.coverPhoto && (
            <img className="cc-cover" src={booking.coverPhoto} alt="" />
          )}
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
                Decide by {formatChoiceDeadline(booking.choiceDeadline)}
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
            {amount ? <p className="cc-option-amount">{amount}</p> : <p className="cc-option-amount">Full refund</p>}
            <p className="cc-option-text">{refundStatusText(booking)}</p>
            <Button
              className="cc-primary-btn"
              onClick={() => setConfirmOpen(true)}
              disabled={submit.isPending}
            >
              Get a full refund
            </Button>
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
              <Button type="submit" className="cc-primary-btn" disabled={!newDate || submit.isPending}>
                {submit.isPending && submit.variables?.choice === 'RESCHEDULE' ? (
                  <>
                    <Loader2 size={15} className="cc-btn-spin" /> Confirming…
                  </>
                ) : (
                  'Confirm new date'
                )}
              </Button>
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
              <Button
                className="cc-primary-btn"
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
              </Button>
              <Button
                variant="outline"
                className="cc-secondary-btn"
                onClick={() => setConfirmOpen(false)}
                disabled={submit.isPending}
              >
                Keep my options open
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
