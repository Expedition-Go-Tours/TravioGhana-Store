import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MotionConfig, motion } from 'framer-motion'
import {
  CheckCircle,
  ChevronRight,
  Clock,
  CreditCard,
  Headset,
  Info,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  RefreshCw,
  Shield,
  Tag,
  Users,
} from 'lucide-react'
import Footer from '../components/Footer'
import SEO, { buildBreadcrumbSchema } from '../components/SEO'
import { HELP_CENTRE_STATE } from '../components/support/BackToHelpCentre'
import SupportSearch from '../components/support/SupportSearch'
import FaqAccordion from '../components/support/FaqAccordion'
import DeferredMap from '../components/support/DeferredMap'
import { fadeUp, revealViewport, stagger, staggerItem } from '../components/support/motion'
import { getPopularFaqs } from '../lib/faq'
import {
  OFFICE_DIRECTIONS_URL,
  OFFICE_MAP_EMBED,
  SUPPORT_EMAIL,
  SUPPORT_HOURS,
  SUPPORT_PHONE,
  SUPPORT_PHONE_DIGITS,
  WHATSAPP_URL,
} from '../lib/support'
import { scheduleSupportPrefetch } from '../lib/prefetchSupport'
import { useAuthUser } from '../hooks/useAuthUser'
import { setAuthReturnTo } from '../lib/auth'
import './SupportPages.css'
import './SupportHub.css'

const MotionLink = motion.create(Link)

/** Format +233591409761 → +233 59 140 9761 for display. */
function formatPhone(raw: string): string {
  if (raw.startsWith('+233') && raw.length >= 13) {
    return `+233 ${raw.slice(4, 6)} ${raw.slice(6, 9)} ${raw.slice(9)}`
  }
  return raw
}

