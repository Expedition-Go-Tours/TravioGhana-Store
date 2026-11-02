import { useState } from 'react'
import { BellRing, CheckCircle2, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { joinWaitlist } from '../../lib/storefrontExtras'
import './WaitlistForm.css'

const EMAIL_KEY = 'travio_waitlist_email'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface WaitlistFormProps {
  tourId: string
  /** YYYY-MM-DD of the date that is full — exactly what the backend keys on. */
  dateKey: string
  /** Human date for the confirmation copy ("Wed, 4 Nov 2026"). */
  dateLabel: string
}

/**
 * "Tell me if this date opens up."
 *
 * Shown only for a date the availability calendar reports as full. The copy is
 * deliberately explicit that no seat is held — availability is live and first
 * come, first served — because a waitlist that implied a reservation would be
 * a promise the platform cannot keep.
 *
 * Guests may join: the endpoint is optional-auth and only needs an email, the
 * same way a booking needs only an email to reach someone.
 */
export default function WaitlistForm({ tourId, dateKey, dateLabel }: WaitlistFormProps) {
  const { t } = useTranslation()
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(EMAIL_KEY) || ''
    } catch {
      return ''
    }
  })
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const valid = EMAIL_RE.test(email.trim())

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    try {
      const result = await joinWaitlist({ tourId, travelDate: dateKey, email: email.trim() })
      if (!result.ok) {
        toast.error(result.reason || t('waitlist.failed', 'Could not join the waitlist. Please try again.'))
        return
      }
      try {
        localStorage.setItem(EMAIL_KEY, email.trim())
      } catch {
        /* private mode — the email still works, it just will not prefill */
      }
      setDone(true)
      toast.success(
        result.alreadyJoined
          ? t('waitlist.already', "You're already on the list for this date.")
          : t('waitlist.joined', "We'll email you if a spot opens on this date.")
      )
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="waitlist-panel waitlist-panel-done" role="status">
        <CheckCircle2 size={18} className="waitlist-icon" aria-hidden="true" />
        <div className="waitlist-copy">
          <strong>{t('waitlist.doneTitle', "You're on the list")}</strong>
          <p>
            {t('waitlist.doneBody', 'We\'ll email {{email}} as soon as a spot opens on {{date}}.', {
              email: email.trim(),
              date: dateLabel,
            })}
          </p>
          <small>{t('waitlist.noHold', 'No seat is held for you — booking is first come, first served.')}</small>
        </div>
      </div>
    )
  }

  return (
    <form className="waitlist-panel" onSubmit={handleJoin}>
      <div className="waitlist-heading">
        <BellRing size={16} aria-hidden="true" />
        <strong>{t('waitlist.title', 'This date is fully booked')}</strong>
      </div>
      <p className="waitlist-sub">
        {t('waitlist.subtitle', 'Leave your email and we\'ll tell you the moment a spot opens on {{date}}.', {
          date: dateLabel,
        })}
      </p>
      <div className="waitlist-row">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          className="waitlist-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('waitlist.placeholder', 'you@example.com')}
          aria-label={t('waitlist.emailLabel', 'Email address')}
          required
        />
        <button type="submit" className="waitlist-submit" disabled={!valid || saving}>
          {saving ? (
            <Loader2 size={16} className="waitlist-spinner" aria-hidden="true" />
          ) : (
            t('waitlist.cta', 'Notify me')
          )}
        </button>
      </div>
      <small className="waitlist-fineprint">{t('waitlist.fineprint', 'One email, only if something changes.')}</small>
    </form>
  )
}
