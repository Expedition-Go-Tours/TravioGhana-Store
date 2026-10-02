import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertTriangle, ShieldCheck, XCircle, ArrowLeft, Loader2 } from 'lucide-react'

const currencySymbol = (currency?: string): string => {
  if (currency === 'GHS') return 'GH₵'
  if (currency === 'EUR') return '€'
  if (currency === 'GBP') return '£'
  return '$'
}

type Step = 'confirm' | 'reason' | 'refund' | 'no_refund'

interface CancelBookingModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string, note?: string) => void
  isPending: boolean
  error: string | null
  refundPct: number
  isPaid: boolean
  bookingNumber?: string
  tourTitle?: string
  refundAmount?: number
  currency?: string
}

const CANCEL_REASONS = [
  { code: 'SCHEDULE_CHANGED', label: 'My schedule changed', hint: 'Plans shifted and I can no longer attend' },
  { code: 'HEALTH_MEDICAL', label: 'Health or medical reasons', hint: 'Illness, injury, or medical situation' },
  { code: 'TRANSPORTATION', label: 'Transportation issues', hint: 'Flight delay, missed connection, or travel disruption' },
  { code: 'WEATHER_SAFETY', label: 'Weather or safety concerns', hint: 'Conditions that make travel unsafe or unpleasant' },
  { code: 'FOUND_ALTERNATIVE', label: 'Found a better option', hint: 'Found a different experience or provider' },
  { code: 'OTHER', label: 'Other', hint: 'Something else — tell us more below' },
] as const