export default function HelpCentrePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthUser()
  const [openFaqId, setOpenFaqId] = useState<string | null>(null)

  const popularFaqs = useMemo(() => getPopularFaqs(t), [t])

  // Warm the Contact + FAQ chunks so cross-links open without a fallback.
  useEffect(() => {
    scheduleSupportPrefetch()
  }, [])

  const TRUST_ITEMS = [
    { Icon: Shield, title: 'Curated experiences', desc: 'Trusted local operators' },
    { Icon: Clock, title: 'Flexible cancellation', desc: 'Available on most tours' },
    { Icon: MapPin, title: 'Pickup across Ghana', desc: 'Clear meeting arrangements' },
    { Icon: Headset, title: 'Local support', desc: 'Based in Accra' },
  ]

  const TOPICS = [
    { id: 'booking', Icon: CreditCard, title: t('faq.catBooking'), desc: t('supportHub.topicBookingDesc'), to: '/faq#cat-booking' },
    { id: 'cancellation', Icon: RefreshCw, title: t('faq.catCancellation'), desc: t('supportHub.topicCancellationDesc'), to: '/faq#cat-cancellation' },
    { id: 'pickup', Icon: MapPin, title: t('faq.catPickup'), desc: t('supportHub.topicPickupDesc'), to: '/faq#cat-pickup' },
    { id: 'offers', Icon: Tag, title: t('faq.catOffers'), desc: t('supportHub.topicOffersDesc'), to: '/faq#cat-offers' },
    { id: 'partner', Icon: Users, title: t('supportHub.partnerTitle'), desc: t('supportHub.topicPartnerDesc'), to: '/partnerships' },
    { id: 'about', Icon: Info, title: t('supportHub.topicAboutTitle'), desc: t('supportHub.topicAboutDesc'), to: '/about-us' },
  ]

  const ABOUT_TAGS = [
    'Ghana-based platform',
    'Local tour operators',
    'Curated experiences',
    'Reachable support team',
  ]

  const openChat = () => {
    if (user) {
      navigate('/dashboard/chat')
      return
    }
    setAuthReturnTo('/dashboard/chat')
    navigate('/login')
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="support-page sh-hub">
        <SEO
          title="Ghana Tours Help Centre - Booking Support & FAQs"
          description="Get help with your Ghana tour booking. Find answers about payments, cancellations, pickup, refunds, and more. Contact our support team for assistance."
          keywords="Ghana tours help, booking support, customer service, tour booking help, cancellation help, payment help"
          jsonLd={buildBreadcrumbSchema([
            { name: 'Home', url: 'https://www.expeditiongotours.com/' },
            { name: 'Help Centre', url: 'https://www.expeditiongotours.com/help-centre' },
          ])}
        />

        {/* ── 1. Hero ── */}
        <header className="support-hero sh-hub-hero">
          <motion.div
            className="support-hero-content"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            <motion.div className="sh-eyebrow" variants={staggerItem}>
              <Headset size={14} aria-hidden="true" />
              <span>Support centre</span>
            </motion.div>

            <motion.h1 className="support-title" id="help-hero-title" variants={staggerItem}>
              How can we help?
            </motion.h1>

            <motion.p className="support-subtitle" variants={staggerItem}>
              Find quick answers about your booking, payments, cancellations, refunds and pickup arrangements.
            </motion.p>

            <motion.div className="sh-search-slot" variants={staggerItem}>
              <SupportSearch linkState={HELP_CENTRE_STATE} />
            </motion.div>

            <motion.div className="sh-quick" variants={staggerItem}>
              <Link to="/faq#cat-booking" state={HELP_CENTRE_STATE} className="sh-quick-chip">
                <CreditCard size={14} aria-hidden="true" />
                Booking &amp; payment
              </Link>
              <Link to="/faq#cat-cancellation" state={HELP_CENTRE_STATE} className="sh-quick-chip">
                <RefreshCw size={14} aria-hidden="true" />
                Cancellation &amp; refunds
              </Link>
              <Link to="/faq#cat-pickup" state={HELP_CENTRE_STATE} className="sh-quick-chip">
                <MapPin size={14} aria-hidden="true" />
                Pickup &amp; meeting points
              </Link>
            </motion.div>
          </motion.div>
        </header>

        {/* ── 2. Trust strip (overlaps hero bottom) ── */}
        <section className="sh-trust-strip" aria-label="Trust indicators">
          <div className="support-container">
            <motion.div
              className="sh-trust-strip-card"
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={stagger}
            >
              {TRUST_ITEMS.map(({ Icon, title, desc }) => (
                <motion.div key={title} className="sh-trust-strip-item" variants={staggerItem}>
                  <span className="sh-trust-strip-icon">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <div className="sh-trust-strip-text">
                    <strong>{title}</strong>
                    <span>{desc}</span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <div className="support-container sh-main">
          {/* ── 3. Browse help topics ── */}
          <motion.section
            className="sh-block"
            aria-labelledby="sh-topics-title"
            initial="hidden"
            whileInView="visible"
            viewport={revealViewport}
            variants={fadeUp}
          >
            <p className="sh-block-kicker">Get the right answer</p>
            <h2 className="sh-block-title" id="sh-topics-title">
              Browse help topics
            </h2>
            <p className="sh-block-sub">
              Everything you need before, during and after your experience.
            </p>
            <motion.div
              className="sh-topics"
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={stagger}
            >
              {TOPICS.map(({ id, Icon, title, desc, to }) => (
                <MotionLink
                  key={id}
                  to={to}
                  state={HELP_CENTRE_STATE}
                  className="sh-topic sh-topic-card"
                  variants={staggerItem}
                >
                  <span className="sh-topic-icon">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <h3 className="sh-topic-title">{title}</h3>
                  <p className="sh-topic-desc">{desc}</p>
                  <span className="sh-topic-cta">
                    {t('supportHub.viewAnswers')}
                    <ChevronRight size={15} aria-hidden="true" />
                  </span>
                </MotionLink>
              ))}
            </motion.div>
          </motion.section>

          {/* ── 4. About panel (dark green) ── */}
          <motion.section
            className="sh-about-panel"
            aria-labelledby="sh-about-panel-title"
            initial="hidden"
            whileInView="visible"
            viewport={revealViewport}
            variants={fadeUp}
          >
            <p className="sh-about-panel-kicker">Travel with local insight</p>
            <h2 className="sh-about-panel-title" id="sh-about-panel-title">
              Ghana experiences, backed by people who know Ghana.
            </h2>
            <p className="sh-about-panel-desc">{t('supportHub.whatWeDoText')}</p>
            <div className="sh-about-panel-tags">
              {ABOUT_TAGS.map((tag) => (
                <span key={tag} className="sh-about-panel-tag">
                  <CheckCircle size={14} aria-hidden="true" />
                  {tag}
                </span>
              ))}
            </div>
          </motion.section>

          {/* ── 5. Popular questions ── */}
          <motion.section
            className="sh-block"
            aria-labelledby="sh-popular-title"
            initial="hidden"
            whileInView="visible"
            viewport={revealViewport}
            variants={fadeUp}
          >
            <p className="sh-block-kicker">Quick answers</p>
            <div className="sh-block-head">
              <h2 className="sh-block-title" id="sh-popular-title">
                Popular questions
              </h2>
              <Link to="/faq" state={HELP_CENTRE_STATE} className="sh-block-link">
                {t('supportHub.seeAllFaqs')}
                <ChevronRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <p className="sh-block-sub">
              Start with the questions travellers ask us most often.
            </p>
            <div className="sh-popular-layout">
              <div className="sh-popular-faqs">
                <FaqAccordion items={popularFaqs} openId={openFaqId} onToggle={setOpenFaqId} />
              </div>
              <div className="sh-hours-card sh-hours-card--sticky">
                <div className="sh-hours-status">
                  <span className="sh-hours-status-dot" />
                  Open now
                </div>
                <h3 className="sh-hours-heading">
                  <Clock size={17} aria-hidden="true" />
                  Support hours
                </h3>
                <ul className="sh-hours">
                  {SUPPORT_HOURS.map((entry) => (
                    <li key={entry.labelKey}>
                      <span>{t(entry.labelKey)}</span>
                      <span className={entry.closed ? 'sh-hours-closed' : ''}>
                        {t(entry.valueKey)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="sh-hours-note">{t('supportHub.hoursNote')}</p>
              </div>
            </div>
          </motion.section>

          {/* ── 6. Contact section (light green bg) ── */}
          <motion.section
            className="sh-contact-section"
            aria-labelledby="sh-contact-title"
            initial="hidden"
            whileInView="visible"
            viewport={revealViewport}
            variants={fadeUp}
          >
            <p className="sh-block-kicker sh-block-kicker--light">Still need help?</p>
            <h2 className="sh-contact-title" id="sh-contact-title">
              Talk to our support team
            </h2>
            <p className="sh-contact-sub">
              Choose the channel that works best for you.
            </p>
            <motion.div
              className="sh-contact-cards"
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={stagger}
            >
              <motion.a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="sh-channel sh-channel--email"
                variants={staggerItem}
              >
                <span className="sh-channel-head">
                  <span className="sh-channel-label">
                    <Mail size={14} aria-hidden="true" />
                    {t('contact.emailLabel')}
                  </span>
                </span>
                <span className="sh-channel-value">{SUPPORT_EMAIL}</span>
                <span className="sh-channel-note">{t('contact.emailNote')}</span>
              </motion.a>

              <motion.a
                href={`tel:${SUPPORT_PHONE_DIGITS}`}
                className="sh-channel sh-channel--phone"
                variants={staggerItem}
              >
                <span className="sh-channel-head">
                  <span className="sh-channel-label">
                    <Phone size={14} aria-hidden="true" />
                    {t('contact.phoneLabel')}
                  </span>
                </span>
                <span className="sh-channel-value">{formatPhone(SUPPORT_PHONE)}</span>
                <span className="sh-channel-note">
                  Call during support hours for immediate help.
                </span>
              </motion.a>

              <motion.a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="sh-channel sh-channel--whatsapp"
                variants={staggerItem}
              >
                <span className="sh-channel-head">
                  <span className="sh-channel-label">
                    <MessageCircle size={14} aria-hidden="true" />
                    {t('contact.whatsappLabel')}
                  </span>
                </span>
                <span className="sh-channel-value">{formatPhone(SUPPORT_PHONE)}</span>
                <span className="sh-channel-note">
                  Message us and we will respond as soon as possible.
                </span>
              </motion.a>

              <motion.button
                type="button"
                className="sh-channel sh-channel--chat"
                onClick={openChat}
                variants={staggerItem}
              >
                <span className="sh-channel-head">
                  <span className="sh-channel-label">
                    <Headset size={14} aria-hidden="true" />
                    {t('support.chatWithUs')}
                  </span>
                  <span className="sh-channel-badge">{t('contact.fastest')}</span>
                </span>
                <span className="sh-channel-value">Live chat</span>
                <span className="sh-channel-note">Sign in to start chatting</span>
              </motion.button>
            </motion.div>
          </motion.section>

          {/* ── 7. Visit panel (split layout) ── */}
          <motion.section
            className="sh-visit-panel"
            aria-labelledby="sh-visit-title"
            initial="hidden"
            whileInView="visible"
            viewport={revealViewport}
            variants={fadeUp}
          >
            <div className="sh-visit-info">
              <p className="sh-block-kicker">Visit us</p>
              <h2 className="sh-visit-name" id="sh-visit-title">
                {t('help.companyName')}
              </h2>
              <p className="sh-visit-address">
                {t('help.addressLine1')}
                <br />
                {t('help.addressLine2')}
              </p>
              <a
                href={OFFICE_DIRECTIONS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="sh-btn sh-btn--primary"
              >
                <Navigation size={15} aria-hidden="true" />
                {t('help.getDirections')}
              </a>
            </div>
            <DeferredMap
              title={`${t('help.companyName')} — ${t('help.addressLine1')}, ${t('help.addressLine2')}`}
              src={OFFICE_MAP_EMBED}
            />
          </motion.section>
        </div>

        {/* ── 8. Mobile contact bar ── */}
        <div className="sh-mobile-contact-bar" aria-label="Contact options">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="sh-mobile-contact-btn sh-mobile-contact-btn--whatsapp"
          >
            <MessageCircle size={18} aria-hidden="true" />
            WhatsApp
          </a>
          <a
            href={`tel:${SUPPORT_PHONE_DIGITS}`}
            className="sh-mobile-contact-btn sh-mobile-contact-btn--call"
          >
            <Phone size={18} aria-hidden="true" />
            Call support
          </a>
        </div>

        <Footer />
      </div>
    </MotionConfig>
  )
}
