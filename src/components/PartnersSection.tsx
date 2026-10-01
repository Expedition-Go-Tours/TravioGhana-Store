import { useTranslation } from 'react-i18next'
import './PartnersSection.css'
import trippySrc from '../assets/icons/partners/trippy.webp'
import bookingSrc from '../assets/icons/partners/booking-com.webp'
import getyourguideSrc from '../assets/icons/partners/getyourguide.webp'
import civitatisSrc from '../assets/icons/partners/civitatis.webp'
import toughaSrc from '../assets/icons/partners/tougha.webp'
import paypalSrc from '../assets/icons/partners/paypal.webp'
import bokunSrc from '../assets/icons/partners/bokun.webp'
import gtaSrc from '../assets/icons/partners/gta.webp'
import tourhubSrc from '../assets/icons/partners/tourhub.webp'
import stripeSrc from '../assets/icons/partners/stripe.webp'
import nextSrc from '../assets/icons/partners/next1.webp'
import peSrc from '../assets/icons/partners/pe.webp'
import tqSrc from '../assets/icons/partners/tq.webp'
import marriotSrc from '../assets/icons/partners/marriott.webp'
import viatorSrc from '../assets/icons/partners/viator.webp'

/**
 * Public marketplace profiles for the operating company. Tripadvisor and
 * GetYourGuide are operator pages; Viator has no public supplier hub, so the
 * flagship Cape Coast product page stands in — its text fragment scrolls to
 * and highlights the "Supplied by Expedition-Go Tours Ltd" line. Deliberately
 * not part of `brandSocial`'s `sameAs`: these are marketplace listings, not
 * profiles the brand owns.
 */
const TRIPADVISOR_PROFILE_URL =
  'https://www.tripadvisor.com/Attraction_Review-g293797-d24155300-Reviews-Expedition_Go_Tours_Ltd-Accra_Greater_Accra.html'
const GETYOURGUIDE_PROFILE_URL = 'https://www.getyourguide.com/expedition-go-tours-s484318/'
const VIATOR_PROFILE_URL =
  'https://www.viator.com/tours/Accra/Touring-Cape-Coast/d5517-358551P1#:~:text=Supplied%20by-,Expedition%2DGo%20Tours%20Ltd,-Cancellation%20Policy'

interface PartnerLogo {
  src: string
  alt: string
  tall?: boolean
  /** Marketplaces with a public page for the company link there. */
  href?: string
}

const logos: PartnerLogo[] = [
  { src: trippySrc, alt: 'Tripadvisor', href: TRIPADVISOR_PROFILE_URL },
  { src: bookingSrc, alt: 'Booking.com' },
  { src: getyourguideSrc, alt: 'GetYourGuide', href: GETYOURGUIDE_PROFILE_URL },
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
  { src: viatorSrc, alt: 'Viator', href: VIATOR_PROFILE_URL },
]

export default function PartnersSection() {
  const { t } = useTranslation()
  return (
    <section className="partners-section" aria-labelledby="partners-heading">
      <div className="partners-container">
        <div className="partners-viewport">
          <div className="partners-divider">
            <span className="partners-divider-line"></span>
            <span className="partners-divider-star">&#10022;</span>
            <span className="partners-divider-line"></span>
          </div>
          <h2 className="partners-heading" id="partners-heading">{t('partners.heading')}</h2>
          <p className="partners-subtitle">{t('partners.subtitle')}</p>
          <div className="partners-track-wrap">
            <div className="partners-track">
              {[...logos, ...logos].map((logo, i) => {
                // The second half duplicates the first for the seamless marquee
                // loop — it is decorative and must stay out of the a11y tree.
                // `tabIndex={-1}` on the clone anchors keeps them out of the
                // keyboard order while aria-hidden, yet still clickable.
                const isClone = i >= logos.length
                const cardClass = `partner-logo-card${logo.tall ? ' partner-logo-card--tall' : ''}`
                const image = (
                  <img
                    src={logo.src}
                    alt={isClone ? '' : logo.alt}
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    width={120}
                    height={40}
                  />
                )
                return (
                  <div
                    key={`${logo.alt}-${i}`}
                    className="partner-logo-wrap"
                    aria-hidden={isClone || undefined}
                  >
                    {logo.href ? (
                      <a
                        className={cardClass}
                        href={logo.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        tabIndex={isClone ? -1 : undefined}
                      >
                        {image}
                      </a>
                    ) : (
                      <div className={cardClass}>{image}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
