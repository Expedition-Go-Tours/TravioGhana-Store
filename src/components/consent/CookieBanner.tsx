import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useCookieConsent } from '../../context/CookieConsentContext'
import './cookieConsent.css'

/**
 * First-layer consent banner.
 *
 * Deliberately not a modal — it sits above the footer and leaves the site fully
 * usable, because nothing optional loads until a choice is made. The two
 * consent actions are a matched pair (same size, shape and weight, one solid
 * and one outlined) so refusing is exactly as easy as accepting, which both the
 * ICO's consent checklist and our published Cookie Policy require. The tertiary
 * "Manage preferences" action is visually separated so it never competes with
 * the decision itself.
 */
export default function CookieBanner() {
  const { t } = useTranslation()
  const { isBannerVisible, acceptAll, rejectNonEssential, openPreferences } = useCookieConsent()
  const cardRef = useRef<HTMLDivElement>(null)

  // Move focus to the banner so keyboard and screen-reader users meet it,
  // rather than discovering it later in the tab order.
  useEffect(() => {
    if (!isBannerVisible) return
    const id = window.setTimeout(() => cardRef.current?.focus(), 80)
    return () => window.clearTimeout(id)
  }, [isBannerVisible])

  if (!isBannerVisible) return null

  return (
    <div className="cookie-banner" role="presentation">
      <div
        className="cookie-banner__card"
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="false"
        aria-labelledby="cookie-banner-title"
        aria-describedby="cookie-banner-text"
      >
        <span className="cookie-banner__icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l7 3v6c0 4.4-2.9 7.9-7 9-4.1-1.1-7-4.6-7-9V6l7-3z" />
            <path d="M9.2 12.2l2 2 3.6-4" />
          </svg>
        </span>

        <div className="cookie-banner__copy">
          <h2 className="cookie-banner__title" id="cookie-banner-title">
            {t('cookies.banner.title', { defaultValue: 'Your privacy, your choice' })}
          </h2>
          <p className="cookie-banner__text" id="cookie-banner-text">
            {t('cookies.banner.text', {
              defaultValue:
                'We use strictly necessary cookies to run this site securely. With your consent we also use optional cookies to remember your preferences and understand how the site is used. You can change your choice at any time.',
            })}{' '}
            <Link className="cookie-banner__policy" to="/cookies-policy">
              {t('cookies.banner.policyLink', { defaultValue: 'Cookie Policy' })}
            </Link>
          </p>
        </div>

        <div className="cookie-banner__actions">
          <button
            type="button"
            className="bk-btn bk-btn-ghost"
            onClick={openPreferences}
          >
            {t('cookies.banner.managePreferences', { defaultValue: 'Manage preferences' })}
          </button>
          <button
            type="button"
            className="bk-btn bk-btn-secondary"
            onClick={rejectNonEssential}
          >
            {t('cookies.banner.rejectNonEssential', { defaultValue: 'Reject non-essential' })}
          </button>
          <button
            type="button"
            className="bk-btn bk-btn-primary"
            onClick={acceptAll}
          >
            {t('cookies.banner.acceptAll', { defaultValue: 'Accept all' })}
          </button>
        </div>
      </div>
    </div>
  )
}
