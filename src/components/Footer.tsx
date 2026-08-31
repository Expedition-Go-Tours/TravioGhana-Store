import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import i18n from '../i18n/config'
import { useCurrency, availableCurrencies } from '../contexts/CurrencyContext'
import { useAuthUser } from '../hooks/useAuthUser'
import { useSupplierStatus } from '../hooks/useSupplierStatus'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
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

interface FooterAccordionProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  /** When false the section is always expanded (desktop and mobile) and the
      header is non-interactive. Collapsible sections only toggle on mobile. */
  collapsible?: boolean
}

function FooterAccordion({ title, children, defaultOpen = false, collapsible = true }: FooterAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Only collapsible sections on mobile actually collapse; everything else is
  // always expanded (desktop footer sections are static, non-interactive).
  const canCollapse = collapsible && isMobile
  const expanded = canCollapse ? isOpen : true

  return (
    <div className="footer-accordion">
      <button
        className={`footer-accordion-header${expanded ? ' open' : ''}`}
        onClick={() => { if (canCollapse) setIsOpen(!isOpen) }}
        aria-expanded={expanded}
        disabled={!canCollapse}
      >
        <span className="footer-accordion-title">{title}</span>
        {collapsible && (
          <motion.svg
            className="footer-accordion-chevron"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <polyline points="6 9 12 15 18 9" />
          </motion.svg>
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            className="footer-accordion-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="footer-accordion-inner">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface FooterSelectorOption {
  value: string
  label: ReactNode
}

function FooterSelector({ value, onValueChange, options, ariaLabel }: {
  value: string
  onValueChange: (value: string) => void
  options: FooterSelectorOption[]
  ariaLabel: string
}) {
  const current = options.find((o) => o.value === value) ?? options[0]

  return (
    <div className="footer-selector">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="footer-selector-trigger group" aria-label={ariaLabel}>
            <span className="footer-selector-trigger-value">{current?.label}</span>
            <ChevronDown
              className="footer-selector-chevron transition-transform duration-300 group-data-[state=open]:rotate-180"
              size={14}
              strokeWidth={2}
              aria-hidden="true"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="footer-selector-content w-[var(--radix-dropdown-menu-trigger-width)] max-h-72 overflow-y-auto bg-white border-slate-200"
        >
          <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
            {options.map((o) => (
              <DropdownMenuRadioItem key={o.value} value={o.value} className="py-2">
                <span className="flex-1 truncate">{o.label}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default function Footer() {
  const { t, i18n: activeI18n } = useTranslation()
  const { currency, setCurrency } = useCurrency()
  const user = useAuthUser()
  const { isApproved } = useSupplierStatus()
  const langCode = (activeI18n.resolvedLanguage ?? activeI18n.language ?? 'en')
    .substring(0, 2)
    .toLowerCase()
  // Signed-in users go to the application page (which redirects approved
  // suppliers to the Travio Ghana-Supplier platform); signed-out visitors see
  // the public "become a supplier" landing page first.
  const supplierStartPath = user ? '/supplier/register' : '/supplier/list-experience'

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-grid">

          {/* Col 1: Language & Currency */}
          <div className="footer-col">
            <FooterAccordion title={t('footer.language')} collapsible={false}>
              <FooterSelector
                key={`lang-${langCode}`}
                value={langCode}
                onValueChange={(code) => i18n.changeLanguage(code)}
                ariaLabel={t('footer.language')}
                options={LANGUAGES.map((lang) => ({ value: lang.code, label: `${lang.flag} ${lang.label}` }))}
              />
            </FooterAccordion>
            <FooterAccordion title={t('footer.currency')} collapsible={false}>
              <FooterSelector
                value={currency.code}
                onValueChange={setCurrency}
                ariaLabel={t('footer.currency')}
                options={availableCurrencies.map((c) => ({ value: c.code, label: `${c.code} – ${c.label} (${c.symbol})` }))}
              />
            </FooterAccordion>
          </div>

          {/* Col 2: Ways You Can Pay */}
          <div className="footer-col">
            <FooterAccordion title={t('footer.waysToPay')} collapsible={false}>
              <div className="footer-payments-grid">
                <div className="footer-payment-icon">
                  <img src={mastercardSrc} alt="Mastercard" loading="lazy" className="footer-payment-icon-img--master" />
                </div>
                <div className="footer-payment-icon">
                  <img src={googlePaySrc} alt="Google Pay" loading="lazy" className="footer-payment-icon-img--gpay" />
                </div>
                <div className="footer-payment-icon">
                  <img src={applePaySrc} alt="Apple Pay" loading="lazy" className="footer-payment-icon-img--apple" />
                </div>
                <div className="footer-payment-icon">
                  <img src={paypalSrc} alt="PayPal" loading="lazy" />
                </div>
                <div className="footer-payment-icon">
                  <img src={visaSrc} alt="Visa" loading="lazy" className="footer-payment-icon-img--visa" />
                </div>
                <div className="footer-payment-icon">
                  <img src={americanexpressSrc} alt="American Express" loading="lazy" className="footer-payment-icon-img--amex" />
                </div>
              </div>
            </FooterAccordion>
          </div>

          {/* Col 3: Support */}
          <div className="footer-col">
            <FooterAccordion title={t('footer.support')}>
              <div className="footer-links">
                <a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>{t('footer.helpCentre')}</a>
                <a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>{t('footer.contactUs')}</a>
                <a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>{t('footer.refundPolicy')}</a>
                <a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>{t('footer.faq')}</a>
              </div>
            </FooterAccordion>
          </div>

          {/* Col 5: Company */}
          <div className="footer-col">
            <FooterAccordion title={t('footer.company')}>
              <div className="footer-links">
                <a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>{t('footer.aboutUs')}</a>
                <a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>{t('footer.careers')}</a>
                <a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>{t('footer.partnerships')}</a>
                <a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>{t('footer.termsConditions')}</a>
                <a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>{t('footer.privacyPolicy')}</a>
                <a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>{t('footer.cookiesPolicy')}</a>
              </div>
            </FooterAccordion>
          </div>

          {/* Col 6: Supplier Zone */}
          <div className="footer-col">
            <FooterAccordion title={t('footer.supplierZone')}>
              <div className="footer-links">
                {isApproved ? (
                  <a href="/supplier/register" className="footer-link">{t('footer.supplierDashboard')}</a>
                ) : (
                  <>
                    <a href={supplierStartPath} className="footer-link">{t('footer.listYourTours')}</a>
                    <a href="/supplier/register" className="footer-link">{t('footer.supplierDashboard')}</a>
                    <a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>{t('footer.supplierTerms')}</a>
                  </>
                )}
              </div>
            </FooterAccordion>
          </div>

          {/* Col 7: Explore */}
          <div className="footer-col">
            <FooterAccordion title={t('footer.explore')}>
              <div className="footer-links">
                <a href="/" className="footer-link">{t('footer.home')}</a>
                <a href="/tours" className="footer-link">{t('footer.tours')}</a>
              </div>
            </FooterAccordion>
          </div>

        </div>

        <div className="footer-divider" />

        <div className="footer-bottom">
          <div className="footer-bottom-left">
            <p className="footer-copyright">{t('footer.copyright')}</p>
            <div className="footer-socials">
              <a href="https://www.instagram.com/travioGhanatours" target="_blank" rel="noopener noreferrer" className="footer-social footer-social--instagram" aria-label="Instagram">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069M12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
              <a href="https://www.facebook.com/p/Travio Ghana-Tours-LTD-61567042001418/" target="_blank" rel="noopener noreferrer" className="footer-social footer-social--facebook" aria-label="Facebook">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
              <a href="https://www.tiktok.com/@travioGhanatours" target="_blank" rel="noopener noreferrer" className="footer-social footer-social--tiktok" aria-label="TikTok">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
              </a>
              <a href="https://www.youtube.com/c/travioGhanaTravelandToursLTD" target="_blank" rel="noopener noreferrer" className="footer-social footer-social--youtube" aria-label="YouTube">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </a>
            </div>
          </div>
          <div className="footer-bottom-links">
            <a href="#" className="footer-bottom-link" onClick={(e) => e.preventDefault()}>{t('footer.termsConditions')}</a>
            <span className="footer-bottom-divider" aria-hidden="true" />
            <a href="#" className="footer-bottom-link" onClick={(e) => e.preventDefault()}>{t('footer.privacyPolicy')}</a>
            <span className="footer-bottom-divider" aria-hidden="true" />
            <a href="#" className="footer-bottom-link" onClick={(e) => e.preventDefault()}>{t('footer.refundPolicy')}</a>
            <span className="footer-bottom-divider" aria-hidden="true" />
            <a href="#" className="footer-bottom-link" onClick={(e) => e.preventDefault()}>{t('footer.cookiesPolicy')}</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
