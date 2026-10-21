/**
 * Google Analytics 4 — consent mode and SPA page views.
 *
 * The gtag.js library is loaded for every visitor from `index.html`, with Google
 * Consent Mode v2 defaulting every category to "denied": no analytics cookie is
 * set and no user-level data is collected until the visitor allows analytics
 * cookies. It cannot sit behind a pure loader for two reasons:
 *  - Google's tag setup detects the tag by fetching the page, and a fetch
 *    carries no consent choice, so a tag that only injects after opt-in is
 *    never seen;
 *  - the CSP has no 'unsafe-inline', so the bootstrap cannot be an inline
 *    script in `index.html` either.
 *
 * So the library and the measurement ID are static, and this module owns the
 * behaviour. gtag's queueing stub is reproduced here so consent and config
 * calls are never lost while the async library is still arriving, then: grant
 * storage when the visitor opts in, revoke it and clear the `_ga` cookies when
 * they withdraw, and report one `page_view` per SPA navigation (GA4 does not
 * watch the History API).
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

/**
 * Hosts whose visits may reach the production GA4 property. The measurement ID
 * is a static literal in index.html (Google's tag setup must see it on a plain
 * fetch), so nothing else stops a dev server, `vite preview` or a Vercel
 * preview from filling production with junk: the property's hostname report had
 * already picked up `localhost` and `example.com`. The hostname argument is
 * optional so the allowlist itself is testable without fighting jsdom's
 * window.location; `initGoogleAnalytics` always resolves it from the page.
 */
const PRODUCTION_HOSTS = new Set(['travioghana.com', 'www.travioghana.com'])

export function isProductionHost(hostname?: string): boolean {
  const host = hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')
  return PRODUCTION_HOSTS.has(host)
}

declare global {
  interface Window {
    dataLayer?: unknown[][]
    gtag?: (...args: unknown[]) => void
  }
}

function setDisableFlag(value: boolean): void {
  ;(window as unknown as Record<string, boolean>)[DISABLE_FLAG] = value
}

/**
 * Install gtag's queueing stub. The library drains this queue once it loads, so
 * nothing issued here is lost while it is still arriving.
 *
 * The one subtlety is the shape of each entry. gtag.js reads a queue entry as a
 * command tuple and expects an *`arguments` object* — pushing a plain Array is
 * silently ignored, which is worse than it sounds: consent never registers
 * (`google_tag_data.ics.usedDefault` stays false) and every hit is dropped, with
 * no error anywhere. Google's own snippet is `gtag(){dataLayer.push(arguments)}`,
 * so copy that shape exactly rather than "tidying" it into a rest parameter.
 */
function ensureStub(): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag(): void {
      // gtag.js dispatches only `arguments`-shaped tuples; a rest array is
      // silently ignored (see above).
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments as unknown as unknown[])
    }
  }
}

/**
 * Delete the `_ga` family. They are first-party, so they must be cleared on our
 * own domain; a bare `Max-Age=0` with no Domain only reaches the exact host
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

/** Apply the visitor's current choice to the tag. */
function apply(): void {
  ensureStub()
  const gtag = window.gtag!
  if (hasConsent('analytics')) {
    setDisableFlag(false)
    gtag('consent', 'update', { analytics_storage: 'granted' })
  } else {
    gtag('consent', 'update', { analytics_storage: 'denied' })
    setDisableFlag(true)
    removeCookies()
  }
}

/** The route the visitor is actually on, query string included. */
function currentPath(): string {
  return window.location.pathname + window.location.search
}

/**
 * Queue the Consent Mode defaults and the config, then follow the visitor's
 * choice from then on. Call once, at app start. Returns an unsubscribe
 * function (used by tests to detach the listener).
 */
export function initGoogleAnalytics(): () => void {
  if (typeof window === 'undefined') return () => {}
  // Non-production hosts (localhost, previews, sandboxes): arm Google's kill
  // switch and stop before a single consent or config call is queued. The flag
  // discards every hit the library would ever dispatch — including trackGa*
  // calls if someone opts in off-site — and it is never lifted again here,
  // because no consent subscription is installed.
  if (!isProductionHost()) {
    setDisableFlag(true)
    return () => {}
  }
  ensureStub()
  const gtag = window.gtag!
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  })
  gtag('js', new Date())
  // Page views are reported manually (see trackGaPageView) so the SPA never
  // double-counts the first screen or misses a route change.
  gtag('config', GA_MEASUREMENT_ID, { send_page_view: false })

  // Track the last applied choice so a subscription callback that changes
  // nothing (e.g. toggling marketing while analytics was already on) stays
  // silent and cannot double-count.
  let granted = hasConsent('analytics')
  apply()

  return subscribeConsent(() => {
    const next = hasConsent('analytics')
    if (next === granted) return
    granted = next
    apply()
    // Consent can be granted mid-visit. The page they made the choice on was
    // reported before consent (and dropped), so report it now — otherwise GA
    // receives a config and a consent update but no page view at all until the
    // visitor happens to navigate again. Withdrawal needs no event: apply()
    // revokes storage and clears the cookies.
    if (next) trackGaPageView(currentPath())
  })
}

/** Report one client-side navigation. No-op without consent. */
export function trackGaPageView(path: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (!hasConsent('analytics') || typeof window.gtag !== 'function') return
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  })
}

/**
 * Report a custom event. No-op without analytics consent, matching
 * trackGaPageView, so every funnel step inherits the same gate. Callers must
 * never pass PII — event names and parameter values only.
 */
export function trackGaEvent(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return
  if (!hasConsent('analytics') || typeof window.gtag !== 'function') return
  window.gtag('event', name, params)
}

/**
 * The GA4 `client_id` for this visitor, read from the first-party `_ga` cookie.
 * gtag writes it as `GA1.1.<client_id>` (the client_id is the remainder after
 * that version prefix), which is exactly what the Measurement Protocol expects
 * when the backend reports a settled booking server-side.
 *
 * Returns null when analytics consent was never granted (no cookie), when the
 * cookie is malformed, or during SSR. No PII: the value is a random identifier.
 */
export function getGaClientId(): string | null {
  if (typeof document === 'undefined') return null
  if (!hasConsent('analytics')) return null
  const match = document.cookie.match(/(?:^|;\s*)_ga=([^;]+)/)
  if (!match) return null
  // `_ga=GA1.1.1234567890.1700000000` → client_id `1234567890.1700000000`.
  const parts = decodeURIComponent(match[1]).split('.')
  if (parts.length < 4) return null
  return parts.slice(2).join('.')
}
