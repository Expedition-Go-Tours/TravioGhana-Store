/**
 * Public trust page — "Payment and Security" (/payments-and-security).
 *
 * A faithful port of the reviewed prototype (Travio_Ghana_Payments_and_
 * Security.html): hero, proof bar, sticky jump nav, who-handles-what, the
 * Stripe security feature grid, the four payment-method tab groups, the
 * pay-later grid, the booking-steps timeline, refunds, the safety notes, the
 * payments FAQ and the closing CTA.
 *
 * Four things are deliberately NOT ported from the prototype:
 *   1. its <header>/<nav> and <footer> — this route keeps the app's own
 *      Navbar and Footer (see `body:has(.ps-page)` in Navbar.css/Footer.css);
 *   2. its 9 base64 @font-face blocks — DM Sans and Manrope are already
 *      self-hosted in public/fonts, and the prototype used those same two;
 *   3. its active-section highlight on the jump nav — the prototype has no
 *      `.jump a.active` rule and no scroll-spy in its script, so nothing was
 *      ported there. A sliding active indicator was later added deliberately
 *      (see useActiveSection) rather than being recovered from the prototype;
 *   4. absolute <html> state — `.motion` rides on `.ps-page` so the reveal
 *      animation cannot leak onto other routes.
 *
 * The prototype linked out to absolute www.travioghana.com URLs; those resolve
 * to this app's own /tours, /contact-us and /refund-policy routes here. Stripe
 * documentation links stay external.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

import Footer from '@/components/Footer'
import SEO, { SITE_URL, buildBreadcrumbSchema, buildFAQSchema } from '@/components/SEO'

import '@/styles/partner-pages.css'
import '@/styles/PaymentsSecurity.css'

// Payment-brand artwork the prototype inlined as data: URIs (Stripe's payment
// method marks plus its wordmark). Decoded to real files by the port.
import affirmLogo from '@/assets/payments/affirm-logo.svg'
import afterpayClearpayLogo from '@/assets/payments/afterpay-clearpay-logo.svg'
import americanExpress from '@/assets/payments/american-express.png'
import americanExpressLogo from '@/assets/payments/american-express-logo.svg'
import applePay from '@/assets/payments/apple-pay.png'
import applePayLogo from '@/assets/payments/apple-pay-logo.svg'
import bancontactLogo from '@/assets/payments/bancontact-logo.svg'
import chinaUnionPayLogo from '@/assets/payments/china-unionpay-logo.svg'
import dinersClubLogo from '@/assets/payments/diners-club-logo.svg'
import discoverLogo from '@/assets/payments/discover-logo.svg'
import googlePay from '@/assets/payments/google-pay.png'
import googlePayLogo from '@/assets/payments/google-pay-logo.svg'
import iDEALLogo from '@/assets/payments/ideal-logo.svg'
import jcbLogo from '@/assets/payments/jcb-logo.svg'
import klarnaLogo from '@/assets/payments/klarna-logo.svg'
import linkLogo from '@/assets/payments/link-logo.svg'
import mastercard from '@/assets/payments/mastercard.png'
import mastercardLogo from '@/assets/payments/mastercard-logo.svg'
import payPalLogo from '@/assets/payments/paypal-logo.svg'
import sepaDirectDebitLogo from '@/assets/payments/sepa-direct-debit-logo.svg'
import stripe from '@/assets/payments/stripe.svg'
import visa from '@/assets/payments/visa.svg'
import visaLogo from '@/assets/payments/visa-logo.svg'

/** The prototype's four payment-method families, in the order it showed them. */
const TABS = [
  { key: 'cards', label: 'Cards' },
  { key: 'wallets', label: 'Digital wallets' },
  { key: 'local', label: 'Bank & local methods' },
  { key: 'later', label: 'Pay-later providers' },
] as const

type TabKey = (typeof TABS)[number]['key']

/** Sticky on-this-page nav. No active state, matching the prototype. */
const JUMP_LINKS = [
  { href: '#responsibility', label: 'Who handles what' },
  { href: '#security', label: 'Security features' },
  { href: '#ways-to-pay', label: 'Ways to pay' },
  { href: '#pay-later', label: 'Pay later' },
  { href: '#refunds', label: 'Refunds' },
  { href: '#stay-safe', label: 'Stay safe' },
  { href: '#questions', label: 'Questions' },
]

