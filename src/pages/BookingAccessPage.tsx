import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, MailQuestion } from 'lucide-react'
import { fetchWithAuth } from '../lib/api'
import { setGuestToken } from '../lib/guestSession'
import { setAuthReturnTo } from '../lib/auth'
import './BookingConfirmationPage.css'

/**
 * Public entry point for the "View booking" link in a guest confirmation
 * email.
 *
 * The email carries a signed token scoped to one booking. This page posts it
 * to the API, receives the normal GuestAccess token, stores it in
 * sessionStorage (the same credential the checkout tab uses), and replaces the
 * URL with the confirmation page so the token never lingers in the address
 * bar or browser history.
 *
 * Nothing here requires an account. If the booking has since been claimed by
 * an account, the API answers `requireLogin` and we send the visitor to sign
 * in with a return path.
 */
export default function BookingAccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''
  const [error, setError] = useState(
    token ? '' : 'This booking link is missing its access token. Open the link from your confirmation email and try again.',
  )
  const started = useRef(false)

  useEffect(() => {
    document.title = 'Open your booking · Travio Ghana'
  }, [])

  useEffect(() => {
    if (started.current) return
    started.current = true

    if (!token) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetchWithAuth('/travioghana/bookings/access/exchange', {
          method: 'POST',
          body: JSON.stringify({ token }),
        })
        const payload = await res.json().catch(() => ({}))
        if (cancelled) return

        if (!res.ok) {
          setError(payload?.message || 'This booking link is invalid or has expired.')
          return
        }

        const data = payload?.data ?? payload

        if (data?.requireLogin) {
          const id = data?.booking?.id
          const returnTo = id ? `/booking/confirmation/${encodeURIComponent(id)}` : '/'
          setAuthReturnTo(returnTo)
          navigate('/login', { replace: true })
          return
        }

        if (!data?.guestToken || !data?.booking?.id) {
          setError('This booking link is invalid or has expired.')
          return
        }

        setGuestToken(data.guestToken)
        // replace() keeps the token out of history and drops it from the URL.
        navigate(`/booking/confirmation/${encodeURIComponent(data.booking.id)}`, { replace: true })
      } catch {
        if (!cancelled) setError('We could not open this booking link. Check your connection and try again.')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token, navigate])

  if (error) {
    return (
      <div className="confirmation-page">
        <div className="confirmation-card">
          <div className="confirmation-icon warning">
            <MailQuestion className="size-10" />
          </div>
          <h2 className="confirmation-title">This link has expired</h2>
          <p className="confirmation-message">{error}</p>
          <div className="confirmation-actions">
            <button className="confirmation-btn-primary" onClick={() => navigate('/login')}>
              Sign in
            </button>
            <button className="confirmation-btn-secondary" onClick={() => navigate('/')}>
              Back to home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="confirmation-page">
      <div className="confirmation-card confirmation-card-processing">
        <div className="confirmation-icon processing">
          <Loader2 className="size-10 confirmation-spinner" />
        </div>
        <h2 className="confirmation-title">Opening your booking…</h2>
        <p className="confirmation-message">This only takes a moment.</p>
      </div>
    </div>
  )
}
