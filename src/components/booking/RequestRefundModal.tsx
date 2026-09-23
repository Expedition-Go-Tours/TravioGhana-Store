import { useMemo, useState } from 'react'
import { X, Loader2, Star, ArrowLeft, ShieldCheck } from 'lucide-react'
import { fetchWithAuth } from '../../lib/api'
import { currencySymbol } from '../../lib/currencySymbol'
import type { ExpeditionBookingSummary } from '../../hooks/useExpeditionBookings'
import { formatMediumDate, formatTimeString, partyLabel } from '../../lib/bookingUi'

const REASONS: { code: string; label: string; hint: string }[] = [
  { code: 'NOT_AS_DESCRIBED', label: "Didn't match the description", hint: 'The experience differed from what was advertised' },
  { code: 'SERVICE_NOT_PROVIDED', label: 'Service wasn’t provided', hint: 'Parts of the experience didn’t happen' },
  { code: 'GUIDE_ISSUE', label: 'Guide or host issue', hint: 'The guide/host quality or conduct affected the trip' },
  { code: 'TRANSPORT_ISSUE', label: 'Transport problem', hint: 'Pickup, transfers or the vehicle caused an issue' },
  { code: 'SCHEDULE_CHANGE', label: 'Last-minute schedule change', hint: 'The provider changed the time or date on short notice' },
  { code: 'HEALTH_SAFETY', label: 'Health or safety concern', hint: 'You felt unsafe or facilities were unsanitary' },
  { code: 'OTHER', label: 'Something else', hint: 'We’ll ask you to describe the issue' },
]

interface Props {
  booking: ExpeditionBookingSummary
  onClose: () => void
  onSubmitted: () => void
}

