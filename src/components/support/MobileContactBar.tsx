import { MessageCircle, Phone } from 'lucide-react'
import { SUPPORT_PHONE_DIGITS, WHATSAPP_URL } from '../../lib/support'
import './MobileContactBar.css'

export default function MobileContactBar() {
  return (
    <div className="sh-mobile-contact-bar" aria-label="Quick contact">
      <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
        <MessageCircle size={18} />
        WhatsApp
      </a>
      <a href={`tel:${SUPPORT_PHONE_DIGITS}`}>
        <Phone size={18} />
        Call support
      </a>
    </div>
  )
}
