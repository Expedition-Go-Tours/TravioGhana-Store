import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Ticket, X } from 'lucide-react'
import { toast } from 'sonner'
import { useGuestClaim } from '../../hooks/useGuestClaim'
import './GuestClaimPrompt.css'

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * One-time prompt after sign-in: the account email matches bookings made as a
 * guest. The server has already verified the address and filtered the list;
 * this component only presents the choice and confirms it.
 */
export default function GuestClaimPrompt() {
  const { user, preview, busy, error, claim, dismiss } = useGuestClaim()
  const navigate = useNavigate()

  useEffect(() => {
    if (!preview) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) dismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [preview, busy, dismiss])

  if (!user?.id || !preview) return null

  const handleClaim = async () => {
    const result = await claim()
    if (!result) return
    toast.success(
      result.claimed === 1
        ? 'Booking added to your account'
        : `${result.claimed} bookings added to your account`,
    )
    navigate('/dashboard/bookings')
  }

  const nameDiffers = (leadTravelerName: string) =>
    Boolean(leadTravelerName && user.name && leadTravelerName.toLowerCase() !== user.name.toLowerCase())

  return (
    <div className="guest-claim-overlay">
      <div
        className="guest-claim-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-claim-title"
      >
        <button
          type="button"
          className="guest-claim-close"
          onClick={dismiss}
          disabled={busy}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <p className="guest-claim-eyebrow">Bookings found</p>
        <h2 id="guest-claim-title" className="guest-claim-title">
          We found {preview.count} booking{preview.count === 1 ? '' : 's'} for {user.email}
        </h2>
        <p className="guest-claim-body">
          Add them to this account so you can manage dates, pickup and vouchers in one place.
        </p>

        <ul className="guest-claim-list">
          {preview.bookings.map((booking) => (
            <li key={booking.id} className="guest-claim-item">
              <div className="guest-claim-item-main">
                <span className="guest-claim-item-title">{booking.tourTitle}</span>
                <span className="guest-claim-item-meta">
                  <CalendarDays size={13} aria-hidden="true" />
                  {formatDate(booking.travelDate)}
                </span>
                {nameDiffers(booking.leadTravelerName) && (
                  <span className="guest-claim-item-meta">
                    Booked for {booking.leadTravelerName}
                  </span>
                )}
              </div>
              <span className="guest-claim-ref">
                <Ticket size={13} aria-hidden="true" />
                {booking.bookingNumber}
              </span>
            </li>
          ))}
        </ul>

        {preview.count > preview.bookings.length && (
          <p className="guest-claim-more">and {preview.count - preview.bookings.length} more</p>
        )}

        {error && <p className="guest-claim-error" role="alert">{error}</p>}

        <div className="guest-claim-actions">
          <button type="button" className="guest-claim-primary" onClick={handleClaim} disabled={busy}>
            {busy ? 'Adding…' : 'Add to my account'}
          </button>
          <button type="button" className="guest-claim-secondary" onClick={dismiss} disabled={busy}>
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
