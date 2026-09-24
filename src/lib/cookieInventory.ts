/**
 * What actually gets stored on a visitor's device, and why.
 *
 * This is the single source for the Cookie Settings panel's inventory table —
 * the Cookie Policy promises visitors that panel will show "the current cookie
 * name, provider, purpose, category and duration". Keeping it in code (rather
 * than hand-written in the policy page) means the two cannot drift apart.
 *
 * Rules for editing:
 *  - Only list something here once it genuinely runs in production. Listing a
 *    vendor we don't use is as misleading as omitting one we do.
 *  - `purposeKey` / `durationKey` are i18n keys under `cookies.inventory.*`,
 *    so every entry is translated in all supported locales.
 *  - `necessary` entries are always active and are not switchable.
 */

import type { ConsentCategory } from './cookieConsent'

export type CookieKind = 'cookie' | 'storage' | 'network'

export interface CookieEntry {
  /** Cookie name, storage key, or the technology's name for network requests. */
  name: string
  /** Who sets it. Ours is "Travio Ghana". */
  provider: string
  /** i18n key describing what it does, under `cookies.inventory.purposes`. */
  purposeKey: string
  category: ConsentCategory
  /** i18n key under `cookies.inventory.durations`. */
  durationKey: string
  /**
   * What it actually is, surfaced as a "Type" column so the table never implies
   * we store something we only request: a first-party cookie, a storage key, or
   * a third-party network request (maps, our own analytics batch).
   */
  kind: CookieKind
}

const US = 'Travio Ghana'

