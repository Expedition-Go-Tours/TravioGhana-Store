/**
 * Google Analytics 4 (gtag.js) — consent-gated loader.
 *
 * GA is a third-party vendor: it writes first-party cookies on our domain
 * (`_ga`, `_ga_<measurement ID>`) and calls `googletagmanager.com` and
 * `google-analytics.com`. The published Cookie Policy promises that nothing
 * optional is placed on a visitor's device before they consent, so the tag is
 * deliberately NOT in `index.html`. It is injected here only while `analytics`
 * consent is granted, and withdrawn — collection disabled and the cookies it
 * set removed — the moment the visitor changes their mind.
 *
 * GA4 does not watch the History API, so each client-side route change has to
 * report its own `page_view` through `trackGaPageView()`.
 *
 * Nothing here touches the DOM at import time; `initGoogleAnalytics()` is the
 * single entry point and is safe to call during SSR/prerender.
 */

import { hasConsent, subscribeConsent } from './cookieConsent'

export const GA_MEASUREMENT_ID = 'G-JMH0ZKFYB8'

/**
 * Google's own kill switch: while this global is true the library discards every
 * hit, even if it has already booted. It is the only reliable way to stop GA
 * after the fact, because there is no "unload".
 */
const DISABLE_FLAG = `ga-disable-${GA_MEASUREMENT_ID}`

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

let injected = false

function setDisableFlag(value: boolean): void {
  ;(window as unknown as Record<string, boolean>)[DISABLE_FLAG] = value
}

/** Load gtag.js and start collecting. No-op unless analytics consent exists. */
function inject(): void {
  if (injected || typeof window === 'undefined' || typeof document === 'undefined') return
  if (!hasConsent('analytics')) return
  injected = true

  setDisableFlag(false)

  window.dataLayer = window.dataLayer || []
  const gtag = (...args: unknown[]) => {
    window.dataLayer!.push(args)
  }
  window.gtag = gtag

  // Consent Mode: deny first, then grant storage now that the visitor agreed.
  // The tag only loads after consent, so this is belt-and-braces — it also keeps
  // Google's own storage controls explicit and correct if the tag is ever
  // started another way.
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  })
  gtag('consent', 'update', { analytics_storage: 'granted' })
  gtag('js', new Date())
  // Page views are reported manually (see trackGaPageView) so the SPA never
  // double-counts the first screen or misses a route change.
  gtag('config', GA_MEASUREMENT_ID, { send_page_view: false })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
  script.dataset.gaLoader = 'true'
  document.head.appendChild(script)
}

/** Stop collecting and remove what GA stored. Safe to call at any time. */
function withdraw(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  setDisableFlag(true)
  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', { analytics_storage: 'denied' })
  }
  removeCookies()
  // Drop the injected loader so a later re-grant starts from a clean slate.
  document.querySelectorAll('script[data-ga-loader]').forEach((node) => node.remove())
  injected = false
}

/**
 * Delete the `_ga` family. They are first-party, so they must be cleared on
 * our own domain; a bare `Max-Age=0` with no Domain only reaches the exact host
 * that set them, so the parent domain is attempted too.
 */
function removeCookies(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const host = window.location.hostname
  const domains = new Set<string>(['', host, `.${host}`])
  const labels = host.split('.')
  if (labels.length > 2) domains.add(`.${labels.slice(-2).join('.')}`)

  const names = document.cookie
    .split(';')
    .map((part) => part.split('=')[0]?.trim() ?? '')
    .filter((name) => name === '_ga' || name.startsWith('_ga_'))

  for (const name of names) {
    for (const domain of domains) {
      const scope = domain ? `; Domain=${domain}` : ''
      document.cookie = `${name}=; Max-Age=0; Path=/${scope}`
    }
  }
}

/**
 * Keep GA in step with the visitor's choice. Call once, at app start.
 * Returns an unsubscribe function (used by tests to detach the listener).
 */
export function initGoogleAnalytics(): () => void {
  if (typeof window === 'undefined') return () => {}
  const sync = () => {
    if (hasConsent('analytics')) inject()
    else withdraw()
  }
  sync()
  return subscribeConsent(sync)
}

/** Report one client-side navigation. No-op without consent or before load. */
export function trackGaPageView(path: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (!hasConsent('analytics') || typeof window.gtag !== 'function') return
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  })
}