async function submitClaim(bookingId: string, payload: unknown) {
  const res = await fetchWithAuth(`/refund-claims/bookings/${encodeURIComponent(bookingId)}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    let message = 'Something went wrong while submitting your request.'
    try {
      const body = await res.json()
      message = body?.message || body?.error?.message || message
    } catch {
      /* keep default */
    }
    throw new Error(message)
  }
  return res.json()
}

export default function RequestRefundModal({ booking, onClose, onSubmitted }: Props) {
  const [step, setStep] = useState<'reason' | 'refund'>('reason')
  const [reason, setReason] = useState<string | null>(null)
  const [details, setDetails] = useState('')
  const [refundType, setRefundType] = useState<'FULL' | 'PARTIAL'>('FULL')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const symbol = booking.currency === 'GHS' ? 'GH₵' : currencySymbol(booking.currency)
  const paid = Number(booking.total) || 0
  const when = `${formatMediumDate(booking.travelDate)}${booking.selectedTime ? ` · ${formatTimeString(booking.selectedTime)}` : ''}`

  const selectedReason = REASONS.find((r) => r.code === reason)
  const partialValid = useMemo(() => {
    if (refundType !== 'PARTIAL') return true
    const n = Number(amount)
    return Number.isFinite(n) && n > 0 && n <= paid
  }, [refundType, amount, paid])

  const handleSubmit = async () => {
    if (!reason || !partialValid) return
    setSubmitting(true)
    setError(null)
    try {
      await submitClaim(booking.id, {
        reason,
        details: details.trim() || undefined,
        type: refundType,
        requestedAmount: refundType === 'PARTIAL' ? Number(amount) : undefined,
      })
      setDone(true)
      onSubmitted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="rf-modal" role="dialog" aria-modal="true" aria-label="Refund request submitted">
        <div className="rf-overlay" onClick={onClose} />
        <div className="rf-card">
          <button type="button" className="rf-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
          <div className="rf-icon rf-icon-ok">
            <ShieldCheck size={24} />
          </div>
          <h2 className="rf-title">Request submitted</h2>
          <p className="rf-body">
            Your refund request is with the provider. If they approve it, our team will release the refund to your
            original payment method — this usually takes a few business days.
          </p>
          <button type="button" className="bk-btn bk-btn-primary rf-cta" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rf-modal" role="dialog" aria-modal="true" aria-label="Request a refund">
      <div className="rf-overlay" onClick={onClose} />
      <div className="rf-card">
        <button type="button" className="rf-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        {/* Booking context */}
        <div className="rf-summary">
          <div className="rf-summary-photo">
            {booking.tourImage ? <img src={booking.tourImage} alt="" /> : <Star size={18} />}
          </div>
          <div className="rf-summary-main">
            <h2 className="rf-title">{booking.tourTitle}</h2>
            <p className="rf-sub">
              {when} · {partyLabel(booking.party) || `${booking.total || 0} traveler(s)`} · Ref #{booking.bookingNumber}
            </p>
            <p className="rf-paid">
              Paid {symbol}
              {paid.toFixed(2)}
            </p>
          </div>
        </div>

        {step === 'reason' ? (
          <>
            <h3 className="rf-step-title">Please tell us your reason</h3>
            <div className="rf-reasons">
              {REASONS.map((r) => (
                <button
                  key={r.code}
                  type="button"
                  className={`rf-reason${reason === r.code ? ' selected' : ''}`}
                  onClick={() => setReason(r.code)}
                >
                  <span className="rf-reason-radio" aria-hidden="true" />
                  <span className="rf-reason-text">
                    <strong>{r.label}</strong>
                    <small>{r.hint}</small>
                  </span>
                </button>
              ))}
            </div>
            <label className="rf-details">
              <span>Anything else we should know? <em>Optional</em></span>
              <textarea
                rows={3}
                maxLength={1000}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Tell us what happened"
              />
            </label>
          </>
        ) : (
          <>
            <h3 className="rf-step-title">
              {selectedReason ? `What refund are you requesting?` : 'Refund type'}
              {selectedReason && <span className="rf-step-reason">— {selectedReason.label}</span>}
            </h3>

            <div className="rf-types">
              <button
                type="button"
                className={`rf-type${refundType === 'FULL' ? ' selected' : ''}`}
                onClick={() => setRefundType('FULL')}
              >
                <strong>Full refund</strong>
                <span>
                  {symbol}
                  {paid.toFixed(2)} back
                </span>
              </button>
              <button
                type="button"
                className={`rf-type${refundType === 'PARTIAL' ? ' selected' : ''}`}
                onClick={() => setRefundType('PARTIAL')}
              >
                <strong>Partial refund</strong>
                <span>Ask for a portion back</span>
              </button>
            </div>

            {refundType === 'PARTIAL' && (
              <label className="rf-amount">
                <span>How much would you like back?</span>
                <div className="rf-amount-input">
                  <span>{symbol}</span>
                  <input
                    type="number"
                    min={1}
                    max={paid}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Up to ${paid.toFixed(2)}`}
                    inputMode="decimal"
                  />
                </div>
                {amount && !partialValid && (
                  <small className="rf-error-text">Enter an amount between 0 and {symbol}{paid.toFixed(2)}</small>
                )}
              </label>
            )}

            <p className="rf-note">
              The provider reviews every request and our team releases approved refunds to your original payment
              method. Refunds are not guaranteed.
            </p>
          </>
        )}

        {error && <p className="rf-error">{error}</p>}

        <div className="rf-actions">
          {step === 'refund' && (
            <button type="button" className="rf-back" onClick={() => setStep('reason')} disabled={submitting}>
              <ArrowLeft size={15} /> Back
            </button>
          )}
          {step === 'reason' ? (
            <button
              type="button"
              className="bk-btn bk-btn-primary rf-cta"
              disabled={!reason}
              onClick={() => setStep('refund')}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              className="bk-btn bk-btn-primary rf-cta"
              disabled={submitting || !partialValid}
              onClick={handleSubmit}
            >
              {submitting ? <Loader2 size={16} className="spin" /> : 'Submit request'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