export default function CancelBookingModal({
  isOpen,
  onClose,
  onConfirm,
  isPending,
  error,
  refundPct,
  isPaid,
  bookingNumber,
  tourTitle,
  refundAmount,
  currency,
}: CancelBookingModalProps) {
  const [step, setStep] = useState<Step>('confirm')
  const [reason, setReason] = useState<string>('')
  const [note, setNote] = useState<string>('')

  // Reset to the confirm step each time the modal opens (state adjustment
  // during render — the lint-approved alternative to a reset effect).
  const [prevOpen, setPrevOpen] = useState(isOpen)
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen)
    if (isOpen) { setStep('confirm'); setReason(''); setNote('') }
  }

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, isPending, onClose])

  // Lock body scroll
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  const handleYes = useCallback(() => {
    setStep('reason')
  }, [])

  const handleReasonContinue = useCallback(() => {
    setStep(refundPct > 0 ? 'refund' : 'no_refund')
  }, [refundPct])

  const handleConfirm = useCallback(() => {
    onConfirm(reason || 'Customer requested cancellation', note || undefined)
  }, [onConfirm, reason, note])

  const sym = currencySymbol(currency)
  const formattedRefund = refundAmount != null && refundAmount > 0
    ? `${sym}${refundAmount.toFixed(2)}`
    : refundPct >= 100
      ? 'full refund'
      : `${refundPct}% refund`

  if (!isOpen) return null

  return createPortal(
    <div className="cb-modal" role="dialog" aria-modal="true" aria-label="Cancel booking">
      <div className="cb-overlay" onClick={isPending ? undefined : onClose} />
      <div className="cb-card">
        {/* Close button */}
        <button
          type="button"
          className="cb-close"
          onClick={onClose}
          disabled={isPending}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Step 1: Confirm */}
        {step === 'confirm' && (
          <>
            <div className="cb-icon cb-icon-amber">
              <AlertTriangle size={24} />
            </div>
            <h2 className="cb-title">Cancel this booking?</h2>
            <p className="cb-body">
              Are you sure you want to cancel
              {tourTitle ? <strong> {tourTitle}</strong> : ' this booking'}
              {bookingNumber ? <> (#{bookingNumber})</> : null}? This action cannot be undone.
            </p>
            <div className="cb-actions">
              <button
                type="button"
                className="bk-btn bk-btn-ghost cb-btn"
                onClick={onClose}
              >
                No, go back
              </button>
              <button
                type="button"
                className="bk-btn bk-btn-primary cb-btn"
                onClick={handleYes}
              >
                Yes, continue
              </button>
            </div>
          </>
        )}

        {/* Step 2: Reason selection — mirrors RequestRefundModal's pattern */}
        {step === 'reason' && (
          <>
            <h2 className="cb-title">Please tell us your reason</h2>
            <p className="cb-body">
              This helps the tour operator understand what happened and improve future bookings.
            </p>
            <div className="cb-reasons">
              {CANCEL_REASONS.map((r) => (
                <button
                  key={r.code}
                  type="button"
                  className={`cb-reason${reason === r.code ? ' selected' : ''}`}
                  onClick={() => setReason(r.code)}
                >
                  <span className="cb-reason-radio" aria-hidden="true" />
                  <span className="cb-reason-text">
                    <strong>{r.label}</strong>
                    <small>{r.hint}</small>
                  </span>
                </button>
              ))}
            </div>
            {(reason === 'OTHER' || reason === '') && (
              <label className="cb-note-input">
                <span>Anything else we should know? <em>Optional</em></span>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Tell us what happened"
                />
              </label>
            )}
            <div className="cb-actions">
              <button
                type="button"
                className="bk-btn bk-btn-ghost cb-btn"
                onClick={() => setStep('confirm')}
              >
                Go back
              </button>
              <button
                type="button"
                className="bk-btn bk-btn-primary cb-btn"
                onClick={handleReasonContinue}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {/* Step 3a: Refund eligible */}
        {step === 'refund' && (
          <>
            <div className="cb-icon cb-icon-green">
              <ShieldCheck size={24} />
            </div>
            <h2 className="cb-title">You're eligible for a refund</h2>
            <p className="cb-body">
              Your booking is eligible for a refund. If you continue with the cancellation,
              your refund will be processed back to your original payment method.
            </p>
            <div className="cb-refund-badge">
              <span className="cb-refund-label">Refund amount</span>
              <span className="cb-refund-value">{formattedRefund}</span>
            </div>
            {error && <p className="cb-error">{error}</p>}
            <div className="cb-actions">
              <button
                type="button"
                className="bk-btn bk-btn-ghost cb-btn"
                onClick={() => setStep('confirm')}
                disabled={isPending}
              >
                <ArrowLeft size={15} />
                Go back
              </button>
              <button
                type="button"
                className="bk-btn cb-btn cb-btn-danger-solid"
                onClick={handleConfirm}
                disabled={isPending}
              >
                {isPending ? <Loader2 size={16} className="cb-spin" /> : null}
                {isPending ? 'Cancelling…' : 'Cancel & Refund'}
              </button>
            </div>
          </>
        )}

        {/* Step 3b: No refund */}
        {step === 'no_refund' && (
          <>
            <div className="cb-icon cb-icon-rose">
              <XCircle size={24} />
            </div>
            <h2 className="cb-title">Cancellation not eligible for refund</h2>
            <p className="cb-body">
              This tour's cancellation date does not qualify for a refund. If you cancel
              this booking, you will not receive a refund. Confirm to proceed or cancel to go back.
            </p>
            {!isPaid && (
              <p className="cb-note">
                This reservation has not been charged — no payment will be taken.
              </p>
            )}
            {error && <p className="cb-error">{error}</p>}
            <div className="cb-actions">
              <button
                type="button"
                className="bk-btn bk-btn-ghost cb-btn"
                onClick={() => setStep('confirm')}
                disabled={isPending}
              >
                <ArrowLeft size={15} />
                Go back
              </button>
              <button
                type="button"
                className="bk-btn cb-btn cb-btn-danger-solid"
                onClick={handleConfirm}
                disabled={isPending}
              >
                {isPending ? <Loader2 size={16} className="cb-spin" /> : null}
                {isPending ? 'Cancelling…' : 'Proceed to Cancel'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
