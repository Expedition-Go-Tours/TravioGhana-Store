/**
 * Cookie consent — the single source of truth for what a visitor has agreed to.
 *
 * The record is stored twice on purpose:
 *  - a first-party cookie (`eg_consent`), so the choice survives localStorage
 *    being cleared and is readable by edge/server code (middleware, prerender)
 *    before any third-party tag could load; and
 *  - a localStorage mirror, so reads never depend on cookie parsing succeeding.
 *
 * Consent is versioned. Bumping CONSENT_VERSION invalidates every stored record
 * (see isRecordValid), which is what re-prompts everyone after a material change
 * to the policy — a stale record is treated as "no consent yet" rather than
 * silently carried forward.
 *
 * Nothing here touches the DOM at import time; every function is safe to call
 * during SSR/prerender and returns conservative defaults when `window` is
 * unavailable.
 */

export type ConsentCategory = 'necessary' | 'functional' | 'analytics' | 'marketing'

/** Every category we expose, in display order. */
export const CONSENT_CATEGORIES: readonly ConsentCategory[] = [
  'necessary',
  'functional',
  'analytics',
  'marketing',
]

/** Categories a visitor can actually switch. Necessary is always on. */
export const OPTIONAL_CATEGORIES: readonly ConsentCategory[] = [
  'functional',
  'analytics',
  'marketing',
]

export type ConsentSource = 'accept-all' | 'reject-non-essential' | 'preferences'

/** What each category is set to. `necessary` is not optional. */
export interface ConsentState {
  necessary: true
  functional: boolean
  analytics: boolean
  marketing: boolean
}

/** A stored choice: the state plus how and when it was made. */
export interface ConsentRecord extends ConsentState {
  version: number
  updatedAt: number
  source: ConsentSource
}

/**
 * Bump when the cookie policy materially changes (new categories, new vendors,
 * a different lawful basis). Everyone is asked again.
 */
export const CONSENT_VERSION = 1

export const CONSENT_COOKIE = 'eg_consent'
export const CONSENT_STORAGE_KEY = 'eg_cookie_consent'

/** How long a choice is remembered before we ask again. 180 days is the norm. */
export const CONSENT_MAX_AGE_DAYS = 180
const CONSENT_MAX_AGE_SECONDS = CONSENT_MAX_AGE_DAYS * 24 * 60 * 60

/** Fired on every change so live consumers (analytics, storage) can react. */
export const CONSENT_CHANGED_EVENT = 'eg:consent-changed'

/** The all-off state a visitor has before choosing anything. */
export const DENIED_STATE: ConsentState = Object.freeze({
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
})

/** Everything on. */
export const GRANTED_STATE: ConsentState = Object.freeze({
  necessary: true,
  functional: true,
  analytics: true,
  marketing: true,
})

function hasWindow(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function toState(value: Partial<Record<ConsentCategory, boolean>> | null | undefined): ConsentState {
  return {
    necessary: true,
    functional: value?.functional === true,
    analytics: value?.analytics === true,
    marketing: value?.marketing === true,
  }
}

/**
 * A record only counts if it was made against the current version. Anything
 * older is deliberately treated as absent so the banner reappears.
 */
function isRecordValid(record: ConsentRecord | null): record is ConsentRecord {
  return !!record && record.version === CONSENT_VERSION
}

function parseRecord(raw: string | null): ConsentRecord | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>
    if (!parsed || typeof parsed !== 'object') return null
    const version = Number(parsed.version)
    if (!Number.isFinite(version)) return null
    const updatedAt = Number(parsed.updatedAt)
    return {
      necessary: true,
      functional: parsed.functional === true,
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
      version,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
      source: (parsed.source as ConsentSource) || 'preferences',
    }
  } catch {
    return null
  }
}