const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question:
      'Does Stripe guarantee that every booking is safe?',
    answer:
      'Stripe provides payment security and fraud-prevention technology. It does not guarantee a tour’s delivery, insure your booking or automatically make every transaction refundable. Check the experience details and cancellation policy before booking.',
  },
  {
    question:
      'Who decides whether I can receive a refund?',
    answer:
      'Travio Ghana handles your booking or cancellation request under the applicable booking terms. When a refund is approved and initiated, Stripe processes it through the payment network. Your bank or payment provider controls when it appears in your account.',
  },
  {
    question:
      'Can I ask Stripe directly to cancel my tour?',
    answer:
      'Contact Travio Ghana for booking changes, cancellations and refund requests. Stripe is our payment processor; it does not manage your tour itinerary or decide the booking’s cancellation terms.',
  },
  {
    question:
      'Can I use every payment method shown on this page?',
    answer:
      'The options displayed at checkout are the options available for your booking. Country, currency, transaction amount, device, bank and enabled payment methods can affect what appears. This page explains Stripe-supported payment families, rather than promising every method on every booking.',
  },
  {
    question:
      'Is reserve now, pay later the same as instalments?',
    answer:
      'No. A reserve-now-pay-later booking defers collection until the stated deadline. A buy-now-pay-later provider offers its own repayment plan. Both are available only when explicitly offered at checkout, with their own conditions.',
  },
  {
    question:
      'Will I be charged before I approve a payment?',
    answer:
      'Review the amount, currency and terms before submitting your payment. For an eligible deferred booking, check the collection date and cancellation deadline before authorising any scheduled payment.',
  },
  {
    question:
      'What should I do if a payment is declined?',
    answer:
      'Check your card details, available funds and any bank authentication request. Your bank may need to approve an international transaction. Contact your bank for the decline reason or use another method shown at checkout.',
  },
  {
    question:
      'What if a payment is duplicated or unfamiliar?',
    answer:
      'Contact Travio Ghana with your booking reference and the payment date. Your card issuer can advise on an unauthorised charge or dispute. Dispute outcomes are decided under the issuer’s and card network’s rules.',
  },
  {
    question:
      'Should I send my card details through WhatsApp or email?',
    answer:
      'Enter sensitive payment details only in the official payment flow. Never send your full card number, security code, banking password or one-time authentication code to our team by chat or email.',
  },
]
const JUMP_IDS = JUMP_LINKS.map((link) => link.href.slice(1))

type Pill = { x: number; y: number; w: number; h: number; visible: boolean }

/**
 * Geometry for the sliding highlight under the jump nav.
 *
 * One absolutely-positioned element moves to whichever link is active rather
 * than transitioning a background on each link, so the pill travels between
 * items instead of blinking. Sizes come from the live layout, so it stays
 * aligned when the font loads or the window resizes, and `scrollLeft` keeps it
 * over the right link once the nav scrolls sideways on narrow screens.
 *
 * The last known geometry is kept while nothing is active, so the pill can be
 * hidden and re-shown without sliding back in from the left edge.
 */
function useJumpPill(navRef: React.RefObject<HTMLElement | null>, active: string) {
  const [pill, setPill] = useState<Pill>({ x: 0, y: 0, w: 0, h: 0, visible: false })

  useEffect(() => {
    const place = () => {
      const nav = navRef.current
      const wrap = nav?.querySelector<HTMLElement>('.wrap')
      if (!nav || !wrap) return
      const link = active ? nav.querySelector<HTMLElement>(`a[href="#${active}"]`) : null
      if (!link) {
        setPill((prev) => (prev.visible ? { ...prev, visible: false } : prev))
        return
      }
      // Bleed the pill past the text so it reads as a chip; the nav's own
      // padding absorbs the overhang.
      const bleed = 6
      const wrapRect = wrap.getBoundingClientRect()
      const rect = link.getBoundingClientRect()
      const next: Pill = {
        x: rect.left - wrapRect.left + wrap.scrollLeft,
        y: rect.top - wrapRect.top - bleed,
        w: rect.width,
        h: rect.height + bleed * 2,
        visible: true,
      }

      // On narrow screens the nav scrolls sideways, so the active item — and
      // the pill sitting on it — can be off-screen. Centre it, but only when
      // it is genuinely out of view, so the row never drifts under a reader
      // who is scrolling through the page. The pill needs no adjustment: it is
      // positioned in content coordinates, so it travels with the scroll.
      const offsetInView = rect.left - wrapRect.left
      if (offsetInView < 0 || offsetInView + rect.width > wrap.clientWidth) {
        const target = wrap.scrollLeft + offsetInView - (wrap.clientWidth - rect.width) / 2
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        wrap.scrollTo({
          left: Math.max(0, Math.min(target, wrap.scrollWidth - wrap.clientWidth)),
          behavior: reduce ? 'auto' : 'smooth',
        })
      }

      setPill((prev) =>
        prev.x === next.x &&
        prev.y === next.y &&
        prev.w === next.w &&
        prev.h === next.h &&
        prev.visible === next.visible
          ? prev
          : next,
      )
    }

    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [navRef, active])

  return pill
}

/**
 * The prototype's reveal script: `.reveal` elements fade/slide in once, but
 * only when motion is allowed — otherwise they must simply be visible.
 */
function useRevealOnScroll(rootRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const items = Array.from(root.querySelectorAll<HTMLElement>('.reveal'))
    if (typeof IntersectionObserver === 'undefined') {
      items.forEach((el) => el.classList.add('seen'))
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('seen')
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.05 },
    )
    items.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [rootRef])
}

/**
 * How far below the chrome a section's top may sit and still count as active.
 *
 * `scroll-margin-top` (120px) and the real chrome height (64px navbar + a 54px
 * jump nav = 118px) live in different places and drift apart at breakpoints.
 * Without this slack, clicking a jump link parks its heading a couple of pixels
 * below the line and the highlight stays on the *previous* section. 32px is far
 * too small to read as switching early.
 */
