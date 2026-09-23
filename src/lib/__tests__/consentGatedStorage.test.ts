import { beforeEach, describe, expect, it } from 'vitest'
import { DENIED_STATE, GRANTED_STATE, clearConsent, writeConsent } from '../cookieConsent'
import {
  flushGatedMemory,
  purgeFunctionalStorage,
  readGated,
  removeGated,
  resetPendingWrites,
  writeGated,
} from '../consentGatedStorage'
import { FUNCTIONAL_STORAGE_KEYS } from '../cookieInventory'

const KEY = 'expedition_go_wishlist'

beforeEach(() => {
  clearConsent()
  window.localStorage.clear()
  window.sessionStorage.clear()
  resetPendingWrites()
})

describe('without functional consent', () => {
  it('keeps values out of real storage', () => {
    writeGated(KEY, '["a"]')

    expect(window.localStorage.getItem(KEY)).toBeNull()
    // …but the feature still works for the rest of the session.
    expect(readGated(KEY)).toBe('["a"]')
  })

  it('does not read a copy persisted by an earlier consented visit', () => {
    window.localStorage.setItem(KEY, '["old"]')

    expect(readGated(KEY)).toBeNull()
  })
})

describe('with functional consent', () => {
  it('persists values to real storage', () => {
    writeConsent(GRANTED_STATE, 'accept-all')
    writeGated(KEY, '["a"]')

    expect(window.localStorage.getItem(KEY)).toBe('["a"]')
    expect(readGated(KEY)).toBe('["a"]')
  })

  it('removes a value from both places', () => {
    writeConsent(GRANTED_STATE, 'accept-all')
    writeGated(KEY, '["a"]')
    removeGated(KEY)

    expect(window.localStorage.getItem(KEY)).toBeNull()
    expect(readGated(KEY)).toBeNull()
  })
})

describe('granting consent later', () => {
  it('flushes what the visitor built up before answering the banner', () => {
    writeGated(KEY, '["pre-consent"]')
    expect(window.localStorage.getItem(KEY)).toBeNull()

    writeConsent(GRANTED_STATE, 'accept-all')
    flushGatedMemory()

    expect(window.localStorage.getItem(KEY)).toBe('["pre-consent"]')
  })

  it('is a no-op while consent is still missing', () => {
    writeGated(KEY, '["pre-consent"]')
    flushGatedMemory()

    expect(window.localStorage.getItem(KEY)).toBeNull()
  })
})

describe('withdrawing consent', () => {
  it('erases every known optional value', () => {
    writeConsent(GRANTED_STATE, 'accept-all')
    for (const key of FUNCTIONAL_STORAGE_KEYS) {
      window.localStorage.setItem(key, 'value')
      window.sessionStorage.setItem(key, 'value')
    }

    purgeFunctionalStorage()

    for (const key of FUNCTIONAL_STORAGE_KEYS) {
      expect(window.localStorage.getItem(key)).toBeNull()
      expect(window.sessionStorage.getItem(key)).toBeNull()
    }
  })

  it('also drops values held in memory for the session', () => {
    writeGated(KEY, '["pre-consent"]')
    purgeFunctionalStorage()

    expect(readGated(KEY)).toBeNull()
  })

  it('leaves values the visitor still has consent for', () => {
    writeConsent(GRANTED_STATE, 'accept-all')
    window.localStorage.setItem('booking_draft', 'in-progress')

    purgeFunctionalStorage()

    // booking_draft is strictly necessary — a rejection must not destroy it.
    expect(window.localStorage.getItem('booking_draft')).toBe('in-progress')
  })
})

describe('after a rejection', () => {
  it('does not persist new writes', () => {
    writeConsent(DENIED_STATE, 'reject-non-essential')
    writeGated(KEY, '["a"]')

    expect(window.localStorage.getItem(KEY)).toBeNull()
  })
})
