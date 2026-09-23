import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useCookieConsent } from '../../context/CookieConsentContext'
import {
  CONSENT_CATEGORIES,
  OPTIONAL_CATEGORIES,
  type ConsentCategory,
  type ConsentState,
} from '../../lib/cookieConsent'
import { inventoryFor, type CookieEntry } from '../../lib/cookieInventory'
import './cookieConsent.css'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

interface PanelProps {
  consent: ConsentState
  onClose: () => void
  onSave: (state: Record<ConsentCategory, boolean>) => void
  onAcceptAll: () => void
  onRejectNonEssential: () => void
}

/**
 * Second-layer preferences panel.
 *
 * Lists every category with a switch, and under each one the actual cookies,
 * storage keys and third-party requests that category covers — the published
 * policy promises visitors this level of detail ("name, provider, purpose,
 * category and duration").
 *
 * Mounted only while open, so the draft is seeded fresh from the stored choice
 * every time. That is what makes "close without saving" genuinely discard edits
 * — no effect has to reset state, and an edit can never leak into a later visit.
 */
function PreferencesPanel({ consent, onClose, onSave, onAcceptAll, onRejectNonEssential }: PanelProps) {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<Record<ConsentCategory, boolean>>(() => ({
    necessary: true,
    functional: consent.functional,
    analytics: consent.analytics,
    marketing: consent.marketing,
  }))

  const toggle = useCallback((category: ConsentCategory) => {
    if (category === 'necessary') return
    setDraft((prev) => ({ ...prev, [category]: !prev[category] }))
  }, [])

  // Keyboard support: Escape closes, Tab is trapped inside the dialog.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.offsetParent !== null,
      )
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const id = window.setTimeout(() => panelRef.current?.focus(), 40)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.clearTimeout(id)
    }
  }, [onClose])

  const byCategory = useMemo(() => {
    const map = {} as Record<ConsentCategory, CookieEntry[]>
    for (const category of CONSENT_CATEGORIES) map[category] = inventoryFor(category)
    return map
  }, [])

  return (
    <div
      className="cookie-prefs__backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div
        className="cookie-prefs"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-prefs-title"
      >
        <div className="cookie-prefs__header">
          <h2 className="cookie-prefs__title" id="cookie-prefs-title">
            {t('cookies.preferences.title', { defaultValue: 'Cookie preferences' })}
          </h2>
          <p className="cookie-prefs__intro">
            {t('cookies.preferences.intro', {
              defaultValue:
                'Choose which optional cookies we may use. Strictly necessary cookies are always on because the site cannot work without them. You can change this at any time from “Cookie Settings” in the footer.',
            })}{' '}
            <Link className="cookie-banner__policy" to="/cookies-policy" onClick={onClose}>
              {t('cookies.banner.policyLink', { defaultValue: 'Cookie Policy' })}
            </Link>
          </p>
        </div>

        <div className="cookie-prefs__body">
          {CONSENT_CATEGORIES.map((category) => {
            const optional = OPTIONAL_CATEGORIES.includes(category)
            const entries = byCategory[category]
            return (
              <section className="cookie-category" key={category}>
                <div className="cookie-category__head">
                  <div>
                    <h3 className="cookie-category__name">
                      {t(`cookies.categories.${category}.title`, {
                        defaultValue:
                          category === 'necessary'
                            ? 'Strictly necessary'
                            : category === 'functional'
                              ? 'Functional and personalisation'
                              : category === 'analytics'
                                ? 'Analytics and performance'
                                : 'Advertising and marketing',
                      })}
                    </h3>
                    <p className="cookie-category__desc">
                      {t(`cookies.categories.${category}.description`, {
                        defaultValue:
                          category === 'necessary'
                            ? 'Required for security, sign-in, bookings, payments and remembering your cookie choices. These cannot be switched off.'
                            : category === 'functional'
                              ? 'Remember optional choices such as your wishlist, recent searches and approximate location so features work the way you expect.'
                              : category === 'analytics'
                                ? 'Help us understand which pages, searches and experiences are useful so we can improve them.'
                                : 'Used to measure and target advertising. None are currently in use.',
                      })}
                    </p>
                  </div>
                  {optional ? (
                    <button
                      type="button"
                      className="cookie-switch"
                      role="switch"
                      aria-checked={draft[category]}
                      aria-label={t(`cookies.categories.${category}.title`, { defaultValue: category })}
                      onClick={() => toggle(category)}
                    >
                      <span className="cookie-switch__dot" />
                    </button>
                  ) : (
                    <span className="cookie-category__always">
                      {t('cookies.preferences.alwaysOn', { defaultValue: 'Always on' })}
                    </span>
                  )}
                </div>

                {entries.length > 0 ? (
                  <table className="cookie-table">
                    <thead>
                      <tr>
                        <th>{t('cookies.inventory.name', { defaultValue: 'Name' })}</th>
                        <th>{t('cookies.inventory.type', { defaultValue: 'Type' })}</th>
                        <th>{t('cookies.inventory.provider', { defaultValue: 'Provider' })}</th>
                        <th>{t('cookies.inventory.purpose', { defaultValue: 'Purpose' })}</th>
                        <th>{t('cookies.inventory.duration', { defaultValue: 'Duration' })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr key={`${category}-${entry.name}`}>
                          <td>{entry.name}</td>
                          <td className="cookie-table__type">
                            {t(`cookies.inventory.types.${entry.kind}`, { defaultValue: entry.kind })}
                          </td>
                          <td>{entry.provider}</td>
                          <td>
                            {t(`cookies.inventory.purposes.${entry.purposeKey}`, {
                              defaultValue: entry.purposeKey,
                            })}
                          </td>
                          <td>
                            {t(`cookies.inventory.durations.${entry.durationKey}`, {
                              defaultValue: entry.durationKey,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="cookie-table__empty">
                    {t('cookies.preferences.noneInUse', {
                      defaultValue: 'No cookies in this category are currently in use.',
                    })}
                  </p>
                )}
              </section>
            )
          })}
        </div>

        <div className="cookie-prefs__footer">
          <button type="button" className="bk-btn bk-btn-ghost" onClick={onRejectNonEssential}>
            {t('cookies.banner.rejectNonEssential', { defaultValue: 'Reject non-essential' })}
          </button>
          <button type="button" className="bk-btn bk-btn-secondary" onClick={onAcceptAll}>
            {t('cookies.banner.acceptAll', { defaultValue: 'Accept all' })}
          </button>
          <button type="button" className="bk-btn bk-btn-primary" onClick={() => onSave(draft)}>
            {t('cookies.preferences.save', { defaultValue: 'Save preferences' })}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CookiePreferences() {
  const { consent, isPreferencesOpen, closePreferences, savePreferences, acceptAll, rejectNonEssential } =
    useCookieConsent()

  if (!isPreferencesOpen) return null

  return (
    <PreferencesPanel
      consent={consent}
      onClose={closePreferences}
      onSave={savePreferences}
      onAcceptAll={acceptAll}
      onRejectNonEssential={rejectNonEssential}
    />
  )
}
