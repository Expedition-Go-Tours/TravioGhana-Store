import { useEffect, useRef } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react'
import { useAuthUser } from '../hooks/useAuthUser'
import { setAuthReturnTo } from '../lib/auth'
import { useCapturePaypalPayment, useBookingByPaypalOrder, usePaypalApproval, type PaypalApprovalResult } from '../hooks/useExpeditionBookings'

/**
 * PayPal return route — GET /booking/paypal/return?token=<orderId>
 *
 * This is the URL PayPal redirects the browser to (see `return_url` in the
 * backend's createOrder), so it has to be tolerant: it may arrive after the
 * webhook already settled the booking, before any webhook landed, twice (a
 * refresh), or signed out if the session expired while the customer was away.
 *
 * Rules it follows:
 *  - the SERVER decides whether the payment succeeded — this page never
 *    declares success, it captures (idempotent) and then polls;
 *  - a capture that comes back as 202 just keeps polling, because PayPal can
 *    settle a capture asynchronously;
 *  - a hold that expired, sold out or was refunded is reported honestly with
 *    the backend's own message rather than an infinite spinner.
 */
export default function PaypalReturnPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthUser()

  // PayPal appends its own `token` (the order id). `orderId` is accepted too so
  // a hand-built link still works.
  const orderId = searchParams.get('token') || searchParams.get('orderId')

  const capture = useCapturePaypalPayment()
  // Poll immediately, not only after the capture call: the webhook may have
  // settled the booking while the browser was still on PayPal's page.
  const poll = useBookingByPaypalOrder(orderId)
  // Same order, read for its tour/amount summary — the page must never render
  // as an empty panel while PayPal is being confirmed.
  const approval = usePaypalApproval(orderId)

  const captureFiredRef = useRef(false)
  const navigatedRef = useRef(false)

  // Signed-out return (expired session): the capture endpoint requires the
  // booking owner, so send them through login and land back here with the same
  // order id intact. The redirect is the effect's only job — the "signing in"
  // panel below is derived from `user`, not from state, so there is no
  // setState-in-effect to trigger a cascading render.
  useEffect(() => {
    if (user) return
    setAuthReturnTo(`${location.pathname}${location.search}`)
    navigate('/login', { replace: true })
  }, [user, location.pathname, location.search, navigate])

  // Capture exactly once. Safe to call again after a reload: the endpoint is
  // idempotent (PayPal-Request-Id keyed), and the poll below covers the race.
  useEffect(() => {
    if (!orderId || !user || captureFiredRef.current) return
    captureFiredRef.current = true
    capture.mutate(orderId)
  }, [orderId, user, capture])

  const captureResult = capture.data
  const polledStatus = poll.data?.status
  const bookingId = captureResult?.booking?.id || poll.data?.booking?.id || null

  // ── Success: a Booking exists (from the capture or from the webhook) ──
  useEffect(() => {
    if (!bookingId || navigatedRef.current) return
    navigatedRef.current = true
    navigate(`/booking/confirmation/${bookingId}`, { replace: true })
  }, [bookingId, navigate])

  if (!orderId) {
    return (
      <ReturnShell orderId={orderId} summary={approval.data?.summary ?? null}>
        <Panel
          tone="error"
          title="We couldn't find that payment"
          body="The link from PayPal didn't include a payment reference. Nothing was charged twice — start again from the tour page."
          action={{ label: 'Back to booking', href: '/booking' }}
        />
      </ReturnShell>
    )
  }

  // Rendered while the login redirect above is in flight.
  if (!user) {
    return (
      <ReturnShell orderId={orderId} summary={approval.data?.summary ?? null}>
        <Panel
          tone="busy"
          title="Signing you in…"
          body="PayPal sent you back, but your session ended. Sign in again to confirm this payment."
        />
      </ReturnShell>
    )
  }

  // ── Capture refused (declined, hold already gone, unknown order) ─────────
  // The poll only runs in the background; a refused capture must not leave the
  // customer staring at a spinner, so the server's own message is shown.
  if (capture.isError && !bookingId) {
    return (
      <ReturnShell orderId={orderId} summary={approval.data?.summary ?? null}>
        <Panel
          tone="error"
          title="Payment couldn't be completed"
          body={
            capture.error instanceof Error && capture.error.message
              ? capture.error.message
              : 'PayPal could not confirm this payment. You have not been charged twice — please try again.'
          }
          action={{ label: 'Back to booking', href: '/booking' }}
        />
      </ReturnShell>
    )
  }

  // ── Terminal hold: expired or refunded before a Booking existed ──────────
  if ((polledStatus === 'EXPIRED' || polledStatus === 'REFUNDED') && !bookingId) {
    return (
      <ReturnShell orderId={orderId} summary={approval.data?.summary ?? null}>
        <Panel
          tone="error"
          title={polledStatus === 'REFUNDED' ? 'You have been refunded' : "Payment couldn't be completed"}
          body={
            polledStatus === 'REFUNDED'
              ? 'This booking hold ended before your payment completed. You have been refunded in full.'
              : 'This booking hold expired before we could confirm the payment. Start again to book your spot.'
          }
          action={{ label: 'Back to booking', href: '/booking' }}
        />
      </ReturnShell>
    )
  }

  // ── In flight: capturing, or waiting on PayPal to settle the capture ─────
  return (
    <ReturnShell orderId={orderId} summary={approval.data?.summary ?? null}>
      <Panel
        tone="busy"
        title="Confirming your payment"
        body={
          captureResult?.status === 'PROCESSING' || polledStatus === 'HOLDING'
            ? 'PayPal is still confirming this payment. This usually takes a few seconds — please keep this page open.'
            : 'Finishing up with PayPal. Your spot is held while we confirm.'
        }
      />
    </ReturnShell>
  )
}

