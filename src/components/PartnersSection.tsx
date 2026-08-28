import { useTranslation } from 'react-i18next'
import './PartnersSection.css'
import trippySrc from '../assets/icons/trippy.png'
import bookingSrc from '../assets/icons/booking-com.png'
import getyourguideSrc from '../assets/icons/getyourguide.png'
import civitatisSrc from '../assets/icons/Civitatis-Logo.png'
import toughaSrc from '../assets/icons/TOUGHA.png'
import paypalSrc from '../assets/icons/paypal.png'
import bokunSrc from '../assets/icons/bokun.png'
import gtaSrc from '../assets/icons/GTA.png'
import tourhubSrc from '../assets/icons/tourhub.png'
import stripeSrc from '../assets/icons/STRIPE.png'
import nextSrc from '../assets/icons/NEXT1.png'
import peSrc from '../assets/icons/PE.png'
import tqSrc from '../assets/icons/TQ.png'
import marriotSrc from '../assets/icons/MARRIOT.png'
import viatorSrc from '../assets/icons/viator.png'

const logos = [
  { src: trippySrc, alt: 'Tripadvisor' },
  { src: bookingSrc, alt: 'Booking.com' },
  { src: getyourguideSrc, alt: 'GetYourGuide' },
  { src: civitatisSrc, alt: 'Civitatis' },
  { src: toughaSrc, alt: 'TOUGHA' },
  { src: paypalSrc, alt: 'PayPal', tall: true },
  { src: bokunSrc, alt: 'Bokun', tall: true },
  { src: gtaSrc, alt: 'GTA' },
  { src: tourhubSrc, alt: 'TourHub', tall: true },
  { src: stripeSrc, alt: 'Stripe', tall: true },
  { src: nextSrc, alt: 'NEXT', tall: true },
  { src: peSrc, alt: 'PE', tall: true },
  { src: tqSrc, alt: 'TQ' },
  { src: marriotSrc, alt: 'Marriot' },
  { src: viatorSrc, alt: 'Viator' },
]

export default function PartnersSection() {
  const { t } = useTranslation()
  return (
    <section className="partners-section">
      <div className="partners-container">
        <div className="partners-viewport">
          <h2 className="partners-heading">{t('partners.heading')}</h2>
          <div className="partners-track-wrap">
            <div className="partners-track">
              {[...logos, ...logos].map((logo, i) => (
                <div key={`${logo.alt}-${i}`} className="partner-logo-wrap">
                  <div className={`partner-logo-card${logo.tall ? ' partner-logo-card--tall' : ''}`}>
                    <img src={logo.src} alt={logo.alt} loading="lazy" decoding="async" width={120} height={40} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
