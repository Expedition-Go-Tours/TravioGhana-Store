import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { bookingPath } from '../lib/tourPath'
import { AnimatePresence } from 'framer-motion'
import { ArrowLeft, ChevronDown, ExternalLink, Loader2, Lock, ShieldCheck } from 'lucide-react'
import {
  useCheckoutDraft,
  useReleaseCheckoutDraft,
  usePaypalApproval,
  useCapturePaypalPayment,
  useBookingByPaypalOrder,
  type CheckoutDraftSummary,
} from '../hooks/useExpeditionBookings'
import CheckoutElements, { type CheckoutElementsHandle } from '../components/booking/CheckoutElements'
import BookingTransition from '../components/BookingTransition'
import { currencySymbol } from '../lib/currencySymbol'
import OptimizedImage from '@/components/shared/OptimizedImage'
import logoSrc from '../assets/TravioGhana_Logo.svg'
import SEO from '../components/SEO'
import { formatHeadingDate, partyLabel } from '../lib/bookingUi'
import { formatPhoneDisplay } from '../lib/phone'
import { formatDuration } from '../hooks/useExpeditionTours'
import './CheckoutPage.css'

function formatMoney(amount: number, currency: string): string {
  const symbol = currencySymbol(currency)
  const value = Number.isFinite(amount) ? amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'
  return `${symbol}${value}`
}

function useCountdown(expiresAt?: string | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!expiresAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [expiresAt])
  if (!expiresAt) return { expired: false, minutes: 0, seconds: 0 }
  const ms = Math.max(0, new Date(expiresAt).getTime() - now)
  return { expired: ms <= 0, minutes: Math.floor(ms / 60000), seconds: Math.floor((ms % 60000) / 1000) }
}

/**
 * Whether the seat hold has lapsed, without a per-second clock: a single
 * timeout fires exactly at the deadline, so the page re-renders at most twice
 * (mount + expiry) instead of once per second.
 */
function useHoldExpired(expiresAt?: string | null): boolean {
  const [expiredKey, setExpiredKey] = useState<string | null>(null)
  useEffect(() => {
    if (!expiresAt) return
    const ms = Math.max(0, new Date(expiresAt).getTime() - Date.now())
    const timer = setTimeout(() => setExpiredKey(expiresAt), ms)
    return () => clearTimeout(timer)
  }, [expiresAt])
  return !!expiresAt && expiredKey === expiresAt
}

/** The ticking text lives in its own component so only this node re-renders
 * each second while a hold is active. */
function HoldTimer({ expiresAt }: { expiresAt?: string | null }) {
  const { expired, minutes, seconds } = useCountdown(expiresAt)
  if (!expiresAt || expired) return null
  return (
    <p className="co-hold" role="timer">
      Your spot is reserved for {minutes}:{String(seconds).padStart(2, '0')}
    </p>
  )
}

/** Back arrow used in both desktop (left pane) and mobile (compact) headers. */
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="co-back" onClick={onClick} aria-label="Back to booking">
      <ArrowLeft size={18} />
      <span>Back</span>
    </button>
  )
}

/** Full order summary — rendered on the desktop left pane (forest tone) and,
 *  when expanded, in the mobile collapsed summary (light tone). */
