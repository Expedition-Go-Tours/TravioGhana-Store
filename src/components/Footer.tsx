import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useCurrency, availableCurrencies } from '../contexts/CurrencyContext'
import { useCookieConsent } from '../context/CookieConsentContext'
import { prefetchRouteChunk } from '../lib/prefetchRouteChunks'
import LanguageCurrencyModal from './LanguageCurrencyModal'
import './Footer.css'
import visaSrc from '../assets/icons/visa.svg'
import americanexpressSrc from '../assets/images/amex.png'
import applePaySrc from '../assets/images/apple.png'
import googlePaySrc from '../assets/images/gpay.png'
import mastercardSrc from '../assets/images/master.png'
import paypalSrc from '../assets/images/papy.png'

const LANGUAGES = [
  { code: 'en', flag: '🇬🇧', label: 'English (US)' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'nl', flag: '🇳🇱', label: 'Nederlands' },
]

/** The page favicon artwork (same image as /favicon-64.png, at 192px) used as
    the footer's brand mark. */
const FOOTER_MARK_SRC = '/android-chrome-192x192.png'

const PAYMENTS = [
  { key: 'mastercard', src: mastercardSrc, alt: 'Mastercard' },
  { key: 'visa', src: visaSrc, alt: 'Visa' },
  { key: 'amex', src: americanexpressSrc, alt: 'American Express' },
  { key: 'paypal', src: paypalSrc, alt: 'PayPal' },
  { key: 'gpay', src: googlePaySrc, alt: 'Google Pay' },
  { key: 'apple', src: applePaySrc, alt: 'Apple Pay' },
]

const SOCIALS = [
  {
    key: 'instagram',
    label: 'Instagram',
    href: 'https://www.instagram.com/travioGhanatours',
    path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069M12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    href: 'https://www.facebook.com/p/Travio%20Ghana-Tours-LTD-61567042001418/',
    path: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    href: 'https://www.tiktok.com/@expeditiongotours',
    path: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  },
  {
    key: 'youtube',
    label: 'YouTube',
    href: 'https://www.youtube.com/c/ExpeditionGoTravelandToursLTD',
    path: 'M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  },
]

/**
 * Footer link: same-tab SPA navigation (never a new tab — social links below
 * stay external), with the destination chunk warmed on hover/focus so the
 * route transition doesn't flash the Suspense fallback.
 */
function FooterLink({
  to,
  className = 'footer-nav-link',
  children,
}: {
  to: string
  className?: string
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      className={className}
      onPointerEnter={() => prefetchRouteChunk(to)}
      onFocus={() => prefetchRouteChunk(to)}
    >
      {children}
    </Link>
  )
}

/** Phones fold the link columns into accordion rows (matches the breakpoint the
    rest of the mobile footer uses). */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return isMobile
}

interface FooterNavGroupProps {
  id: string
  title: string
  links: { to: string; label: string; strong?: boolean }[]
  /** Mobile: collapsible row. Desktop/tablet: always-open column. */
  isMobile: boolean
}