function OrderSummary({ orderId, summary }: { orderId: string; summary: PaypalApprovalResult['summary'] }) {
  if (!summary?.tourTitle) return null;
  const money = `${summary.currency || 'USD'} ${Number(summary.amount || 0).toFixed(2)}`;
  return (
    <div className="mb-4 rounded-2xl border border-slate-200/60 bg-slate-50/50 p-4 text-left">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Your booking</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{summary.tourTitle}</p>
      <p className="mt-0.5 text-xs text-slate-500">
        {money}
        {summary.travelDate ? ` · ${new Date(summary.travelDate).toDateString()}` : ''}
      </p>
      <p className="mt-1 text-[10px] text-slate-400 break-all">PayPal ref: {orderId}</p>
    </div>
  );
}

function ReturnShell({ children, orderId, summary }: {
  children: React.ReactNode
  orderId: string | null
  summary: PaypalApprovalResult['summary']
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {orderId && <OrderSummary orderId={orderId} summary={summary} />}
        {children}
      </div>
    </div>
  )
}

function Panel({
  tone,
  title,
  body,
  action,
}: {
  tone: 'busy' | 'error'
  title: string
  body: string
  action?: { label: string; href: string }
}) {
  const isBusy = tone === 'busy'
  return (
    <div className="rounded-[1.75rem] border border-slate-200/40 bg-white p-8 text-center shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
      <div
        className={`mx-auto grid size-12 place-items-center rounded-full ${
          isBusy ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
        }`}
      >
        {isBusy ? <Loader2 className="size-6 animate-spin" /> : <AlertTriangle className="size-6" />}
      </div>
      <h1 className="mt-4 text-lg font-bold text-slate-900 tracking-tight">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
      {action && (
        <a
          href={action.href}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-7 py-3 text-sm font-bold text-white shadow-sm transition hover:brightness-110"
        >
          {action.label}
          <ExternalLink className="size-4" />
        </a>
      )}
    </div>
  )
}
