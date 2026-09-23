import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Handshake,
  Hotel,
  Layers,
  Radar,
  Route,
  ShieldCheck,
  Sprout,
  Users,
} from 'lucide-react'
import Footer from '../components/Footer'
import SEO, { buildBreadcrumbSchema, buildOrganizationSchema } from '../components/SEO'
import BackToHelpCentre from '../components/support/BackToHelpCentre'
import { fadeUp, revealViewport, stagger, staggerItem } from '../components/support/motion'
import { SUPPORT_EMAIL } from '../lib/support'

import partners1 from '../assets/partners/partners1.avif'
import partners2 from '../assets/partners/partners2.avif'
import partners3 from '../assets/partners/partners3.avif'
import partners4 from '../assets/partners/partners4.avif'
import partners6 from '../assets/partners/partners6.avif'
import partners7 from '../assets/partners/partners7.avif'
import partners8 from '../assets/partners/partners8.avif'
import partners9 from '../assets/partners/partners9.avif'

import './SupportPages.css'
import './PartnershipsPage.css'

const PARTNERSHIP_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=Partnership%20enquiry`

/**
 * Hero carousel frames. Each entry carries its own crop focus so the framed
 * artwork keeps faces/signage readable inside the near-square shot.
 */
const HERO_IMAGES = [
  { src: partners3, width: 841, height: 516, focus: '50% 35%' },
  { src: partners1, width: 645, height: 624, focus: '50% 38%' },
  { src: partners4, width: 785, height: 624, focus: '50% 38%' },
]

const HERO_INTERVAL_MS = 5000

/**
 * Static partner-type layout. Copy is resolved per-locale in the component
 * (t(`partnerships.${key}Title`) / `...Text` / `...CardTitle`).
 * `focus` tunes the card crop away from signage baked into the source photos.
 */
const PARTNER_LAYOUT = [
  {
    key: 'type1',
    to: '/partners/tour-operators/apply',
    image: partners2,
    width: 841,
    height: 546,
    focus: 'center',
    Icon: Compass,
  },
  {
    key: 'type2',
    to: '/hotels',
    image: partners7,
    width: 814,
    height: 624,
    focus: '50% 72%',
    Icon: Hotel,
  },
  {
    key: 'type3',
    to: '/travel-agents',
    image: partners9,
    width: 841,
    height: 614,
    focus: '50% 42%',
    Icon: Users,
  },
  {
    key: 'type4',
    to: '/content-creators',
    image: partners6,
    width: 841,
    height: 568,
    focus: 'center',
    Icon: Camera,
  },
  {
    key: 'type5',
    to: '/transport-providers',
    image: partners8,
    width: 841,
    height: 581,
    focus: '50% 80%',
    Icon: Car,
  },
]

const BENEFITS = [
  { key: 'benefit1', Icon: Radar },
  { key: 'benefit2', Icon: ShieldCheck },
  { key: 'benefit3', Icon: Layers },
  { key: 'benefit4', Icon: Sprout },
]

const ROUTE_TAGS = ['routesTag1', 'routesTag2', 'routesTag3', 'routesTag4', 'routesTag5']

const STEPS = [
  { key: 'step1', last: false },
  { key: 'step2', last: false },
  { key: 'step3', last: true },
]

/** True only when the CSS has switched the rail into its touch swipe mode. */
function railIsScrollable(rail: HTMLElement) {
  const overflowX = window.getComputedStyle(rail).overflowX
  return (overflowX === 'auto' || overflowX === 'scroll') && rail.scrollWidth > rail.clientWidth
}

export default function PartnershipsPage() {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [partnerSlide, setPartnerSlide] = useState(0)
  const [heroHeld, setHeroHeld] = useState(false)
  const heroArtRef = useRef<HTMLDivElement>(null)
  const partnerRailRef = useRef<HTMLDivElement>(null)

  const partnerTypes = PARTNER_LAYOUT.map((partner) => ({
    ...partner,
    title: t(`partnerships.${partner.key}Title`),
    cardTitle: t(`partnerships.${partner.key}CardTitle`),
    text: t(`partnerships.${partner.key}Text`),
  }))

  // Hero auto-advance. The timeout is re-armed on every slide change, so a
  // manual pick gets a full dwell; it is suspended while hovered/focused and
  // disabled entirely for reduced motion.
  const heroPlaying = !reduceMotion && !heroHeld
  useEffect(() => {
    if (!heroPlaying) return
    const next = (currentSlide + 1) % HERO_IMAGES.length
    const id = window.setTimeout(() => setCurrentSlide(next), HERO_INTERVAL_MS)
    return () => window.clearTimeout(id)
  }, [heroPlaying, currentSlide])

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(((index % HERO_IMAGES.length) + HERO_IMAGES.length) % HERO_IMAGES.length)
  }, [])

  /** Pointer tilt for the framed hero artwork (mouse only, reduced motion off). */
  const onArtPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const art = heroArtRef.current
    if (!art || reduceMotion || event.pointerType !== 'mouse') return
    const rect = art.getBoundingClientRect()
    const mx = ((event.clientX - rect.left) / rect.width - 0.5) * 4
    const my = ((event.clientY - rect.top) / rect.height - 0.5) * -3
    art.style.setProperty('--mx', `${mx.toFixed(2)}deg`)
    art.style.setProperty('--my', `${my.toFixed(2)}deg`)
  }

  const onArtPointerLeave = () => {
    const art = heroArtRef.current
    if (!art) return
    art.style.setProperty('--mx', '0deg')
    art.style.setProperty('--my', '0deg')
  }

  const scrollToPartner = useCallback((index: number) => {
    const rail = partnerRailRef.current
    if (!rail || !railIsScrollable(rail)) return
    const cards = rail.querySelectorAll<HTMLElement>('.pp-route-card')
    const target = Math.max(0, Math.min(index, PARTNER_LAYOUT.length - 1))
    cards[target]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    setPartnerSlide(target)
  }, [])

  const handlePartnerScroll = () => {
    const rail = partnerRailRef.current
    if (!rail) return
    const cards = rail.querySelectorAll<HTMLElement>('.pp-route-card')
    if (cards.length < 2) return
    const step = cards[1].offsetLeft - cards[0].offsetLeft
    if (step > 0) {
      const index = Math.round(rail.scrollLeft / step)
      setPartnerSlide(Math.max(0, Math.min(index, PARTNER_LAYOUT.length - 1)))
    }
  }

  const onHeroKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      goToSlide(currentSlide - 1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      goToSlide(currentSlide + 1)
    }
  }

  const onCardsKeyDown = (event: React.KeyboardEvent) => {
    const rail = partnerRailRef.current
    if (!rail || !railIsScrollable(rail)) return
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      scrollToPartner(partnerSlide - 1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      scrollToPartner(partnerSlide + 1)
    }
  }

  const tickerItems = [
    t('partnerships.ticker1'),
    t('partnerships.ticker2'),
    t('partnerships.ticker3'),
    t('partnerships.ticker4'),
  ]

  return (
    <div className="support-page partnerships-page">
      <SEO
        title={t('partnerships.pageTitle')}
        description="Become a partner with Travio Ghana. Join Ghana's leading tourism platform as a tour operator, hotel, travel agent, content creator, or transport provider."
        keywords="Travio Ghana partnership, Ghana tourism partnership, tour operator partnership Ghana, travel partner Ghana, become a supplier Ghana"
        jsonLd={[
          buildBreadcrumbSchema([
            { name: 'Home', url: 'https://www.travioghana.com/' },
            { name: 'Partnerships', url: 'https://www.travioghana.com/partnerships' },
          ]),
          buildOrganizationSchema(),
        ]}
      />

      {/* ===== 1. Hero — split copy + orbit-framed carousel ===== */}
      <header
        className={`pp-hero${reduceMotion ? ' pp-hero--reduced' : ''}`}
        role="region"
        aria-roledescription="carousel"
        aria-label={t('footer.partnerships')}
        onKeyDown={onHeroKeyDown}
        onMouseEnter={() => setHeroHeld(true)}
        onMouseLeave={() => setHeroHeld(false)}
        onFocusCapture={() => setHeroHeld(true)}
        onBlurCapture={() => setHeroHeld(false)}
      >
        <div className="pp-hero-glow" aria-hidden="true" />
        <div className="pp-container pp-hero-grid">
          <div className="pp-hero-copy">
            <BackToHelpCentre requireOrigin className="pp-hero-back" />
            <p className="pp-hero-pill">
              <span className="pp-pulse" aria-hidden="true" />
              {t('partnerships.heroPill')}
            </p>
            <h1 className="pp-hero-title">
              <span className="pp-hero-line">
                <span>{t('partnerships.heroLine1')}</span>
              </span>
              <span className="pp-hero-line pp-hero-line--accent">
                <span>{t('partnerships.heroLine2')}</span>
              </span>
              <span className="pp-hero-line">
                <span>{t('partnerships.heroLine3')}</span>
              </span>
            </h1>
            <p className="pp-hero-lead">{t('partnerships.heroLead')}</p>
            <div className="pp-hero-actions">
              <a href={PARTNERSHIP_MAILTO} className="pp-btn pp-btn--primary">
                <Handshake size={18} aria-hidden="true" />
                {t('partnerships.heroCtaPrimary')}
                <span className="pp-btn-badge" aria-hidden="true">
                  <ArrowUpRight size={15} />
                </span>
              </a>
              <a href="#pp-routes" className="pp-btn pp-btn--outline">
                <Route size={18} aria-hidden="true" />
                {t('partnerships.heroCtaSecondary')}
              </a>
            </div>
            <p className="pp-hero-micro">
              <Check size={15} aria-hidden="true" />
              {t('partnerships.heroMicro')}
            </p>
          </div>

          <div
            className="pp-hero-art"
            ref={heroArtRef}
            onPointerMove={onArtPointerMove}
            onPointerLeave={onArtPointerLeave}
          >
            <svg className="pp-hero-orbit" viewBox="0 0 800 800" aria-hidden="true">
              <circle cx="400" cy="400" r="300" />
              <circle cx="400" cy="400" r="225" />
              <path d="M90 450c100-195 238-292 415-285 92 4 161 37 207 97" />
            </svg>

            <div className="pp-hero-shot">
              {HERO_IMAGES.map((img, index) => (
                <img
                  key={img.src}
                  src={img.src}
                  alt=""
                  width={img.width}
                  height={img.height}
                  className={index === currentSlide ? 'active' : ''}
                  style={{ objectPosition: img.focus }}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  fetchPriority={index === 0 ? 'high' : undefined}
                  decoding="async"
                />
              ))}
              <div className="pp-shot-veil" aria-hidden="true" />
              <div className="pp-shot-label">
                <div>
                  <span>{t('partnerships.heroShotLabel')}</span>
                  <b>{t('partnerships.heroShotTitle')}</b>
                </div>
                <span>{t('partnerships.heroShotPlace')}</span>
              </div>
            </div>

            <div className="pp-orbit-dot" aria-hidden="true">
              <span>{t('partnerships.heroBadge')}</span>
            </div>

            <div className="pp-float-card" aria-hidden="true">
              <small>{t('partnerships.heroCardLabel')}</small>
              <strong>{t('partnerships.heroCardTitle')}</strong>
              <div className="pp-mini-people">
                <i>TO</i>
                <i>HO</i>
                <i>TA</i>
                <i>CC</i>
                <b>{t('partnerships.heroCardTransport')}</b>
              </div>
            </div>

            <div className="pp-hero-bar">
              <button
                type="button"
                className="pp-hero-control"
                onClick={() => goToSlide(currentSlide - 1)}
                aria-label={t('partnerships.prevImage')}
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </button>

              <div className="pp-dots">
                {HERO_IMAGES.map((img, index) => (
                  <button
                    key={img.src}
                    type="button"
                    className="pp-dot"
                    onClick={() => goToSlide(index)}
                    aria-label={t('partnerships.goToSlide', { number: index + 1 })}
                    aria-current={index === currentSlide ? 'true' : undefined}
                  >
                    <span className="pp-dot-mark" aria-hidden="true" />
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="pp-hero-control"
                onClick={() => goToSlide(currentSlide + 1)}
                aria-label={t('partnerships.nextImage')}
              >
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ===== 2. Ticker ===== */}
      <div className="pp-ticker" aria-hidden="true">
        <div className="pp-ticker-track">
          {[0, 1].map((set) => (
            <div className="pp-ticker-line" key={set}>
              {tickerItems.map((item, index) => (
                <span key={`${set}-${item}`} className="pp-ticker-item">
                  {index % 2 === 1 ? <b>{item}</b> : <span>{item}</span>}
                  <i className="pp-ticker-dot" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ===== 3. Benefits — "Why partner with us" ===== */}
      <section className="pp-intro" aria-labelledby="pp-intro-title">
        <div className="pp-container pp-split">
          <motion.div
            className="pp-intro-left"
            initial="hidden"
            whileInView="visible"
            viewport={revealViewport}
            variants={fadeUp}
          >
            <p className="pp-eyebrow">{t('partnerships.benefitsEyebrow')}</p>
            <h2 className="pp-display" id="pp-intro-title">
              {t('partnerships.benefitsTitle')}{' '}
              <span className="pp-display-accent">{t('partnerships.benefitsAccent')}</span>
            </h2>
            <p className="pp-intro-copy">{t('partnerships.benefitsCopy')}</p>
            <p className="pp-side-note">{t('partnerships.benefitsNote')}</p>
          </motion.div>

          <motion.div
            className="pp-benefits"
            initial="hidden"
            whileInView="visible"
            viewport={revealViewport}
            variants={stagger}
          >
            {BENEFITS.map((benefit, index) => {
              const Icon = benefit.Icon
              return (
                <motion.article
                  key={benefit.key}
                  className={`pp-benefit pp-benefit--${index + 1}`}
                  variants={staggerItem}
                >
                  <div className="pp-benefit-top">
                    <span className="pp-benefit-num">{t(`partnerships.${benefit.key}Label`)}</span>
                    <span className="pp-benefit-icon" aria-hidden="true">
                      <Icon size={20} />
                    </span>
                  </div>
                  <h3>{t(`partnerships.${benefit.key}Title`)}</h3>
                  <p>{t(`partnerships.${benefit.key}Text`)}</p>
                </motion.article>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* ===== 4. Routes — "Who we work with" ===== */}
      <section className="pp-routes" id="pp-routes" aria-labelledby="pp-routes-title">
        <div className="pp-container">
          <motion.div
            className="pp-routes-head"
            initial="hidden"
            whileInView="visible"
            viewport={revealViewport}
            variants={fadeUp}
          >
            <div>
              <p className="pp-eyebrow pp-eyebrow--onDark">{t('partnerships.routesEyebrow')}</p>
              <h2 className="pp-display pp-display--onDark" id="pp-routes-title">
                {t('partnerships.routesTitle')}
              </h2>
            </div>
            <p className="pp-routes-intro">{t('partnerships.routesIntro')}</p>
          </motion.div>
        </div>

        <div className="pp-rail-shell">
          <div
            className="pp-rail"
            ref={partnerRailRef}
            onScroll={handlePartnerScroll}
            onKeyDown={onCardsKeyDown}
            role="group"
            aria-roledescription="carousel"
            aria-label={t('partnerships.routesEyebrow')}
          >
            <div className="pp-rail-track">
              {[0, 1].map((set) => (
                <div className="pp-rail-set" key={set} aria-hidden={set === 1 || undefined}>
                  {partnerTypes.map((partner, index) => {
                    const Icon = partner.Icon
                    return (
                      <article key={`${set}-${partner.key}`} className="pp-route-card">
                        <div className="pp-route-card-media" aria-hidden="true">
                          <img
                            src={partner.image}
                            alt=""
                            width={partner.width}
                            height={partner.height}
                            style={{ objectPosition: partner.focus }}
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                        <div className="pp-route-card-inner">
                          <div className="pp-route-no">
                            <span>
                              <Icon size={14} aria-hidden="true" />
                              {partner.title}
                            </span>
                            <b>{String(index + 1).padStart(2, '0')}</b>
                          </div>
                          <div className="pp-route-bottom">
                            <h3>{partner.cardTitle}</h3>
                            <p>{partner.text}</p>
                            <Link to={partner.to} className="pp-route-link">
                              {t('partnerships.getStarted')}
                              <span aria-hidden="true">
                                <ArrowUpRight size={14} />
                              </span>
                            </Link>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="pp-dots pp-rail-dots">
            {partnerTypes.map((partner, index) => (
              <button
                key={partner.key}
                type="button"
                className="pp-dot"
                onClick={() => scrollToPartner(index)}
                aria-label={t('partnerships.goToSlide', { number: index + 1 })}
                aria-current={index === partnerSlide ? 'true' : undefined}
              >
                <span className="pp-dot-mark" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>

        <div className="pp-container">
          <p className="pp-rail-note">{t('partnerships.routesNote')}</p>
        </div>

        <div className="pp-network" aria-hidden="true">
          <svg viewBox="0 0 1280 205" preserveAspectRatio="none">
            <path d="M70 0v55c0 42 62 42 145 42s146 0 146 66" />
            <path d="M340 0v42c0 44 80 38 174 38s126 25 126 83" />
            <path d="M640 0v163" />
            <path d="M940 0v42c0 44-80 38-174 38s-126 25-126 83" />
            <path d="M1210 0v55c0 42-62 42-145 42s-146 0-146 66" />
          </svg>
          <span className="pp-network-dot" />
          <div className="pp-route-summary">
            <h3>{t('partnerships.routesSummaryTitle')}</h3>
            <div className="pp-route-tags">
              {ROUTE_TAGS.map((tag) => (
                <span key={tag}>{t(`partnerships.${tag}`)}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== 5. Journey — "How it begins" ===== */}
      <section className="pp-journey" aria-labelledby="pp-journey-title">
        <div className="pp-container">
          <motion.div
            className="pp-journey-head"
            initial="hidden"
            whileInView="visible"
            viewport={revealViewport}
            variants={fadeUp}
          >
            <p className="pp-eyebrow">{t('partnerships.journeyEyebrow')}</p>
            <h2 className="pp-display" id="pp-journey-title">
              {t('partnerships.journeyTitle')}{' '}
              <span className="pp-display-accent">{t('partnerships.journeyAccent')}</span>
            </h2>
          </motion.div>

          <div className="pp-process">
            <motion.div
              className="pp-process-image"
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={fadeUp}
            >
              <img
                src={partners2}
                alt=""
                width={841}
                height={546}
                loading="lazy"
                decoding="async"
              />
              <div className="pp-process-caption">
                <small>{t('partnerships.journeyCaptionLabel')}</small>
                <h3>{t('partnerships.journeyCaptionTitle')}</h3>
              </div>
            </motion.div>

            <motion.div
              className="pp-steps"
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={stagger}
            >
              {STEPS.map((step, index) => (
                <motion.article
                  key={step.key}
                  className={`pp-step pp-step--${index + 1}`}
                  variants={staggerItem}
                >
                  <div className="pp-step-top">
                    <span className="pp-step-label">{t(`partnerships.${step.key}Label`)}</span>
                    <span className="pp-step-arrow" aria-hidden="true">
                      {step.last ? <ArrowUpRight size={16} /> : <ArrowRight size={16} />}
                    </span>
                  </div>
                  <div>
                    <h3>{t(`partnerships.${step.key}Title`)}</h3>
                    <p>{t(`partnerships.${step.key}Text`)}</p>
                  </div>
                </motion.article>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== 6. Closing — "Your route starts here" ===== */}
      <section className="pp-closing" aria-labelledby="pp-closing-title">
        <div className="pp-container">
          <motion.div
            className="pp-closing-box"
            initial="hidden"
            whileInView="visible"
            viewport={revealViewport}
            variants={fadeUp}
          >
            <span className="pp-closing-ring" aria-hidden="true" />
            <div className="pp-closing-content">
              <p className="pp-eyebrow pp-eyebrow--onDark">{t('partnerships.closingEyebrow')}</p>
              <h2 id="pp-closing-title">{t('partnerships.closingTitle')}</h2>
              <p>{t('partnerships.closingText')}</p>
              <div className="pp-closing-actions">
                <a href={PARTNERSHIP_MAILTO} className="pp-btn pp-btn--light">
                  {t('partnerships.closingCta')}
                  <span className="pp-btn-badge" aria-hidden="true">
                    <ArrowUpRight size={15} />
                  </span>
                </a>
                <Link to="/contact-us" className="pp-btn pp-btn--ghost-dark">
                  {t('partnerships.contactBtn')}
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
