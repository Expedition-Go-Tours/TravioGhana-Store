import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MotionConfig, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  Headset,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
} from 'lucide-react'
import Footer from '../components/Footer'
import SEO, { buildBreadcrumbSchema } from '../components/SEO'
import { fadeUp, revealViewport, stagger, staggerItem } from '../components/support/motion'
import {
  OFFICE_DIRECTIONS_URL,
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

/* ------------------------------------------------------------------ */
/*  Form state                                                         */
/* ------------------------------------------------------------------ */

interface ContactFormState {
  name: string
  email: string
  topic: string
  bookingRef: string
  message: string
}

const EMPTY_FORM: ContactFormState = {
  name: '',
  email: '',
  topic: 'booking',
  bookingRef: '',
  message: '',
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ContactUsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthUser()
  const [form, setForm] = useState<ContactFormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormState, string>>>({})

  useEffect(() => {
    scheduleSupportPrefetch()
  }, [])

  const TOPIC_OPTIONS = [
    { value: 'booking', label: t('contact.form.topicBooking') },
    { value: 'cancellation', label: t('contact.form.topicCancellation') },
    { value: 'pickup', label: t('contact.form.topicPickup') },
    { value: 'partner', label: t('contact.form.topicPartner') },
    { value: 'other', label: t('contact.form.topicOther') },
  ]

  const update = (field: keyof ContactFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  const openChat = () => {
    if (user) {
      navigate('/dashboard/chat')
      return
    }
    setAuthReturnTo('/dashboard/chat')
    navigate('/login')
  }

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL)
      toast.success(t('contact.form.copied'))
    } catch {
      window.location.href = `mailto:${SUPPORT_EMAIL}`
    }
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors: Partial<Record<keyof ContactFormState, string>> = {}
    if (!form.name.trim()) nextErrors.name = t('contact.form.errName')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = t('contact.form.errEmail')
    if (!form.message.trim()) nextErrors.message = t('contact.form.errMessage')
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const topicLabel = TOPIC_OPTIONS.find((option) => option.value === form.topic)?.label ?? form.topic
    const bookingRef = form.bookingRef.trim()
    const subject = `[${topicLabel}]${bookingRef ? ` ${bookingRef}` : ''} — Travio Ghana support`
    const body = [
      `${t('contact.form.name')}: ${form.name.trim()}`,
      `${t('contact.form.email')}: ${form.email.trim()}`,
      `${t('contact.form.topic')}: ${topicLabel}`,
      bookingRef ? `${t('contact.form.bookingRef')}: ${bookingRef}` : '',
      '',
      form.message.trim(),
    ]
      .filter((line) => line !== '')
      .join('\n')

    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    toast.success(t('contact.form.mailtoOpened'))
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <MotionConfig reducedMotion="user">
      <div className="support-page sh-hub">
        <SEO
          title="Contact Travio Ghana - Ghana Tours Support"
          description="Get in touch with Travio Ghana. Contact us for booking inquiries, partnerships, supplier registration, and customer support. We're here to help with your Ghana travel experience."
          keywords="contact Travio Ghana, Ghana tours support, booking help, customer service, partnership inquiries"
          jsonLd={buildBreadcrumbSchema([
            { name: 'Home', url: 'https://www.expeditiongotours.com/' },
            { name: 'Contact Us', url: 'https://www.expeditiongotours.com/contact-us' },
          ])}
        />

        {/* ============================================================ */}
        {/*  1. Hero — two-column grid                                    */}
        {/* ============================================================ */}

        <header className="sh-hero">
          <motion.div
            className="sh-hero-grid"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            {/* Left column — copy + CTA */}
            <motion.div className="sh-hero-left" variants={staggerItem}>
              <p className="sh-eyebrow">{t('supportHub.eyebrow')}</p>
              <h1 className="sh-title" id="contact-hero-title">
                Talk to our team.
              </h1>
              <p className="sh-sub" style={{ margin: '0 0 28px', maxWidth: 'none' }}>
                Questions about a booking, pickup or partnership? Reach our Ghana-based
                support team using the channel that suits you best.
              </p>
              <div className="sh-hero-actions">
                <a href={`mailto:${SUPPORT_EMAIL}`} className="sh-btn sh-btn--hero-primary">
                  <Mail size={16} aria-hidden="true" />
                  Email us
                </a>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sh-btn sh-btn--hero-glass"
                >
                  <MessageCircle size={16} aria-hidden="true" />
                  WhatsApp
                </a>
              </div>
            </motion.div>

            {/* Right column — glass response card */}
            <motion.div className="sh-hero-right" variants={staggerItem}>
              <div className="sh-response-card">
                <div className="sh-response-status">
                  <span className="sh-response-dot" aria-hidden="true" />
                  Support is available today
                </div>
                <h3 className="sh-response-heading">Real people, local knowledge.</h3>
                <p className="sh-response-desc">
                  Our Accra-based support team knows Ghana inside out — from the
                  best coastal routes to last-minute pickup changes. We respond
                  quickly because we care about every trip.
                </p>
                <div className="sh-response-rows">
                  <div className="sh-response-row">
                    <span className="sh-response-row-label">Email response</span>
                    <span className="sh-response-row-value">Within 1 business day</span>
                  </div>
                  <div className="sh-response-row">
                    <span className="sh-response-row-label">Phone &amp; WhatsApp</span>
                    <span className="sh-response-row-value">During support hours</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </header>

        {/* ============================================================ */}
        {/*  2. Channel strip — 4 overlapping cards                       */}
        {/* ============================================================ */}

        <div className="support-container sh-main">
          <motion.section
            className="sh-block"
            aria-label={t('supportHub.channelsTitle')}
            initial="hidden"
            whileInView="visible"
            viewport={revealViewport}
            variants={fadeUp}
          >
            <motion.div
              className="sh-channels"
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
                <span className="sh-channel-value">{SUPPORT_PHONE}</span>
                <span className="sh-channel-note">{t('contact.phoneNote')}</span>
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
                <span className="sh-channel-value">{SUPPORT_PHONE}</span>
                <span className="sh-channel-note">{t('contact.whatsappNote')}</span>
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
                <span className="sh-channel-value">{t('contact.chatValue')}</span>
                <span className="sh-channel-note">{t('contact.chatNote')}</span>
              </motion.button>
            </motion.div>
          </motion.section>

          {/* ============================================================ */}
          {/*  3. Enquiry section — form + sidebar                          */}
          {/* ============================================================ */}

          <motion.section
            className="sh-block"
            aria-labelledby="sh-enquiry-title"
            initial="hidden"
            whileInView="visible"
            viewport={revealViewport}
            variants={fadeUp}
          >
            <div className="sh-enquiry-grid">
              {/* Left — form panel */}
              <div className="sh-enquiry-form-panel">
                <h2 className="sh-enquiry-title" id="sh-enquiry-title">
                  Send us a message
                </h2>
                <p className="sh-enquiry-sub">
                  No account is needed to contact our team.
                </p>
                <button type="button" className="sh-copy-btn" onClick={copyEmail}>
                  <ClipboardCopy size={15} aria-hidden="true" />
                  Copy email address
                </button>

                <form className="sh-form sh-enquiry-form" onSubmit={handleSubmit} noValidate>
                  <div className="sh-field">
                    <label className="sh-label" htmlFor="contact-name">
                      {t('contact.form.name')}
                    </label>
                    <input
                      id="contact-name"
                      className="sh-input"
                      type="text"
                      autoComplete="name"
                      required
                      value={form.name}
                      aria-invalid={!!errors.name}
                      aria-describedby={errors.name ? 'contact-name-error' : undefined}
                      onChange={(event) => update('name', event.target.value)}
                    />
                    {errors.name && (
                      <span className="sh-error" id="contact-name-error">{errors.name}</span>
                    )}
                  </div>

                  <div className="sh-field">
                    <label className="sh-label" htmlFor="contact-email">
                      {t('contact.form.email')}
                    </label>
                    <input
                      id="contact-email"
                      className="sh-input"
                      type="email"
                      autoComplete="email"
                      required
                      value={form.email}
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? 'contact-email-error' : undefined}
                      onChange={(event) => update('email', event.target.value)}
                    />
                    {errors.email && (
                      <span className="sh-error" id="contact-email-error">{errors.email}</span>
                    )}
                  </div>

                  <div className="sh-field">
                    <label className="sh-label" htmlFor="contact-topic">
                      {t('contact.form.topic')}
                    </label>
                    <select
                      id="contact-topic"
                      className="sh-select"
                      value={form.topic}
                      onChange={(event) => update('topic', event.target.value)}
                    >
                      {TOPIC_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sh-field">
                    <label className="sh-label" htmlFor="contact-booking-ref">
                      {t('contact.form.bookingRef')}
                    </label>
                    <input
                      id="contact-booking-ref"
                      className="sh-input"
                      type="text"
                      placeholder="e.g. EXP-12345678"
                      value={form.bookingRef}
                      onChange={(event) => update('bookingRef', event.target.value)}
                    />
                  </div>

                  <div className="sh-field sh-field--full">
                    <label className="sh-label" htmlFor="contact-message">
                      {t('contact.form.message')}
                    </label>
                    <textarea
                      id="contact-message"
                      className="sh-textarea"
                      required
                      value={form.message}
                      aria-invalid={!!errors.message}
                      aria-describedby={errors.message ? 'contact-message-error' : undefined}
                      onChange={(event) => update('message', event.target.value)}
                    />
                    {errors.message && (
                      <span className="sh-error" id="contact-message-error">{errors.message}</span>
                    )}
                  </div>

                  <div className="sh-form-foot">
                    <button type="submit" className="sh-btn sh-btn--primary">
                      <Send size={15} aria-hidden="true" />
                      Open email draft
                    </button>
                    <p className="sh-form-note">
                      This opens your email app with the details filled in — no
                      account needed.
                    </p>
                  </div>
                </form>
              </div>

              {/* Right — sidebar */}
              <aside className="sh-enquiry-sidebar">
                {/* Support hours card */}
                <motion.div
                  className="sh-hours-card sh-hours-card--dark"
                  initial="hidden"
                  whileInView="visible"
                  viewport={revealViewport}
                  variants={staggerItem}
                >
                  <h3 className="sh-hours-heading">
                    <Clock size={17} aria-hidden="true" />
                    {t('support.supportHours')}
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
                </motion.div>

                {/* Office card */}
                <motion.div
                  className="sh-sidebar-card"
                  initial="hidden"
                  whileInView="visible"
                  viewport={revealViewport}
                  variants={staggerItem}
                >
                  <span className="sh-sidebar-card-label">
                    <MapPin size={14} aria-hidden="true" />
                    {t('contact.officeLabel')}
                  </span>
                  <h4 className="sh-sidebar-card-name">{t('contact.companyName')}</h4>
                  <p className="sh-sidebar-card-address">
                    {t('contact.addressLine1')}
                    <br />
                    {t('contact.addressLine2')}
                  </p>
                  <a
                    href={OFFICE_DIRECTIONS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sh-sidebar-card-link"
                  >
                    <MapPin size={14} aria-hidden="true" />
                    Get directions
                    <ArrowRight size={14} aria-hidden="true" />
                  </a>
                </motion.div>

                {/* Tips card */}
                <motion.div
                  className="sh-sidebar-card sh-tips-card"
                  initial="hidden"
                  whileInView="visible"
                  viewport={revealViewport}
                  variants={staggerItem}
                >
                  <h4 className="sh-sidebar-card-title">For a faster response</h4>
                  <ul className="sh-tips-list">
                    <li>
                      <CheckCircle2 size={15} aria-hidden="true" />
                      Include your booking reference if you have one
                    </li>
                    <li>
                      <CheckCircle2 size={15} aria-hidden="true" />
                      Choose the right topic so we route your enquiry quickly
                    </li>
                    <li>
                      <CheckCircle2 size={15} aria-hidden="true" />
                      For urgent pickup issues, message us on WhatsApp
                    </li>
                  </ul>
                </motion.div>
              </aside>
            </div>
          </motion.section>

          {/* ============================================================ */}
          {/*  4. Help strip — light green background                       */}
          {/* ============================================================ */}

          <motion.section
            className="sh-block"
            aria-labelledby="sh-help-strip-title"
            initial="hidden"
            whileInView="visible"
            viewport={revealViewport}
            variants={fadeUp}
          >
            <div className="sh-help-strip">
              <h2 className="sh-help-strip-title" id="sh-help-strip-title">
                Find quick answers in our Help Centre.
              </h2>
              <div className="sh-help-strip-actions">
                <Link to="/help-centre" className="sh-btn sh-btn--help-primary">
                  Visit Help Centre
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
                <Link to="/faq" className="sh-btn sh-btn--help-ghost">
                  View FAQs
                </Link>
              </div>
            </div>
          </motion.section>
        </div>

        {/* ============================================================ */}
        {/*  5. Mobile contact bar                                        */}
        {/* ============================================================ */}

        <div className="sh-mobile-contact-bar" role="complementary" aria-label="Quick contact">
          <a href={`mailto:${SUPPORT_EMAIL}`} className="sh-mobile-contact-bar-btn sh-mobile-contact-bar-btn--email">
            <Mail size={16} aria-hidden="true" />
            Email
          </a>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="sh-mobile-contact-bar-btn sh-mobile-contact-bar-btn--whatsapp"
          >
            <MessageCircle size={16} aria-hidden="true" />
            WhatsApp
          </a>
          <a
            href={`tel:${SUPPORT_PHONE_DIGITS}`}
            className="sh-mobile-contact-bar-btn sh-mobile-contact-bar-btn--call"
          >
            <Phone size={16} aria-hidden="true" />
            Call
          </a>
        </div>

        <Footer />
      </div>
    </MotionConfig>
  )
}
