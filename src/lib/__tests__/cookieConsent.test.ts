import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CONSENT_CHANGED_EVENT,
  CONSENT_COOKIE,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  DENIED_STATE,
  GRANTED_STATE,
  clearConsent,
  getConsentState,
  hasChosen,
  hasConsent,
  readConsent,
  shouldShowBanner,
  subscribeConsent,
  writeConsent,
} from '../cookieConsent'

function clearAllCookies() {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim()
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`
  }
}

/** Drop a record straight into storage, bypassing writeConsent. */
function seedRecord(record: unknown) {
  const raw = JSON.stringify(record)
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(raw)}; Path=/`
  window.localStorage.setItem(CONSENT_STORAGE_KEY, raw)
}

beforeEach(() => {
  clearAllCookies()
  window.localStorage.clear()
})

describe('before any choice is made', () => {
  it('asks for consent and treats every optional category as off', () => {
    expect(shouldShowBanner()).toBe(true)
    expect(hasChosen()).toBe(false)
    expect(readConsent()).toBeNull()
    expect(getConsentState()).toEqual(DENIED_STATE)
  })

  it('still allows strictly necessary storage', () => {
    expect(hasConsent('necessary')).toBe(true)
    expect(hasConsent('functional')).toBe(false)
    expect(hasConsent('analytics')).toBe(false)
    expect(hasConsent('marketing')).toBe(false)
  })
})

describe('recording a choice', () => {
  it('stores "accept all" in both the cookie and localStorage', () => {
    const record = writeConsent(GRANTED_STATE, 'accept-all')

    expect(record.version).toBe(CONSENT_VERSION)
    expect(record.source).toBe('accept-all')
    expect(document.cookie).toContain(CONSENT_COOKIE)
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toContain('"accept-all"')
    expect(hasConsent('analytics')).toBe(true)
    expect(hasConsent('marketing')).toBe(true)
    expect(hasChosen()).toBe(true)
    expect(shouldShowBanner()).toBe(false)
  })

  it('stores "reject non-essential" as everything optional off', () => {
    writeConsent(DENIED_STATE, 'reject-non-essential')

    expect(hasConsent('necessary')).toBe(true)
    expect(hasConsent('functional')).toBe(false)
    expect(hasConsent('analytics')).toBe(false)
    expect(hasConsent('marketing')).toBe(false)
    // A rejection is still a decision — the banner must not keep reappearing.
    expect(hasChosen()).toBe(true)
    expect(shouldShowBanner()).toBe(false)
  })

  it('stores a granular choice per category', () => {
    writeConsent({ functional: true, analytics: false, marketing: false }, 'preferences')

    expect(hasConsent('functional')).toBe(true)
    expect(hasConsent('analytics')).toBe(false)
    expect(hasConsent('marketing')).toBe(false)
  })

  it('always keeps strictly necessary on, whatever is passed in', () => {
    const record = writeConsent({ necessary: false, analytics: true }, 'preferences')
    expect(record.necessary).toBe(true)
    expect(hasConsent('necessary')).toBe(true)
  })
})

describe('versioning', () => {
  it('ignores a record made against an older policy version', () => {
    seedRecord({
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true,
      version: CONSENT_VERSION - 1,
      updatedAt: Date.now(),
      source: 'accept-all',
    })

    // The old choice is remembered as history…
    expect(readConsent()?.version).toBe(CONSENT_VERSION - 1)
    // …but it carries no authority: we must ask again.
    expect(hasChosen()).toBe(false)
    expect(shouldShowBanner()).toBe(true)
    expect(getConsentState()).toEqual(DENIED_STATE)
    expect(hasConsent('analytics')).toBe(false)
  })
})

describe('resilience', () => {
  it('falls back to the localStorage mirror when the cookie is gone', () => {
    writeConsent(GRANTED_STATE, 'accept-all')
    clearAllCookies()

    expect(hasConsent('analytics')).toBe(true)
  })

  it('trusts the cookie when the two copies disagree', () => {
    writeConsent(GRANTED_STATE, 'accept-all')
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        necessary: true,
        functional: false,
        analytics: false,
        marketing: false,
        version: CONSENT_VERSION,
        updatedAt: Date.now(),
        source: 'reject-non-essential',
      }),
    )

    expect(hasConsent('analytics')).toBe(true)
  })

  it('survives a corrupt stored record', () => {
    document.cookie = `${CONSENT_COOKIE}=not-json; Path=/`
    window.localStorage.setItem(CONSENT_STORAGE_KEY, '{{{')

    expect(readConsent()).toBeNull()
    expect(shouldShowBanner()).toBe(true)
  })
})

describe('withdrawing', () => {
  it('clears the record so the banner returns', () => {
    writeConsent(GRANTED_STATE, 'accept-all')
    clearConsent()

    expect(readConsent()).toBeNull()
    expect(hasChosen()).toBe(false)
    expect(shouldShowBanner()).toBe(true)
    expect(hasConsent('analytics')).toBe(false)
  })
})

describe('subscriptions', () => {
  it('notifies listeners when a choice is made and when it is cleared', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeConsent(listener)

    writeConsent(GRANTED_STATE, 'accept-all')
    expect(listener).toHaveBeenCalledTimes(1)

    clearConsent()
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    writeConsent(DENIED_STATE, 'reject-non-essential')
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('emits a DOM event other code can listen for', () => {
    const handler = vi.fn()
    window.addEventListener(CONSENT_CHANGED_EVENT, handler)

    writeConsent(GRANTED_STATE, 'accept-all')

    expect(handler).toHaveBeenCalledTimes(1)
    window.removeEventListener(CONSENT_CHANGED_EVENT, handler)
  })
})
