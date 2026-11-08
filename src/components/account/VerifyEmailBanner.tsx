import { useState } from 'react'
import { CheckCircle2, Loader2, MailWarning } from 'lucide-react'
import { useAuthUser } from '@/hooks/useAuthUser'
import { fetchWithAuth } from '@/lib/api'
import './VerifyEmailBanner.css'

type SendState = 'idle' | 'sending' | 'sent' | 'error'

/**
 * Compact dashboard banner for a password account that has not verified its
 * email yet.
 *
 * The flag comes from the stored user (`/users/me`, login and register all
 * return it), so this needs no extra request. `undefined` means an older
 * cached session from before `emailVerified` was returned — stay quiet rather
 * than nag someone who may already be verified.
 *
 * Guests who never signed up never reach the dashboard, and Google/reset
 * accounts are verified on arrival, so this only targets the one real case:
 * an email/password signup that has not clicked the link.
 */
export default function VerifyEmailBanner() {
  const user = useAuthUser()
  const [state, setState] = useState<SendState>('idle')

  if (!user || user.emailVerified !== false) return null

  const resend = async () => {
    if (state === 'sending') return
    setState('sending')
    try {
      const res = await fetchWithAuth('/auth/verify-email/send', { method: 'POST' })
      setState(res.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="verify-banner" role="status">
      <span className="verify-banner-icon" aria-hidden="true">
        {state === 'sent' ? <CheckCircle2 size={18} /> : <MailWarning size={18} />}
      </span>
      <div className="verify-banner-copy">
        <strong className="verify-banner-title">
          {state === 'sent' ? 'Verification email sent' : 'Verify your email address'}
        </strong>
        <p className="verify-banner-body">
          {state === 'sent'
            ? `Check ${user.email} for the link. It expires in 24 hours.`
            : `Confirm ${user.email} to see bookings you made as a guest and keep them in this account.`}
          {state === 'error' && ' We could not send it just now — please try again.'}
        </p>
      </div>
      {state !== 'sent' && (
        <button
          type="button"
          className="verify-banner-action"
          onClick={resend}
          disabled={state === 'sending'}
        >
          {state === 'sending' ? <Loader2 size={15} className="verify-banner-spinner" /> : null}
          {state === 'sending' ? 'Sending…' : 'Resend email'}
        </button>
      )}
    </div>
  )
}