function FooterNavGroup({ id, title, links, isMobile }: FooterNavGroupProps) {
  const [open, setOpen] = useState(false)
  const reduceMotion = useReducedMotion()

  const list = (
    <ul>
      {links.map((link) => (
        <li key={`${link.to}-${link.label}`}>
          <FooterLink
            to={link.to}
            className={`footer-nav-link${link.strong ? ' footer-nav-link--strong' : ''}`}
          >
            {link.label}
            {link.strong && (
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M3 13 13 3M6 3h7v7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </FooterLink>
        </li>
      ))}
    </ul>
  )

  if (!isMobile) {
    return (
      <nav className="footer-nav-group" aria-label={title}>
        <h3 className="footer-nav-title">{title}</h3>
        {list}
      </nav>
    )
  }

  return (
    <nav className="footer-nav-group footer-nav-group--accordion" aria-label={title}>
      <button
        type="button"
        className="footer-nav-head"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="footer-nav-title">{title}</span>
        <ChevronDown className="footer-nav-chevron" size={16} strokeWidth={2} aria-hidden="true" />
      </button>
      {reduceMotion ? (
        open ? (
          <div className="footer-nav-panel" id={id}>
            {list}
          </div>
        ) : null
      ) : (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id={id}
              className="footer-nav-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: 'easeInOut' }}
            >
              {list}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </nav>
  )
}

export default function Footer() {
  const { t, i18n: activeI18n } = useTranslation()
  const { currency } = useCurrency()
  const { openPreferences } = useCookieConsent()
  const langCode = (activeI18n.language ?? 'en').substring(0, 2).toLowerCase()
  // Language/currency are chosen via the same modal the navbar uses; the tab
  // to open is remembered per button (language vs currency).
  const [modalTab, setModalTab] = useState<'language' | 'currency' | null>(null)
  const isMobile = useIsMobile()
  const currentLang = LANGUAGES.find((lang) => lang.code === langCode)
  const currentCurrency = availableCurrencies.find((c) => c.code === currency.code)
  const year = new Date().getFullYear()

  const navGroups: { key: string; title: string; links: { to: string; label: string; strong?: boolean }[] }[] = [
    {
      key: 'explore',
      title: t('footer.explore'),
      links: [
        { to: '/', label: t('footer.home') },
        { to: '/tours', label: t('footer.exploreTours') },
        { to: '/hotels', label: t('footer.hotelsStays') },
        { to: '/blog', label: t('footer.travelInspiration') },
      ],
    },
    {
      key: 'support',
      title: t('footer.support'),
      links: [
        { to: '/help-centre', label: t('footer.helpCentre') },
        { to: '/contact-us', label: t('footer.contactUs') },
        { to: '/faq', label: t('footer.faq') },
        { to: '/refund-policy', label: t('footer.refundPolicy') },
      ],
    },
    {
      key: 'company',
      title: t('footer.company'),
      links: [
        { to: '/about-us', label: t('footer.aboutUs') },
        { to: '/careers', label: t('footer.careers') },
        { to: '/partnerships', label: t('footer.partnerships') },
        { to: '/foundation', label: t('footer.ourFoundation') },
        { to: '/supplier-terms', label: t('footer.supplierTerms') },
      ],
    },
    {
      key: 'work',
      title: t('footer.supplierZone'),
      links: [
        { to: '/supplier/list-experience', label: t('footer.asSupplier'), strong: true },
        { to: '/content-creators', label: t('footer.asContentCreator') },
        { to: '/travel-agents', label: t('footer.asTravelAgentReseller') },
        { to: '/transport-providers', label: t('footer.asTransportProvider') },
        { to: '/hotels', label: t('footer.accommodationProviders') },
      ],
    },
  ]

  return (
    <footer className="footer">
      <div className="footer-container">
        {/* Brand + language/currency */}
        <div className="footer-topline">
          <div className="footer-brand-block">
            <FooterLink to="/" className="footer-brand">
              <img
                className="footer-brand-mark"
                src={FOOTER_MARK_SRC}
                alt=""
                width={46}
                height={46}
                loading="eager"
                decoding="async"
              />
              <span className="footer-brand-name">
                travio<small>GHANA</small>
              </span>
            </FooterLink>
            <p className="footer-brand-copy">{t('footer.tagline')}</p>
          </div>

          <div className="footer-controls">
            <div className="footer-control">
              <span className="footer-control-label" id="footer-language-label">
                {t('footer.language')}
              </span>
              <div className="footer-select">
                <button
                  type="button"
                  className="footer-select-trigger"
                  onClick={() => setModalTab('language')}
                  aria-haspopup="dialog"
                  aria-labelledby="footer-language-label footer-language-value"
                >
                  <span className="footer-select-value" id="footer-language-value">
                    {currentLang ? `${currentLang.flag} ${currentLang.label}` : ''}
                  </span>
                  <ChevronDown className="footer-select-chevron" size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="footer-control">
              <span className="footer-control-label" id="footer-currency-label">
                {t('footer.currency')}
              </span>
              <div className="footer-select">
                <button
                  type="button"
                  className="footer-select-trigger"
                  onClick={() => setModalTab('currency')}
                  aria-haspopup="dialog"
                  aria-labelledby="footer-currency-label footer-currency-value"
                >
                  <span className="footer-select-value" id="footer-currency-value">
                    {currentCurrency
                      ? `${currency.code} · ${currentCurrency.label} (${currency.symbol})`
                      : currency.code}
                  </span>
                  <ChevronDown className="footer-select-chevron" size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation — accordion rows on phones, always-open columns above */}
        <div className="footer-nav">
          {navGroups.map((group) => (
            <FooterNavGroup
              key={group.key}
              id={`footer-nav-${group.key}`}
              title={group.title}
              links={group.links}
              isMobile={isMobile}
            />
          ))}
        </div>

        {/* Payments + socials */}
        <div className="footer-meta">
          <div>
            <span className="footer-meta-title">{t('footer.waysToPay')}</span>
            <div className="footer-payments">
              {PAYMENTS.map((payment) => (
                <span className={`footer-pay footer-pay--${payment.key}`} key={payment.key}>
                  <img src={payment.src} alt={payment.alt} loading="lazy" decoding="async" />
                </span>
              ))}
            </div>
          </div>
          <div>
            <span className="footer-meta-title">{t('footer.followJourney')}</span>
            <div className="footer-socials">
              {SOCIALS.map((social) => (
                <a
                  key={social.key}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-social"
                  aria-label={social.label}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d={social.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom band: oversized faded wordmark + legal line */}
      <div className="footer-bottom">
        <div className="footer-watermark" aria-hidden="true">
          travio ghana
        </div>
        <div className="footer-container footer-bottom-inner">
          <p className="footer-copyright">
            © {year} <strong>Travio Ghana</strong> {t('footer.copyrightBy')}
          </p>
          <nav className="footer-legal-links" aria-label={t('footer.legalNav')}>
            <FooterLink to="/terms-and-conditions" className="footer-legal-link">
              {t('footer.termsConditions')}
            </FooterLink>
            <FooterLink to="/privacy-policy" className="footer-legal-link">
              {t('footer.privacyPolicy')}
            </FooterLink>
            <FooterLink to="/refund-policy" className="footer-legal-link">
              {t('footer.refundPolicy')}
            </FooterLink>
            <FooterLink to="/cookies-policy" className="footer-legal-link">
              {t('footer.cookiesPolicy')}
            </FooterLink>
            {/* Reopens the consent panel. The Cookie Policy commits to this
                being available from the footer at any time. */}
            <button
              type="button"
              className="footer-legal-link footer-legal-button"
              onClick={openPreferences}
            >
              {t('footer.cookieSettings')}
            </button>
          </nav>
        </div>
      </div>

      <AnimatePresence>
        {modalTab && (
          <LanguageCurrencyModal initialTab={modalTab} onClose={() => setModalTab(null)} />
        )}
      </AnimatePresence>
    </footer>
  )
}