function readCookie(name: string): string | null {
  if (!hasWindow()) return null
  try {
    const prefix = `${name}=`
    const parts = document.cookie ? document.cookie.split('; ') : []
    for (const part of parts) {
      if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length))
    }
  } catch {
    /* cookie access can throw in sandboxed frames */
  }
  return null
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (!hasWindow()) return
  try {
    const secure = window.location?.protocol === 'https:' ? '; Secure' : ''
    document.cookie =
      `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`
  } catch {
    /* ignore — the localStorage mirror still carries the choice */
  }
}

function deleteCookie(name: string): void {
  if (!hasWindow()) return
  try {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`
  } catch {
    /* ignore */
  }
}

function readMirror(): ConsentRecord | null {
  if (!hasWindow()) return null
  try {
    return parseRecord(window.localStorage.getItem(CONSENT_STORAGE_KEY))
  } catch {
    return null
  }
}

function writeMirror(record: ConsentRecord): void {
  if (!hasWindow()) return
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record))
  } catch {
    /* quota or private mode — the cookie is the durable copy */
  }
}

function clearMirror(): void {
  if (!hasWindow()) return
  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * The stored choice, or null when there isn't one.
 *
 * The cookie wins when the two copies disagree: it is the copy a server or edge
 * function can also see, and it survives localStorage being cleared. A record
 * from an older CONSENT_VERSION is still returned here (so callers can tell the
 * visitor previously chose) — use getConsentState/hasConsent for the effective
 * answer, which treats it as absent.
 */
export function readConsent(): ConsentRecord | null {
  return parseRecord(readCookie(CONSENT_COOKIE)) ?? readMirror()
}

/** The effective state. Anything without a current-version record is all-off. */
export function getConsentState(): ConsentState {
  const record = readConsent()
  return isRecordValid(record) ? toState(record) : { ...DENIED_STATE }
}

/** Does the visitor currently allow this category? */
export function hasConsent(category: ConsentCategory): boolean {
  if (category === 'necessary') return true
  return getConsentState()[category] === true
}

/** True when we still owe the visitor a choice (first visit, or after a bump). */
export function shouldShowBanner(): boolean {
  return !isRecordValid(readConsent())
}

/** True when a choice has been made against the current version. */
export function hasChosen(): boolean {
  return isRecordValid(readConsent())
}

function emit(record: ConsentRecord | null): void {
  if (!hasWindow()) return
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: record }))
  } catch {
    /* CustomEvent unavailable — subscribers simply don't hear about it */
  }
}

/**
 * Persist a choice and notify listeners. Returns the stored record.
 * `state` is merged over the always-on necessary category.
 */
export function writeConsent(
  state: Partial<Record<ConsentCategory, boolean>>,
  source: ConsentSource,
): ConsentRecord {
  const record: ConsentRecord = {
    ...toState(state),
    version: CONSENT_VERSION,
    updatedAt: Date.now(),
    source,
  }
  const payload = JSON.stringify(record)
  writeCookie(CONSENT_COOKIE, payload, CONSENT_MAX_AGE_SECONDS)
  writeMirror(record)
  emit(record)
  return record
}

/** Forget the choice entirely — the banner will show again on next load. */
export function clearConsent(): void {
  deleteCookie(CONSENT_COOKIE)
  clearMirror()
  emit(null)
}

/**
 * Subscribe to consent changes, including ones made in another tab (which
 * arrive as a storage event). Returns an unsubscribe function.
 */
export function subscribeConsent(
  callback: (record: ConsentRecord | null) => void,
): () => void {
  if (!hasWindow()) return () => {}

  const onCustom = (event: Event) => {
    callback((event as CustomEvent<ConsentRecord | null>).detail ?? readConsent())
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === CONSENT_STORAGE_KEY) callback(readConsent())
  }

  window.addEventListener(CONSENT_CHANGED_EVENT, onCustom)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CONSENT_CHANGED_EVENT, onCustom)
    window.removeEventListener('storage', onStorage)
  }
}

/** Human-readable label keys live in the locale files under `cookies.categories`. */
export function isOptionalCategory(category: ConsentCategory): boolean {
  return category !== 'necessary'
}