const ACTIVATION_SLACK = 32

/**
 * Which jump-nav section is currently in view.
 *
 * The active section is the last one whose top has passed the line just under
 * the sticky chrome (fixed navbar + jump nav), so the highlight changes as the
 * heading scrolls under the nav rather than when it first appears. Above the
 * first section — the hero — nothing is active and the pill hides.
 *
 * Deliberately measured rather than watched with IntersectionObserver: "the
 * last section above a line" is a direct computation, and scroll handlers can
 * skip entries under fast scrolling, which would leave the highlight stranded
 * on the wrong item.
 */
function useActiveSection(ids: string[], navRef: React.RefObject<HTMLElement | null>) {
  const [active, setActive] = useState('')

  useEffect(() => {
    let frame = 0

    const measure = () => {
      frame = 0
      const nav = navRef.current
      if (!nav) return
      const navbar = document.querySelector('.navbar')
      const line =
        (navbar?.getBoundingClientRect().bottom ?? 0) + nav.getBoundingClientRect().height + ACTIVATION_SLACK

      // At the very bottom the final section may never reach the line — a short
      // last section can't scroll up that far — so pin it explicitly.
      const scrolled = window.scrollY + window.innerHeight
      if (scrolled >= document.documentElement.scrollHeight - 2) {
        setActive(ids[ids.length - 1])
        return
      }

      let current = ''
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= line) current = id
      }
      setActive(current)
    }

    const schedule = () => {
      if (frame) return
      frame = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [ids, navRef])

  return active
}

