import { useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import loginImg from '../../assets/phone-screens/login.png'
import logoImg from '../../assets/phone-screens/logo.png'
import productsImg from '../../assets/phone-screens/products.png'
import activityImg from '../../assets/phone-screens/activity.webp'
import dashboardImg from '../../assets/phone-screens/dashboard.png'
import nkrumahImg from '../../assets/phone-screens/nkrumah.jpg'
import travioGImg from '../../assets/TravioGhana_Logo.svg'
import './PhoneShowcaseSection.css'

interface PhoneShowcaseSectionProps {
  onBecomeSupplier?: () => void
}

const PHONE_IMAGES = [
  { src: loginImg, alt: 'Supplier Login screen' },
  { src: logoImg, alt: 'Travio Ghana logo', underlay: { src: travioGImg, alt: 'TravioG' } },
  { src: productsImg, alt: 'Products management screen' },
  { src: activityImg, alt: 'Rafting adventure experience', overlay: { headline: 'Discover, Share, Belong', sub: 'Capture every thrill. Share your adventures with travelers who crave the extraordinary.', cta: 'Continue', skip: 'Skip' } },
  { src: dashboardImg, alt: 'Supplier dashboard with earnings' },
  { src: nkrumahImg, alt: 'Kwame Nkrumah memorial, Accra', overlay: { headline: 'Where journeys connect', sub: 'Your gateway to unforgettable experiences across Ghana.', cta: 'Continue', skip: 'Skip' } },
]

type PhoneOverlay = { headline: string; sub: string; cta: string; skip: string }
type PhoneUnderlay = { src: string; alt: string }

function PhoneMockup({ src, alt, contain, overlay, underlay }: { src: string; alt: string; contain?: boolean; overlay?: PhoneOverlay; underlay?: PhoneUnderlay }) {
  return (
    <div className="phone-mockup">
      <img src={src} alt={alt} loading="lazy" className={contain ? 'phone-img-contain' : undefined} />
      {underlay && <img src={underlay.src} alt={underlay.alt} loading="lazy" className="phone-underlay" />}
      <div className="phone-status-bar">
        <span className="phone-status-time">9:41</span>
        <div className="phone-status-icons">
          {/* Cellular signal */}
          <svg viewBox="0 0 17 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="9" width="3" height="3" rx="0.5" fill="currentColor" />
            <rect x="4.5" y="6" width="3" height="6" rx="0.5" fill="currentColor" />
            <rect x="9" y="3" width="3" height="9" rx="0.5" fill="currentColor" />
            <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill="currentColor" />
          </svg>
          {/* WiFi */}
          <svg viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 11.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5z" fill="currentColor" />
            <path d="M4.7 7.8a4.7 4.7 0 0 1 6.6 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M2.1 5.2a8 8 0 0 1 11.8 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M0 2.8a10.8 10.8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          {/* Battery */}
          <svg viewBox="0 0 25 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0.5" y="0.5" width="21" height="11" rx="2" stroke="currentColor" strokeWidth="1" />
            <rect x="22" y="3.5" width="2.5" height="5" rx="1" fill="currentColor" opacity="0.4" />
            <rect x="2" y="2" width="16" height="8" rx="1" fill="currentColor" />
          </svg>
        </div>
      </div>
      {overlay && (
        <div className="phone-overlay">
          <p className="phone-overlay-headline">{overlay.headline}</p>
          <p className="phone-overlay-sub">{overlay.sub}</p>
          <span className="phone-overlay-cta">{overlay.cta}</span>
          <span className="phone-overlay-skip">{overlay.skip}</span>
        </div>
      )}
    </div>
  )
}

const LOGO_INDEX = 1

function DesktopColumns() {
  return (
    <div className="phone-showcase-grid">
      {/* Column 1 — scrolls UP */}
      <div className="phone-showcase-column phone-showcase-column--up">
        <PhoneMockup src={PHONE_IMAGES[0].src} alt={PHONE_IMAGES[0].alt} />
        <PhoneMockup src={PHONE_IMAGES[3].src} alt={PHONE_IMAGES[3].alt} overlay={PHONE_IMAGES[3].overlay} />
        {/* Duplicate for seamless loop */}
        <PhoneMockup src={PHONE_IMAGES[0].src} alt={PHONE_IMAGES[0].alt} />
        <PhoneMockup src={PHONE_IMAGES[3].src} alt={PHONE_IMAGES[3].alt} overlay={PHONE_IMAGES[3].overlay} />
      </div>
      {/* Column 2 — scrolls DOWN (offset for stagger) */}
      <div className="phone-showcase-column phone-showcase-column--down phone-showcase-column--offset">
        <PhoneMockup src={PHONE_IMAGES[LOGO_INDEX].src} alt={PHONE_IMAGES[LOGO_INDEX].alt} contain underlay={PHONE_IMAGES[LOGO_INDEX].underlay} />
        <PhoneMockup src={PHONE_IMAGES[4].src} alt={PHONE_IMAGES[4].alt} />
        <PhoneMockup src={PHONE_IMAGES[LOGO_INDEX].src} alt={PHONE_IMAGES[LOGO_INDEX].alt} contain underlay={PHONE_IMAGES[LOGO_INDEX].underlay} />
        <PhoneMockup src={PHONE_IMAGES[4].src} alt={PHONE_IMAGES[4].alt} />
      </div>
      {/* Column 3 — scrolls UP */}
      <div className="phone-showcase-column phone-showcase-column--up">
        <PhoneMockup src={PHONE_IMAGES[2].src} alt={PHONE_IMAGES[2].alt} />
        <PhoneMockup src={PHONE_IMAGES[5].src} alt={PHONE_IMAGES[5].alt} overlay={PHONE_IMAGES[5].overlay} />
        <PhoneMockup src={PHONE_IMAGES[2].src} alt={PHONE_IMAGES[2].alt} />
        <PhoneMockup src={PHONE_IMAGES[5].src} alt={PHONE_IMAGES[5].alt} overlay={PHONE_IMAGES[5].overlay} />
      </div>
    </div>
  )
}

function MobileMarquee() {
  const trackRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)

  const handleTouchStart = useCallback(() => {
    pausedRef.current = true
    trackRef.current?.classList.add('paused')
  }, [])

  const handleTouchEnd = useCallback(() => {
    setTimeout(() => {
      pausedRef.current = false
      trackRef.current?.classList.remove('paused')
    }, 2000)
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    track.addEventListener('touchstart', handleTouchStart, { passive: true })
    track.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      track.removeEventListener('touchstart', handleTouchStart)
      track.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchEnd])

  return (
    <div className="phone-showcase-marquee">
      <div className="phone-showcase-track" ref={trackRef}>
        {PHONE_IMAGES.map((img, i) => (
          <PhoneMockup key={img.alt} src={img.src} alt={img.alt} contain={i === LOGO_INDEX} overlay={img.overlay} underlay={img.underlay} />
        ))}
        {/* Duplicate for seamless loop */}
        {PHONE_IMAGES.map((img, i) => (
          <PhoneMockup key={`dup-${img.alt}`} src={img.src} alt={img.alt} contain={i === LOGO_INDEX} overlay={img.overlay} underlay={img.underlay} />
        ))}
      </div>
    </div>
  )
}

export default function PhoneShowcaseSection({ onBecomeSupplier }: PhoneShowcaseSectionProps) {
  return (
    <section className="phone-showcase">
      <div className="phone-showcase-inner">
        <motion.div
          className="phone-showcase-copy"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <span className="phone-showcase-eyebrow">Travio Ghana</span>
          <h1 className="phone-showcase-title">Manage Your Tours on the Go</h1>
          <p className="phone-showcase-desc">
            List your tours, track bookings, and grow your business — all from one powerful
            platform built for Ghana's travel operators.
          </p>
          <button
            type="button"
            className="phone-showcase-cta"
            onClick={onBecomeSupplier}
          >
            Become a Supplier
          </button>
        </motion.div>

        {/* Desktop: vertical scrolling columns */}
        <DesktopColumns />

        {/* Mobile: horizontal marquee */}
        <MobileMarquee />
      </div>
    </section>
  )
}
