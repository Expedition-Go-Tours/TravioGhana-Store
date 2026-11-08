import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { fetchWithAuth } from '../lib/api'
import {
  clearAuthReturnTo,
  getAuthReturnTo,
  getStoredAuthUser,
  refreshStoredUserFromBackend,
} from '../lib/auth'
import './BookingConfirmationPage.css'

type ViewState = 'loading' | 'success' | 'error'

/**
 * Public landing page for the verification email.
 *
 * The token is posted in the request body, then stripped from the address bar
 * before anything else renders. The page never requires the visitor to be
 * signed in: the link is often opened in a mail app's browser, and the token
 * is the credential.
 */
export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''
  const [state, setState] = useState<ViewState>(token ? 'loading' : 'error')
  const [message, setMessage] = useState(
    token ? '' : 'This verification link is missing its token. Open the link from your email and try again.',
  )
  const [signedIn, setSignedIn] = useState(() => Boolean(getStoredAuthUser()))
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    document.title = 'Verify your email · Travio Ghana'
  }, [])

  useEffect(() => {
    if (!token) return

    // Drop the token from the URL and history immediately.
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('token')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    } catch {
      // history is best-effort; the token is still sent in the POST body
    }

    if (started.current) return
    started.current = true

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetchWithAuth('/auth/verify-email/confirm', {
          method: 'POST',
          body: JSON.stringify({ token }),
        })
        const payload = await res.json().catch(() => ({}))
        if (cancelled) return

        if (!res.ok) {
          setState('error')
          setMessage(payload?.message || 'This verification link is invalid or has expired.')
          return
        }

        await refreshStoredUserFromBackend().catch(() => null)
        if (cancelled) return

        setSignedIn(Boolean(getStoredAuthUser()))
        setState('success')
      } catch {
        if (!cancelled) {
          setState('error')
          setMessage('We could not verify this link. Check your connection and try again.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token])

  const resendVerification = async () => {
    setResending(true)
    setResent(false)
    try {
      const res = await fetchWithAuth('/auth/verify-email/send', { method: 'POST' })
      if (res.ok) setResent(true)
    } catch {
      // The error view already explains the link problem; leave it in place.
    } finally {
      setResending(false)
    }
  }

  const continueToBookings = () => {
    const returnTo = getAuthReturnTo()
    clearAuthReturnTo()
    navigate(returnTo || '/dashboard/bookings')
  }

  if (state === 'loading') {
    return (
      <div className="confirmation-page">
        <div className="confirmation-card confirmation-card-processing">
          <div className="confirmation-icon processing">
            <Loader2 className="size-10 confirmation-spinner" />
          </div>
          <h2 className="confirmation-title">Verifying your email…</h2>
          <p className="confirmation-message">This only takes a moment.</p>
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="confirmation-page">
        <div className="confirmation-card">
          <div className="confirmation-icon warning">
            <AlertTriangle className="size-10" />
          </div>
          <h2 className="confirmation-title">We couldn't verify this link</h2>
          <p className="confirmation-message">{message}</p>
          {resent && (
            <p className="confirmation-message" role="status">
              A new verification email is on its way. Check your inbox.
            </p>
          )}
          <div className="confirmation-actions">
            {signedIn && (
              <button
                className="confirmation-btn-primary"
                onClick={resendVerification}
                disabled={resending}
              >
                {resending ? 'Sending…' : 'Resend verification email'}
              </button>
            )}
            <button
              className={signedIn ? 'confirmation-btn-secondary' : 'confirmation-btn-primary'}
              onClick={() => navigate('/login')}
            >
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
      <div className="confirmation-card">
        <div className="confirmation-icon success">
          <CheckCircle2 className="size-10" />
        </div>
        <h2 className="confirmation-title">Email verified</h2>
        <p className="confirmation-message">
          Your address is confirmed. We can now attach bookings you made as a guest to your account.
        </p>
        <div className="confirmation-actions">
          {signedIn ? (
            <button className="confirmation-btn-primary" onClick={continueToBookings}>
              Continue to my bookings
            </button>
          ) : (
            <button className="confirmation-btn-primary" onClick={() => navigate('/login')}>
              Sign in to see your bookings
            </button>
          )}
          <button className="confirmation-btn-secondary" onClick={() => navigate('/')}>
            Back to home
          </button>
        </div>
      </div>
    </div>
  )
}
