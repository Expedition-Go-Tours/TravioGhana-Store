import { Link } from 'react-router-dom'
import {
  formatChoiceAmount,
  hoursLeftLabel,
} from '../lib/cancellationChoice'
import type { CancellationChoice } from '../lib/cancellationChoice'
import { formatDeadlineLabel } from '../lib/bookingUi'
import './CancellationChoiceBanner.css'

interface CancellationChoiceBannerProps {
  /** One-time token for /cancellation-choice — present only while a decision is owed. */
  token?: string | null
  /** Set once the customer answered: renders the muted status line instead of the banner. */
  customerChoice?: CancellationChoice | null
  /** ISO timestamp of the choice deadline. */
  deadline?: string | null
  refundAmount?: number | null
  currency?: string | null
  /** Fallback amount when the payload carries no refundAmount. */
  total?: number | null
}

/**
 * Booking-card surface for the supplier-cancellation choice flow:
 *  - no answer yet  → amber "Cancelled by supplier" banner with a CTA to
 *    /cancellation-choice?token=…, the refund amount, the deadline and a
 *    compact "X hours left" chip;
 *  - already answered → muted "You chose …" status line, no CTA.
 *
 * The whole booking card is clickable, so the CTA stops propagation.
 */
export default function CancellationChoiceBanner({
  token,
  customerChoice,
  deadline,
  refundAmount,
  currency,
  total,
}: CancellationChoiceBannerProps) {
  if (customerChoice) {
    return (
      <p className="cc-answered">
        {customerChoice === 'RESCHEDULE' ? 'You chose a new date (pending)' : 'You chose a refund'}
      </p>
    )
  }

  if (!token) return null

  const amount = formatChoiceAmount(refundAmount ?? total, currency)
  const deadlineLabel = deadline ? formatDeadlineLabel(deadline) : ''
  const hoursLeft = hoursLeftLabel(deadline)

  return (
    <div className="cc-banner" role="group" aria-label="Cancelled by supplier — your decision is needed">
      <p className="cc-banner-head">Cancelled by supplier — your decision is needed</p>
      <p className="cc-banner-body">
        {amount ? <>Choose a new date or get a full refund of {amount}. </> : 'Choose a new date or get a full refund. '}
        {deadlineLabel && <>Decide by {deadlineLabel}.</>}
      </p>
      <div className="cc-banner-actions">
        <Link
          className="cc-banner-cta"
          to={`/cancellation-choice?token=${encodeURIComponent(token)}`}
          onClick={(e) => e.stopPropagation()}
        >
          Choose a new date or refund
        </Link>
        {hoursLeft && <span className="cc-banner-hours">{hoursLeft}</span>}
      </div>
    </div>
  )
}