export default function PaymentsSecurityPage() {
  const pageRef = useRef<HTMLElement>(null)

  // Resolved during the first render (before paint) so content is never
  // hidden and then revealed — the prototype did the same synchronously.
  const [motionAllowed] = useState(
    () =>
      typeof IntersectionObserver !== 'undefined' &&
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  const [activeTab, setActiveTab] = useState<TabKey>('cards')

  // Scroll-spy for the jump nav. The prototype had no active state at all, so
  // this is a deliberate addition: the highlight slides between items as the
  // reader moves through the page.
  const jumpNavRef = useRef<HTMLElement>(null)
  const activeSection = useActiveSection(JUMP_IDS, jumpNavRef)
  const pill = useJumpPill(jumpNavRef, activeSection)

  useRevealOnScroll(pageRef)

  const selectTab = useCallback((key: TabKey) => {
    setActiveTab(key)
  }, [])

  /** Roving tabindex: arrows wrap, Home/End jump to the ends. */
  const onTabKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | undefined
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length
    if (event.key === 'ArrowLeft') next = (index + TABS.length - 1) % TABS.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = TABS.length - 1
    if (next === undefined) return
    event.preventDefault()
    const tab = TABS[next]
    setActiveTab(tab.key)
    // Focus follows selection, so the tablist stays a single tab stop.
    document.getElementById(`tab-${tab.key}`)?.focus()
  }, [])

  return (
    <motion.main
      ref={pageRef}
      className={`ps-page${motionAllowed ? ' motion' : ''}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <SEO
        title="Payment and Security"
        description="How your payment is protected when you book with Travio Ghana. Stripe-processed payments, every way to pay, reserve-now-pay-later options, refunds and answers to common payment questions."
        keywords="payment security Ghana, secure payments Ghana, Stripe payments, pay by card Ghana, digital wallet Ghana, pay later Ghana, refund policy, Travio Ghana payments"
        jsonLd={[
          buildBreadcrumbSchema([
            { name: 'Home', url: `${SITE_URL}/` },
            { name: 'Payment and Security', url: `${SITE_URL}/payments-and-security` },
          ]),
          buildFAQSchema(FAQ_ITEMS),
        ]}
      />  <section className="hero">
    <div className="wrap hero-grid">
      <div className="hero-copy">
        <div className="origin"><svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
          <path d="m12 3-7 3v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
          <path d="m8 12 3 3 5-6" /></svg> Payments processed through Stripe</div>
        <h1>Secure payments.<br /><em>Clear choices.<br />More confidence.</em></h1>
        <p>Discover Ghana with a clearer understanding of how you pay. We use Stripe to process online payments, with security technology designed to protect your payment information.</p>
        <div className="actions">
          <a className="btn gold" href="#security">How your payment is protected <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
            <path d="m12 3-7 3v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
            <path d="m8 12 3 3 5-6" /></svg></a>
          <a className="btn outline" href="#ways-to-pay">Explore payment options</a>
        </div>
        <div className="micro">
          <span>Encrypted payment data</span>
          <span>Bank authentication</span>
          <span>Clear booking terms</span>
        </div>
      </div>
      <div className="payment-visual" aria-label="How Stripe supports the payment journey">
        <div className="visual-head">
          <span>THE PAYMENT JOURNEY</span>
          <img className="stripe-original-logo" src={stripe} alt="Stripe" width="84" height="35" />
        </div>
        <div className="visual-card">
          <div className="visual-label"><svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
            <rect x="5" y="10" width="14" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></svg> Your payment, explained</div>
          <div className="visual-route">
            <div className="route-row">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
                <rect x="3" y="5" width="18" height="14" rx="3" />
                <path d="M3 10h18M7 15h4" />
              </svg>
              <div>
                <strong>You choose how to pay</strong>
                <span>Review the price, currency and booking terms.</span>
              </div>
              <span className="route-count">01</span>
            </div>
            <div className="route-row">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
                <path d="m12 3-7 3v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
                <path d="m8 12 3 3 5-6" />
              </svg>
              <div>
                <strong>Stripe processes the payment</strong>
                <span>Your bank may request authentication.</span>
              </div>
              <span className="route-count">02</span>
            </div>
            <div className="route-row">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
                <path d="m5 12 4 4L19 6" />
              </svg>
              <div>
                <strong>We confirm your booking</strong>
                <span>Keep your confirmation and booking reference.</span>
              </div>
              <span className="route-count">03</span>
            </div>
          </div>
          <div className="visual-logos">
            <div className="visual-logo">
              <img src={visa} alt="Visa" />
            </div>
            <div className="visual-logo">
              <img src={mastercard} alt="Mastercard" />
            </div>
            <div className="visual-logo">
              <img src={americanExpress} alt="American Express" />
            </div>
            <div className="visual-logo">
              <img src={applePay} alt="Apple Pay" />
            </div>
            <div className="visual-logo">
              <img src={googlePay} alt="Google Pay" />
            </div>
          </div>
        </div>
        <p className="visual-note">An explanation of the payment journey. Available methods and confirmation timing depend on your checkout and booking.</p>
      </div>
    </div>
  </section>
  <div className="wrap proof">
    <div>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </svg>
      <div>
        <strong>Payment security</strong>
        <span>Stripe’s encrypted payment infrastructure</span>
      </div>
    </div>
    <div>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M3 10h18M7 15h4" />
      </svg>
      <div>
        <strong>Choose at checkout</strong>
        <span>See the methods available for your booking</span>
      </div>
    </div>
    <div>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
        <path d="m5 12 4 4L19 6" />
      </svg>
      <div>
        <strong>Clear responsibility</strong>
        <span>Local booking support. Stripe payment processing.</span>
      </div>
    </div>
  </div>
  <nav className="jump" aria-label="On this page" ref={jumpNavRef}>
    <div className="wrap">
      <span
        aria-hidden="true"
        className="jump-pill"
        data-visible={pill.visible ? 'true' : 'false'}
        style={{
          transform: `translateX(${pill.x}px)`,
          top: pill.y,
          width: pill.w,
          height: pill.h,
        }}
      />
      {JUMP_LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          aria-current={activeSection === link.href.slice(1) ? 'true' : undefined}
        >
          {link.label}
        </a>
      ))}
    </div>
  </nav>
  <section className="content" id="responsibility">
    <div className="wrap split reveal">
      <div>
        <p className="eyebrow">Local service. Specialist payment technology.</p>
        <h2>A Ghanaian team.<br />A trusted payment<br />infrastructure.</h2>
        <div className="copy" style={{ marginTop: '25px' }}>
          <p>Travio Ghana is operated by Expedition-Go Tours Ltd. Our team supports your travel booking; Stripe provides the technology that processes online payments.</p>
          <p>You choose from the options offered at checkout and review the amount, currency and terms before paying.</p>
          <p><strong>Payment security and booking protection work together.</strong> Stripe secures the payment process. Your experience’s booking and cancellation terms explain what happens if your plans change.</p>
        </div>
      </div>
      <div className="clarity-panel">
        <h3>Who handles what?</h3>
        <div className="role">
          <strong>Stripe · payment processing</strong>
          <p>Processes transactions and initiated refunds through the payment network, with the security features available for the integration.</p>
        </div>
        <div className="role">
          <strong>Travio Ghana · booking support</strong>
          <p>Helps with your booking, cancellation requests and refund eligibility under the applicable terms.</p>
        </div>
        <div className="role">
          <strong>Your bank or provider · authorisation</strong>
          <p>Approves payments, may request authentication and determines when credits appear in your account.</p>
        </div>
        <a className="source-link" href="https://docs.stripe.com/refunds" target="_blank" rel="noopener noreferrer">How Stripe processes refunds <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
          <path d="M14 5h5v5M10 14 19 5M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg></a>
      </div>
    </div>
  </section>
  <section id="security" className="content dark">
    <div className="wrap reveal">
      <div className="section-head">
        <div>
          <p className="eyebrow">Protection behind the payment</p>
          <h2>More than a<br />payment button.</h2>
        </div>
        <p>Stripe combines secure infrastructure, card-data protection and authentication tools. Here are the key technologies relevant to online payments.</p>
      </div>
      <div className="feature-grid">
        <article className="feature-card">
          <div className="feature-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
              <rect x="5" y="10" width="14" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
            </svg>
          </div>
          <span className="number">01 / PAYMENT TECHNOLOGY</span>
          <h3>Encrypted connections</h3>
          <p>Stripe uses HTTPS and TLS to protect information moving between your device and its services.</p>
          <a className="source-link" href="https://docs.stripe.com/security" target="_blank" rel="noopener noreferrer">Learn more at Stripe <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
            <path d="M14 5h5v5M10 14 19 5M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg></a>
        </article>
        <article className="feature-card">
          <div className="feature-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <path d="M3 10h18M7 15h4" />
            </svg>
          </div>
          <span className="number">02 / PAYMENT TECHNOLOGY</span>
          <h3>Tokenisation & card vaults</h3>
          <p>Stripe replaces raw card numbers with tokens in its infrastructure and encrypts stored card numbers using AES-256.</p>
          <a className="source-link" href="https://docs.stripe.com/security" target="_blank" rel="noopener noreferrer">Learn more at Stripe <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
            <path d="M14 5h5v5M10 14 19 5M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg></a>
        </article>
        <article className="feature-card">
          <div className="feature-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
              <path d="m12 3-7 3v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
              <path d="m8 12 3 3 5-6" />
            </svg>
          </div>
          <span className="number">03 / PAYMENT TECHNOLOGY</span>
          <h3>PCI Level 1 certification</h3>
          <p>Stripe is certified as a PCI Level 1 service provider. This certification applies to Stripe’s payment environment.</p>
          <a className="source-link" href="https://support.stripe.com/questions/what-is-pci-compliance" target="_blank" rel="noopener noreferrer">Learn more at Stripe <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
            <path d="M14 5h5v5M10 14 19 5M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg></a>
        </article>
        <article className="feature-card">
          <div className="feature-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
              <path d="m12 3-7 3v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
              <path d="m8 12 3 3 5-6" />
            </svg>
          </div>
          <span className="number">04 / PAYMENT TECHNOLOGY</span>
          <h3>Fraud screening with Radar</h3>
          <p>Stripe Radar analyses payment signals to identify suspicious activity. Available checks and rules depend on the payment setup.</p>
          <a className="source-link" href="https://stripe.com/radar" target="_blank" rel="noopener noreferrer">Learn more at Stripe <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
            <path d="M14 5h5v5M10 14 19 5M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg></a>
        </article>
        <article className="feature-card">
          <div className="feature-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
              <path d="m5 12 4 4L19 6" />
            </svg>
          </div>
          <span className="number">05 / PAYMENT TECHNOLOGY</span>
          <h3>3D Secure authentication</h3>
          <p>Your bank may ask you to approve a card payment through its app, a code or another authentication step.</p>
          <a className="source-link" href="https://docs.stripe.com/payments/3d-secure" target="_blank" rel="noopener noreferrer">Learn more at Stripe <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
            <path d="M14 5h5v5M10 14 19 5M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg></a>
        </article>
        <article className="feature-card">
          <div className="feature-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <path d="M3 10h18M7 15h4" />
            </svg>
          </div>
          <span className="number">06 / PAYMENT TECHNOLOGY</span>
          <h3>Wallet authentication</h3>
          <p>Supported wallets can simplify payment using your device’s authentication. Availability depends on your device, browser and checkout.</p>
          <a className="source-link" href="https://docs.stripe.com/payments/wallets" target="_blank" rel="noopener noreferrer">Learn more at Stripe <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
            <path d="M14 5h5v5M10 14 19 5M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg></a>
        </article>
      </div>
      <p className="technology-note">These descriptions explain Stripe’s capabilities. Features applied to a transaction depend on the integration, payment method and bank. Stripe’s certifications do not automatically certify Travio Ghana’s entire website.</p>
    </div>
  </section>
  <section id="ways-to-pay" className="content methods">
    <div className="wrap reveal">
      <div className="section-head">
        <div>
          <p className="eyebrow">Ways you can pay</p>
          <h2>Familiar methods.<br />A simpler checkout.</h2>
        </div>
        <p>Recognisable brands. Clear choices. Explore widely used payment methods supported by Stripe below, then choose from the options shown for your booking at checkout.</p>
      </div>
      <div className="method-tabs" role="tablist" aria-label="Payment method families">
        {TABS.map((tab, index) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`tab-${tab.key}`}
            aria-controls={`panel-${tab.key}`}
            aria-selected={activeTab === tab.key}
            tabIndex={activeTab === tab.key ? 0 : -1}
            data-panel={tab.key}
            onClick={() => selectTab(tab.key)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="method-panel" id="panel-cards" role="tabpanel" aria-labelledby="tab-cards" tabIndex={0} hidden={activeTab !== 'cards'}>
        <h3>Pay with a supported debit or credit card.</h3>
        <p>Major card networks supported by Stripe include Visa, Mastercard and American Express. Other networks, such as Discover, Diners Club, JCB and UnionPay, depend on account location and payment configuration.</p>
        <div className="brand-grid official-methods">
          <div className="brand-card">
            <div className="payment-logo-stage">
              <img src={visaLogo} alt="Visa logo" loading="lazy" />
            </div>
            <span>Visa</span>
            <small>Debit & credit cards</small>
          </div>
          <div className="brand-card">
            <div className="payment-logo-stage">
              <img src={mastercardLogo} alt="Mastercard logo" loading="lazy" />
            </div>
            <span>Mastercard</span>
            <small>Debit & credit cards</small>
          </div>
          <div className="brand-card">
            <div className="payment-logo-stage">
              <img src={americanExpressLogo} alt="American Express logo" loading="lazy" />
            </div>
            <span>American Express</span>
            <small>Card network</small>
          </div>
          <div className="brand-card">
            <div className="payment-logo-stage">
              <img src={discoverLogo} alt="Discover logo" loading="lazy" />
            </div>
            <span>Discover</span>
            <small>Card network</small>
          </div>
          <div className="brand-card">
            <div className="payment-logo-stage">
              <img src={dinersClubLogo} alt="Diners Club logo" loading="lazy" />
            </div>
            <span>Diners Club</span>
            <small>Card network</small>
          </div>
          <div className="brand-card">
            <div className="payment-logo-stage">
              <img src={jcbLogo} alt="JCB logo" loading="lazy" />
            </div>
            <span>JCB</span>
            <small>Card network</small>
          </div>
          <div className="brand-card">
            <div className="payment-logo-stage">
              <img src={chinaUnionPayLogo} alt="China UnionPay logo" loading="lazy" />
            </div>
            <span>China UnionPay</span>
            <small>UnionPay card network</small>
          </div>
        </div>
        <div className="method-tags">
          <span>Debit cards</span>
          <span>Credit cards</span>
          <span>Other eligible card networks</span>
        </div>
        <a className="source-link" href="https://docs.stripe.com/payments/cards" target="_blank" rel="noopener noreferrer">Stripe card support <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
          <path d="M14 5h5v5M10 14 19 5M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg></a>
      </div>
      <div className="method-panel" id="panel-wallets" role="tabpanel" aria-labelledby="tab-wallets" tabIndex={0} hidden={activeTab !== 'wallets'}>
        <h3>Use a wallet on a supported device.</h3>
        <p>Apple Pay and Google Pay support device-based checkout. Link can save payment details for reuse; PayPal is supported in eligible markets. Use a wallet when it appears at checkout.</p>
        <div className="brand-grid official-methods">
          <div className="brand-card">
            <div className="payment-logo-stage">
              <img src={applePayLogo} alt="Apple Pay logo" loading="lazy" />
            </div>
            <span>Apple Pay</span>
            <small>Apple devices & browsers</small>
          </div>
          <div className="brand-card">
            <div className="payment-logo-stage">
              <img src={googlePayLogo} alt="Google Pay logo" loading="lazy" />
            </div>
            <span>Google Pay</span>
            <small>Supported devices & browsers</small>
          </div>
          <div className="brand-card">
            <div className="payment-logo-stage">
              <img src={linkLogo} alt="Link logo" loading="lazy" />
            </div>
            <span>Link</span>
            <small>Stripe’s digital wallet</small>
          </div>
          <div className="brand-card">
            <div className="payment-logo-stage">
              <img src={payPalLogo} alt="PayPal logo" loading="lazy" />
            </div>
            <span>PayPal</span>
            <small>Eligible accounts & markets</small>
          </div>
        </div>
        <a className="source-link" href="https://docs.stripe.com/payments/wallets" target="_blank" rel="noopener noreferrer">Stripe wallet support <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
          <path d="M14 5h5v5M10 14 19 5M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg></a>
      </div>
      <div className="method-panel" id="panel-local" role="tabpanel" aria-labelledby="tab-local" tabIndex={0} hidden={activeTab !== 'local'}>
        <h3>Local options, where the checkout supports them.</h3>
        <p>Stripe supports local methods such as iDEAL in the Netherlands, Bancontact in Belgium and SEPA Direct Debit in Europe. These examples depend on account location, country, currency and checkout support.</p>
        <div className="brand-grid official-methods">
          <div className="brand-card">
            <div className="payment-logo-stage">
              <img src={iDEALLogo} alt="iDEAL logo" loading="lazy" />
            </div>
            <span>iDEAL</span>
            <small>Online banking · Netherlands</small>
          </div>
          <div className="brand-card">
            <div className="payment-logo-stage">
              <img src={bancontactLogo} alt="Bancontact logo" loading="lazy" />
            </div>
            <span>Bancontact</span>
            <small>Local payments · Belgium</small>
          </div>
          <div className="brand-card">
            <div className="payment-logo-stage">
              <img src={sepaDirectDebitLogo} alt="SEPA Direct Debit logo" loading="lazy" />
            </div>
            <span>SEPA Direct Debit</span>
            <small>Bank debit · Europe</small>
          </div>
        </div>
        <p style={{ marginTop: '22px' }}>A method is available for your Travio Ghana booking only if it appears at checkout. This page does not confirm Ghana mobile money or direct bank-transfer acceptance.</p>
        <a className="source-link" href="https://docs.stripe.com/payments/payment-methods/overview" target="_blank" rel="noopener noreferrer">Stripe payment-method overview <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
          <path d="M14 5h5v5M10 14 19 5M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg></a>
      </div>
      <div className="method-panel" id="panel-later" role="tabpanel" aria-labelledby="tab-later" tabIndex={0} hidden={activeTab !== 'later'}>
        <h3>Eligible repayment options from third-party providers.</h3>
        <p>Stripe supports buy-now-pay-later providers including Klarna, Affirm and Afterpay/Clearpay in eligible markets. A provider may offer instalments or deferred repayment according to its own eligibility checks and terms.</p>
        <div className="brand-grid official-methods">
          <div className="brand-card">
            <div className="payment-logo-stage">
              <img src={klarnaLogo} alt="Klarna logo" loading="lazy" />
            </div>
            <span>Klarna</span>
            <small>Eligible pay-later plans</small>
          </div>
          <div className="brand-card">
            <div className="payment-logo-stage">
              <img src={affirmLogo} alt="Affirm logo" loading="lazy" />
            </div>
            <span>Affirm</span>
            <small>Eligible repayment plans</small>
          </div>
          <div className="brand-card">
            <div className="payment-logo-stage">
              <img src={afterpayClearpayLogo} alt="Afterpay/Clearpay logo" loading="lazy" />
            </div>
            <span>Afterpay/Clearpay</span>
            <small>Eligible instalment plans</small>
          </div>
        </div>
        <p style={{ marginTop: '22px' }}>Use a pay-later provider only if it appears at checkout. Review the total payable, repayment schedule, possible interest or fees and cancellation treatment before accepting.</p>
        <a className="source-link" href="https://docs.stripe.com/payments/buy-now-pay-later" target="_blank" rel="noopener noreferrer">Stripe pay-later overview <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
          <path d="M14 5h5v5M10 14 19 5M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg></a>
      </div>
      <p className="availability">Available methods vary by booking, country, currency, device and eligibility. The options and amounts displayed at checkout take priority.</p>
    </div>
  </section>
  <section id="pay-later" className="content">
    <div className="wrap reveal">
      <div className="section-head">
        <div>
          <p className="eyebrow">Flexibility with clear terms</p>
          <h2>Plan ahead.<br />Know when you pay.</h2>
        </div>
        <p>Reserve now, pay later and buy now, pay later are different arrangements. Read the option offered for your booking before you choose.</p>
      </div>
      <div className="paylater-grid">
        <article className="option">
          <div className="option-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </div>
          <span className="tag">WHERE OFFERED FOR YOUR BOOKING</span>
          <h3>Reserve now.<br />Pay later.</h3>
          <p>For an eligible booking, a reservation may allow payment to be collected later under the stated booking terms.</p>
          <ul>
            <li>Check the payment date and any authorisation requirement.</li>
            <li>Review the cancellation deadline and what happens if payment fails.</li>
            <li>A reservation is confirmed only as explained in your booking confirmation.</li>
          </ul>
        </article>
        <article className="option">
          <div className="option-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <path d="M3 10h18M7 15h4" />
            </svg>
          </div>
          <span className="tag">WHEN AN ELIGIBLE PROVIDER IS SHOWN</span>
          <h3>Buy now.<br />Pay over time.</h3>
          <p>A third-party provider may offer instalments or delayed repayment. It decides eligibility and sets the repayment terms.</p>
          <ul>
            <li>Review the provider’s schedule, fees and any interest.</li>
            <li>Follow the provider’s instructions after a cancellation or refund.</li>
            <li>Do not stop repayments unless your provider tells you to.</li>
          </ul>
          <a className="source-link" href="https://docs.stripe.com/payments/buy-now-pay-later" target="_blank" rel="noopener noreferrer">About Stripe-supported pay-later methods <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
            <path d="M14 5h5v5M10 14 19 5M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg></a>
        </article>
      </div>
    </div>
  </section>
  <section className="content methods">
    <div className="wrap reveal">
      <p className="eyebrow">The payment journey</p>
      <h2>Understand each step.</h2>
      <div className="timeline">
        <article className="step">
          <span className="step-number">STEP 01</span>
          <h3>Review your booking</h3>
          <p>Check the date, guests, inclusions, total price, currency and cancellation policy.</p>
        </article>
        <article className="step">
          <span className="step-number">STEP 02</span>
          <h3>Choose & authorise</h3>
          <p>Select an available payment method. Complete any authentication requested by your bank or provider.</p>
        </article>
        <article className="step">
          <span className="step-number">STEP 03</span>
          <h3>Keep your confirmation</h3>
          <p>Save your booking reference and payment confirmation. Some methods can take longer to confirm.</p>
        </article>
        <article className="step">
          <span className="step-number">STEP 04</span>
          <h3>Get help if needed</h3>
          <p>Contact our team with your booking reference for changes, payment questions or a refund request.</p>
        </article>
      </div>
    </div>
  </section>
  <section id="refunds" className="content refund">
    <div className="wrap split reveal">
      <div>
        <p className="eyebrow">Refunds & payment questions</p>
        <h2>A clear route<br />when plans change.</h2>
        <div className="copy" style={{ marginTop: '26px' }}>
          <p>Your booking’s cancellation policy determines whether a refund is available. Contact Travio Ghana to request a cancellation or refund.</p>
          <p>Once an eligible refund is initiated, Stripe sends it through the payment network. Your bank or provider determines when it appears in your account.</p>
          <p>Payment processing does not remove the booking’s cancellation conditions or make a non-refundable booking automatically refundable.</p>
        </div>
        <div className="actions">
          <Link className="btn" to="/contact-us">Contact booking support</Link>
          <Link className="source-link" to="/refund-policy">Read our refund policy <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
            <path d="M14 5h5v5M10 14 19 5M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg></Link>
        </div>
      </div>
      <div className="refund-box">
        <h3>What to expect</h3>
        <ul className="refund-list">
          <li>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
              <path d="m5 12 4 4L19 6" />
            </svg>
            <span>Refunds normally return to the original payment method. Stripe does not let a refund be redirected to an unrelated card.</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <span>Timing varies by payment method and bank. A pending or failed refund may need follow-up.</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <path d="M3 10h18M7 15h4" />
            </svg>
            <span>A refund can appear as a separate credit or, for some recent transactions, as the original charge disappearing.</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
              <path d="m12 3-7 3v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
              <path d="m8 12 3 3 5-6" />
            </svg>
            <span>If you do not recognise a charge, contact our team and ask your card issuer about its dispute process.</span>
          </li>
        </ul>
        <a className="source-link" href="https://docs.stripe.com/refunds" target="_blank" rel="noopener noreferrer">Stripe’s refund process <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
          <path d="M14 5h5v5M10 14 19 5M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg></a>
      </div>
    </div>
  </section>
  <section id="stay-safe" className="content">
    <div className="wrap reveal">
      <div className="section-head">
        <div>
          <p className="eyebrow">Small steps that protect you</p>
          <h2>Stay in control<br />of your payment.</h2>
        </div>
        <p>Use the official booking flow and keep your payment information private.</p>
      </div>
      <div className="safe-grid">
        <article className="safe-card">
          <h3>Use the official checkout</h3>
          <p>Start from travioghana.com. If a payment request seems unusual, contact our team through the official website before proceeding.</p>
        </article>
        <article className="safe-card">
          <h3>Keep authentication private</h3>
          <p>Never share a card security code, bank password or one-time bank code with a guide or support agent.</p>
        </article>
        <article className="safe-card">
          <h3>Check the price & currency</h3>
          <p>Review the final checkout amount. Your bank may apply its own conversion or international-transaction fees.</p>
        </article>
        <article className="safe-card">
          <h3>Keep your booking reference</h3>
          <p>Save confirmation details so our team can locate the booking and help with payment or cancellation questions.</p>
        </article>
      </div>
    </div>
  </section>
  <section id="questions" className="content methods">
    <div className="wrap faq-grid">
      <div className="faq-intro">
        <p className="eyebrow">Payments FAQ</p>
        <h2>Your questions,<br />answered.</h2>
        <p>Clear answers about Stripe, payment methods, deferred payments and refunds.</p>
        <Link className="btn" to="/contact-us">Ask our team</Link>
      </div>
      <div className="accordion reveal">
        {FAQ_ITEMS.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>
              <span>{String(index + 1).padStart(2, '0')}</span>
              {item.question}
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </div>
    <div className="wrap sources">
      <p>Learn more from Stripe’s official payment and security documentation.</p>
      <div className="source-tags">
        <a href="https://docs.stripe.com/security" target="_blank" rel="noopener noreferrer">Security at Stripe</a>
        <a href="https://support.stripe.com/questions/what-is-pci-compliance" target="_blank" rel="noopener noreferrer">PCI certification</a>
        <a href="https://stripe.com/radar" target="_blank" rel="noopener noreferrer">Radar</a>
        <a href="https://docs.stripe.com/payments/3d-secure" target="_blank" rel="noopener noreferrer">3D Secure</a>
        <a href="https://docs.stripe.com/payments/payment-methods/overview" target="_blank" rel="noopener noreferrer">Payment methods</a>
        <a href="https://docs.stripe.com/payments/link" target="_blank" rel="noopener noreferrer">Link wallet</a>
        <a href="https://docs.stripe.com/payments/buy-now-pay-later" target="_blank" rel="noopener noreferrer">Pay-later methods</a>
        <a href="https://docs.stripe.com/refunds" target="_blank" rel="noopener noreferrer">Refunds</a>
      </div>
    </div>
  </section>
  <div className="wrap" style={{ padding: '70px 0' }}>
    <section className="cta">
      <p className="eyebrow">Built in Ghana. Here to help.</p>
      <h2>Explore with clarity.<br />Pay with confidence.</h2>
      <p>Discover local experiences, review the terms and choose the payment option that works for you.</p>
      <div className="actions">
        <Link className="btn light" to="/tours">Explore experiences <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
          <path d="M14 5h5v5M10 14 19 5M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg></Link>
        <Link className="btn outline" to="/contact-us">Speak with our team</Link>
      </div>
    </section>
  </div>
<Footer />
    </motion.main>
  )
}