export const COOKIE_INVENTORY: readonly CookieEntry[] = [
  // ── Strictly necessary ────────────────────────────────────────────────
  // Required to deliver a service the visitor asked for, or to comply with the
  // law. Not switchable — see CookiesPolicyPage §3.1.
  {
    name: 'eg_consent',
    provider: US,
    purposeKey: 'consentRecord',
    category: 'necessary',
    durationKey: 'days180',
    kind: 'cookie',
  },
  {
    name: 'accessToken',
    provider: US,
    purposeKey: 'sessionSecurity',
    category: 'necessary',
    durationKey: 'hour1',
    kind: 'cookie',
  },
  {
    name: 'refreshToken',
    provider: US,
    purposeKey: 'sessionRenewal',
    category: 'necessary',
    durationKey: 'days7',
    kind: 'cookie',
  },
  {
    name: 'expedition_go_auth',
    provider: US,
    purposeKey: 'signedInAccount',
    category: 'necessary',
    durationKey: 'untilSignOut',
    kind: 'storage',
  },
  {
    name: 'eg_auth_return_to',
    provider: US,
    purposeKey: 'authReturnTo',
    category: 'necessary',
    durationKey: 'session',
    kind: 'storage',
  },
  {
    name: 'booking_draft',
    provider: US,
    purposeKey: 'bookingDraft',
    category: 'necessary',
    durationKey: 'untilBookingCompletes',
    kind: 'storage',
  },
  {
    name: 'expedition.chunkReloaded',
    provider: US,
    purposeKey: 'updateReload',
    category: 'necessary',
    durationKey: 'session',
    kind: 'storage',
  },
  {
    name: 'navBookingsSeen',
    provider: US,
    purposeKey: 'bookingsSeen',
    category: 'necessary',
    durationKey: 'persistent',
    kind: 'storage',
  },
  // Language and currency are listed as strictly necessary in the published
  // policy ("remember language, currency or accessibility choices where
  // necessary for a requested service"): the visitor picks them, and the
  // request cannot be served correctly without them.
  {
    name: 'i18nextLng',
    provider: US,
    purposeKey: 'languageChoice',
    category: 'necessary',
    durationKey: 'persistent',
    kind: 'storage',
  },
  {
    name: 'eg_currency',
    provider: US,
    purposeKey: 'currencyChoice',
    category: 'necessary',
    durationKey: 'persistent',
    kind: 'storage',
  },
  {
    name: 'eg_currency_rates',
    provider: US,
    purposeKey: 'currencyRates',
    category: 'necessary',
    durationKey: 'hours12',
    kind: 'storage',
  },
  // Stripe.js sets these itself, first-party on our domain, but only when the
  // card step loads (`lib/stripe.ts` is called from CardField / CheckoutElements,
  // never at boot). Strictly necessary for the payment the customer is making.
  {
    name: '__stripe_mid',
    provider: 'Stripe',
    purposeKey: 'stripeFraud',
    category: 'necessary',
    durationKey: 'days365',
    kind: 'cookie',
  },
  {
    name: '__stripe_sid',
    provider: 'Stripe',
    purposeKey: 'stripeSession',
    category: 'necessary',
    durationKey: 'minutes30',
    kind: 'cookie',
  },

  // ── Functional and personalisation ────────────────────────────────────
  // Optional convenience features — see CookiesPolicyPage §3.2.
  {
    name: 'expedition_go_location_search',
    provider: US,
    purposeKey: 'locationHistory',
    category: 'functional',
    durationKey: 'entries2',
    kind: 'storage',
  },
  {
    name: 'recent-searches',
    provider: US,
    purposeKey: 'recentSearches',
    category: 'functional',
    durationKey: 'entries5',
    kind: 'storage',
  },
  {
    name: 'expedition_go_wishlist',
    provider: US,
    purposeKey: 'wishlist',
    category: 'functional',
    durationKey: 'persistent',
    kind: 'storage',
  },
  {
    name: 'expedition_go_continue_planning',
    provider: US,
    purposeKey: 'continuePlanning',
    category: 'functional',
    durationKey: 'persistent',
    kind: 'storage',
  },
  {
    name: 'eg_user_location',
    provider: US,
    purposeKey: 'approximateLocation',
    category: 'functional',
    durationKey: 'hours24',
    kind: 'storage',
  },
  {
    name: 'eg_location_sharing',
    provider: US,
    purposeKey: 'locationSharing',
    category: 'functional',
    durationKey: 'persistent',
    kind: 'storage',
  },
  {
    name: 'expedition.googleOnetap.*',
    provider: US,
    purposeKey: 'onetapDismissal',
    category: 'functional',
    durationKey: 'day1',
    kind: 'storage',
  },
  {
    name: 'OpenFreeMap / Google Maps',
    provider: 'OpenFreeMap, Google',
    purposeKey: 'maps',
    category: 'functional',
    durationKey: 'session',
    kind: 'network',
  },

  // ── Analytics and performance ─────────────────────────────────────────
  // First-party only today: events are batched to our own API and nothing is
  // stored on the device, so this is a network request rather than a cookie —
  // which is what the Type column shows. No third-party analytics vendor is
  // configured — see CookiesPolicyPage §3.3.
  {
    name: 'Analytics events',
    provider: US,
    purposeKey: 'analyticsEvents',
    category: 'analytics',
    durationKey: 'session',
    kind: 'network',
  },

  // ── Advertising and marketing ─────────────────────────────────────────
  // Nothing is configured. When a vendor is added (Google Ads, Meta, TikTok),
  // it must be registered here AND loaded through the consent gate so it only
  // ever runs after the visitor opts in.
]

/** Entries for one category, in inventory order. */
export function inventoryFor(category: ConsentCategory): CookieEntry[] {
  return COOKIE_INVENTORY.filter((entry) => entry.category === category)
}

/**
 * Storage keys that exist purely for optional personalisation. Cleared when
 * functional consent is refused or withdrawn, so a rejection actually removes
 * what was stored rather than just stopping new writes.
 */
export const FUNCTIONAL_STORAGE_KEYS: readonly string[] = [
  'expedition_go_location_search',
  'recent-searches',
  'expedition_go_wishlist',
  'expedition_go_wishlist_pending',
  'expedition_go_continue_planning',
  'eg_user_location',
  'eg_location_sharing',
  'expedition.googleOnetap.dismissedSession',
  'expedition.googleOnetap.lastShownDay',
]
