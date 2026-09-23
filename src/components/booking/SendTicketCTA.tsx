import { Mail } from 'lucide-react'
import './SendTicketCTA.css'

interface SendTicketCTAProps {
  /** Recipient of the email — the customer's own address. */
  email?: string
  bookingNumber?: string
  tourTitle?: string
}

export default function SendTicketCTA({ email, bookingNumber, tourTitle }: SendTicketCTAProps) {
  // Nothing to send to when we don't know the customer's address.
  if (!email) return null

  const handleClick = () => {
    const subject = encodeURIComponent(`Your booking ${bookingNumber || ''} – ${tourTitle || 'Travio Ghana'}`)
    const body = encodeURIComponent(
      `Hi,\n\nHere are the details for your upcoming experience:\n\n` +
      `Booking: ${bookingNumber || '—'}\n` +
      `Tour: ${tourTitle || '—'}\n\n` +
      `You can view your full booking at: ${window.location.href}\n\n` +
      `— Travio Ghana`
    )
    // Opens the customer's mail client pre-addressed to themselves without
    // leaving the confirmation page.
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
  }

  return (
    <button className="send-ticket-btn" onClick={handleClick} type="button">
      <Mail size={16} />
      Email my confirmation
    </button>
  )
}