function OrderSummary({
  draft,
  expiresAt,
  light = false,
}: {
  draft: CheckoutDraftSummary
  expiresAt?: string | null
  light?: boolean
}) {
  return (
    <div className={light ? 'co-order co-order--light' : 'co-order'}>
      <div className="co-item">
        {draft.tour.coverPhoto ? (
          <OptimizedImage src={draft.tour.coverPhoto} alt={draft.tour.title} width={80} className="co-item-img" />
        ) : (
          <div className="co-item-img co-item-img-fallback" />
        )}
        <div className="co-item-body">
          <p className="co-item-title">{draft.tour.title}</p>
          <p className="co-item-meta">
            {formatHeadingDate(draft.travelDate)}
            {draft.selectedTime ? ` · ${draft.selectedTime}` : ''}
          </p>
          <p className="co-item-meta">
            {partyLabel(draft.party)}
            {draft.tour.durationMinutes ? ` · ${formatDuration(draft.tour.durationMinutes)}` : ''}
          </p>
        </div>
        <div className="co-item-price">{formatMoney(draft.pricing.subtotal + draft.pricing.fees, draft.currency)}</div>
      </div>

      {draft.tour.description && <p className="co-item-desc">{draft.tour.description}</p>}

      <div className="co-rules" />

      <div className="co-row">
        <span>Subtotal</span>
        <span>{formatMoney(draft.pricing.subtotal, draft.currency)}</span>
      </div>
      {draft.pricing.fees > 0 && (
        <div className="co-row">
          <span>Fees</span>
          <span>{formatMoney(draft.pricing.fees, draft.currency)}</span>
        </div>
      )}
      {draft.pricing.taxes > 0 && (
        <div className="co-row">
          <span>Taxes</span>
          <span>{formatMoney(draft.pricing.taxes, draft.currency)}</span>
        </div>
      )}
      {draft.pricing.discount > 0 && (
        <div className="co-row co-row-discount">
          <span>{draft.promoCode ? `Discount (${draft.promoCode})` : 'Discount'}</span>
          <span>-{formatMoney(draft.pricing.discount, draft.currency)}</span>
        </div>
      )}

      <div className="co-rules" />

      <div className="co-row co-row-total">
        <span>Total due</span>
        <span>{formatMoney(draft.pricing.total, draft.currency)}</span>
      </div>

      <HoldTimer expiresAt={expiresAt} />
    </div>
  )
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const draftId = searchParams.get('draft') || undefined
  const { data: draft, isLoading, isError } = useCheckoutDraft(draftId)
  const release = useReleaseCheckoutDraft()
  const holdExpired = useHoldExpired(draft?.expiresAt)

  const [elementsState, setElementsState] = useState({ ready: false, complete: false })
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [showAnimation, setShowAnimation] = useState(false)
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(true)
  const expiryReleasedRef = useRef(false)
  const elementsHandleRef = useRef<CheckoutElementsHandle | null>(null)

  const clientSecret = draft?.clientSecret || null
  const paymentIntentId = draft?.paymentIntentId || null

  const returnUrl = useMemo(() => {
    if (!paymentIntentId) return null
    return `${window.location.origin}/booking/confirmation?session_id=${encodeURIComponent(paymentIntentId)}`
  }, [paymentIntentId])

  // ── PayPal draft ─────────────────────────────────────────────────────────
  // A PayPal hold has no PaymentIntent, so `clientSecret` is null and this page
  // would otherwise fall into the "Checkout unavailable" state on the very
  // refresh it exists to survive. Instead it becomes a way back to PayPal —
  // or, if the customer already approved the order elsewhere, a capture.
  const isPaypalDraft = draft?.payment?.provider === 'paypal'
  const paypalOrderId = draft?.payment?.paypalOrderId || null
  const approval = usePaypalApproval(isPaypalDraft ? paypalOrderId : null)
  const paypalPoll = useBookingByPaypalOrder(isPaypalDraft ? paypalOrderId : null)
  const capturePaypal = useCapturePaypalPayment()
  const paypalNavigatedRef = useRef(false)
  const paypalCapturedRef = useRef(false)

  const paypalOrderStatus = approval.data?.orderStatus ?? null
  // Approved on PayPal's side but not yet captured by us — capture it here
  // rather than sending the customer back to a page they have already left.
  const paypalShouldCapture =
    paypalOrderStatus === 'APPROVED' || paypalOrderStatus === 'COMPLETED'

  useEffect(() => {
    if (!isPaypalDraft || !paypalShouldCapture || !paypalOrderId || paypalCapturedRef.current) return
    paypalCapturedRef.current = true
    capturePaypal.mutate(paypalOrderId)
  }, [isPaypalDraft, paypalShouldCapture, paypalOrderId, capturePaypal])

  // Either the capture call or the webhook may have materialized the booking —
  // whichever lands first wins, and the ref makes a refresh after navigation a
  // no-op.
  useEffect(() => {
    const bookingId = capturePaypal.data?.booking?.id || paypalPoll.data?.booking?.id
    if (!bookingId || paypalNavigatedRef.current) return
    paypalNavigatedRef.current = true
    navigate(`/booking/confirmation/${bookingId}`, { replace: true })
  }, [capturePaypal.data?.booking?.id, paypalPoll.data?.booking?.id, navigate])

  const onElementsReady = useCallback((handle: CheckoutElementsHandle) => {
    elementsHandleRef.current = handle
  }, [])

  const onElementsState = useCallback((s: { ready: boolean; complete: boolean }) => {
    setElementsState(s)
  }, [])

  // Release the hold exactly once when the countdown runs out (ref guard — the
  // mutation itself is idempotent server-side).
  useEffect(() => {
    if (holdExpired && draftId && !expiryReleasedRef.current) {
      expiryReleasedRef.current = true
      release.mutate(draftId)
    }
  }, [holdExpired, draftId, release])

  const handlePay = useCallback(async () => {
    if (!elementsHandleRef.current || processing || holdExpired || !draft) return
    setProcessing(true)
    setPaymentError(null)
    setShowAnimation(true)
    const result = await elementsHandleRef.current.confirm()
    if (result.error) {
      setPaymentError(result.error.message || 'Payment could not be completed. Please try again.')
      setProcessing(false)
      setShowAnimation(false)
    }
    // On success Stripe redirects the browser — the overlay stays up until the
    // redirect lands, then this React tree unmounts cleanly.
  }, [processing, holdExpired, draft])

  const handleCancel = useCallback(() => {
    if (draftId) release.mutate(draftId)
    if (!draft) {
      navigate('/')
      return
    }
    navigate(`${bookingPath(draft.tour.id, draft.tour.slug)}`)
  }, [draft, draftId, release, navigate])

  // Loading skeleton while the server summary + fresh secret resolve.
  if (isLoading || (!draft && draftId && !isError)) {
    return (
      <div className="co-page">
        <div className="co-body co-skeleton">
          {/* LEFT — branded panel skeleton */}
          <div className="co-left">
            <div className="co-left-inner">
              <div className="co-skel co-skel-logo" />
              <div className="co-skel-eyebrow-wrap">
                <div className="co-skel co-skel-eyebrow" />
              </div>
              <div className="co-skel co-skel-title" />
              <div className="co-skel co-skel-price" />

              <div className="co-skel-card-wrap">
                <div className="co-skel co-skel-card-img" />
                <div className="co-skel-card-text">
                  <div className="co-skel co-skel-card-line co-skel-card-line-title" />
                  <div className="co-skel co-skel-card-line" />
                  <div className="co-skel co-skel-card-line co-skel-card-line-short" />
                </div>
              </div>

              <div className="co-skel co-skel-divider" />
              <div className="co-skel-card-row">
                <div className="co-skel co-skel-row-label" />
                <div className="co-skel co-skel-row-value" />
              </div>
              <div className="co-skel-card-row">
                <div className="co-skel co-skel-row-label" />
                <div className="co-skel co-skel-row-value" />
              </div>
              <div className="co-skel co-skel-divider" />
              <div className="co-skel-card-row">
                <div className="co-skel co-skel-row-label co-skel-row-total" />
                <div className="co-skel co-skel-row-value co-skel-row-total" />
              </div>
            </div>
          </div>

          {/* RIGHT — payment pane skeleton */}
          <div className="co-right">
            <div className="co-skel-right-inner">
              <div className="co-skel co-skel-label" />
              <div className="co-skel co-skel-input" />
              <div className="co-skel co-skel-label co-skel-label-wide" />
              <div className="co-skel co-skel-card-area" />
              <div className="co-skel co-skel-btn" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Unavailable / expired checkout — full-page state (no split layout).
  // ── PayPal draft ─────────────────────────────────────────────────────────
  // Nothing here can collect money — Stripe has no PaymentIntent for this hold.
  // The page either sends the customer back to PayPal, confirms a payment they
  // already approved, or reports honestly that the hold is gone.
  if (isPaypalDraft) {
    const bookingId = capturePaypal.data?.booking?.id || paypalPoll.data?.booking?.id
    const holdGone =
      approval.data?.status === 'EXPIRED' ||
      approval.data?.status === 'REFUNDED' ||
      paypalPoll.data?.status === 'EXPIRED' ||
      paypalPoll.data?.status === 'REFUNDED'
    const failed = approval.isError || capturePaypal.isError || holdExpired || (holdGone && !bookingId)
    const confirming = !failed && !approval.isLoading &&
      (Boolean(bookingId) || paypalShouldCapture || capturePaypal.isPending || capturePaypal.isSuccess)
    const showLink = !failed && !confirming && !approval.isLoading && Boolean(approval.data?.approvalUrl)

    const failureMessage =
      (capturePaypal.error instanceof Error && capturePaypal.error.message) ||
      (approval.error instanceof Error && approval.error.message) ||
      (approval.data?.status === 'REFUNDED' || paypalPoll.data?.status === 'REFUNDED'
        ? 'This booking hold ended before your payment completed. You have been refunded in full.'
        : 'This booking hold expired before the payment could be completed. Please start again from your tour.')

    const title = failed
      ? "Payment couldn't be completed"
      : confirming
        ? 'Confirming your payment'
        : approval.isLoading
          ? 'Loading your payment…'
          : showLink
            ? 'Continue to PayPal'
            : 'Payment unavailable'

    const body = failed
      ? failureMessage
      : confirming
        ? 'PayPal is confirming this payment. Your spot is held — this only takes a moment.'
        : approval.isLoading
          ? 'Fetching the status of your payment…'
          : showLink
            ? 'Your spot is held while you pay. You will return to this site as soon as PayPal finishes.'
            : 'This payment can no longer be completed from here. Please start again from your tour.'

    return (
      <div className="co-page">
        <div className="co-state co-state-card">
          <div className={`co-state-icon${failed ? ' co-state-icon-warn' : ''}`}>
            {failed ? <Lock size={22} /> : <Loader2 size={22} className="animate-spin" />}
          </div>
          <h1 className="co-state-title">{title}</h1>
          <p className="co-state-body">{body}</p>
          <div className="co-state-actions">
            {showLink && (
              <a
                className="co-btn co-btn-solid"
                href={approval.data?.approvalUrl as string}
                rel="noopener noreferrer"
              >
                Continue to PayPal <ExternalLink size={14} />
              </a>
            )}
            <button type="button" className="co-btn co-btn-ghost" onClick={() => navigate('/')}>
              Return home
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isError || !draft || !clientSecret || !returnUrl) {
    return (
      <div className="co-page">
        <div className="co-state co-state-card">
          <div className="co-state-icon">
            <Lock size={22} />
          </div>
          <h1 className="co-state-title">Checkout unavailable</h1>
          <p className="co-state-body">
            {isError
              ? 'We could not load your reservation. It may have expired or already been completed.'
              : 'Your reservation could not be continued. Please start again from your tour.'}
          </p>
          <div className="co-state-actions">
            {draft?.tour && (
              <Link className="co-btn co-btn-solid" to={`${bookingPath(draft.tour.id, draft.tour.slug)}`}>
                Back to booking
              </Link>
            )}
            <button type="button" className="co-btn co-btn-ghost" onClick={() => navigate('/')}>
              Return home
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (holdExpired) {
    return (
      <div className="co-page">
        <div className="co-state co-state-card">
          <div className="co-state-icon co-state-icon-warn">
            <Lock size={22} />
          </div>
          <h1 className="co-state-title">Your hold expired</h1>
          <p className="co-state-body">The reserved spot has been released. Start again to rebook before it's gone.</p>
          <div className="co-state-actions">
            <Link className="co-btn co-btn-solid" to={`${bookingPath(draft.tour.id, draft.tour.slug)}`}>
              Rebook this tour
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const payDisabled = !elementsState.ready || !elementsState.complete || processing

  return (
    <div className="co-page">
      <SEO title="Checkout" robots="noindex, nofollow" />
      <div className="co-body">
        {/* LEFT — brand panel + order summary (desktop/tablet) */}
        <aside className="co-left">
          <header className="co-header">
            <BackButton onClick={handleCancel} />
          </header>

          <div className="co-left-inner">
            <div className="co-brand">
              <img src={logoSrc} alt="Travio Ghana" className="co-logo" />
            </div>

            <div className="co-lockup">
              <span className="co-eyebrow">Secure checkout</span>
              <h1 className="co-title">Complete your booking</h1>
              <div className="co-total">{formatMoney(draft.pricing.total, draft.currency)}</div>
            </div>

            <OrderSummary draft={draft} expiresAt={draft?.expiresAt} />

            <p className="co-security">
              <ShieldCheck size={14} />
              Payments are securely processed by Stripe. We never store your card details.
            </p>
          </div>
        </aside>

        {/* RIGHT — payment (mobile shows only this pane) */}
        <section className="co-right" aria-label="Payment details">
          <header className="co-mobile-top">
            <BackButton onClick={handleCancel} />
            <div className="co-brand">
              <img src={logoSrc} alt="Travio Ghana" className="co-logo" />
            </div>
            <div className="co-header-spacer" />
          </header>

          {/* Mobile collapsed order summary (Stripe-like) */}
          <div className="co-mobile-summary">
            <button
              type="button"
              className="co-summary-toggle"
              aria-expanded={mobileSummaryOpen}
              onClick={() => setMobileSummaryOpen((v) => !v)}
            >
              <span className="co-summary-label">Order summary</span>
              <span className="co-summary-total">{formatMoney(draft.pricing.total, draft.currency)}</span>
              <ChevronDown size={16} className={mobileSummaryOpen ? 'co-summary-caret co-rotated' : 'co-summary-caret'} />
            </button>
            {mobileSummaryOpen && (
              <div className="co-summary-details">
                <OrderSummary draft={draft} expiresAt={draft?.expiresAt} light />
              </div>
            )}
          </div>

          <div className="co-pay-col">
            <div className="co-field">
              <label className="co-label" htmlFor="co-email">Contact email</label>
              <input
                id="co-email"
                className="co-input"
                type="email"
                readOnly
                value={draft.leadTraveler.email || ''}
              />
            </div>

            {draft.leadTraveler.phone && (
              <div className="co-field">
                <label className="co-label" htmlFor="co-phone">Contact phone</label>
                <input
                  id="co-phone"
                  className="co-input"
                  type="tel"
                  readOnly
                  value={formatPhoneDisplay(draft.leadTraveler.phone)}
                />
              </div>
            )}

            <div className="co-element-wrap">
              <span className="co-label">Card / payment method</span>
              <CheckoutElements
                clientSecret={clientSecret}
                customerSessionClientSecret={draft.customerSessionClientSecret || undefined}
                returnUrl={returnUrl}
                email={draft.leadTraveler.email || undefined}
                onReady={onElementsReady}
                onStateChange={onElementsState}
              />
            </div>

            {paymentError && (
              <p className="co-error" role="alert">
                {paymentError}
              </p>
            )}

            <button
              type="button"
              className="co-pay"
              disabled={payDisabled}
              onClick={handlePay}
              aria-busy={processing}
            >
              {processing ? (
                <>
                  <Loader2 size={18} className="co-spin" />
                  Processing…
                </>
              ) : (
                <>Pay {formatMoney(draft.pricing.total, draft.currency)}</>
              )}
            </button>

            <p className="co-terms">
              By paying you agree to the tour's cancellation policy and our{' '}
              <Link to="/terms-and-conditions" className="co-link">terms</Link>.
            </p>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {showAnimation && (
          <BookingTransition onDone={() => {}} caption="Processing your payment" animationSrc="/animations/cash-or-card.lottie" />
        )}
      </AnimatePresence>
    </div>
  )
}



