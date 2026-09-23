import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/auth', () => ({
  googleOneTapSupported: () => true,
  getGoogleClientId: () => 'test-client-id',
  signInWithGoogleOneTap: vi.fn(async () => ({ id: 'u-test', email: 'a@b.com' })),
  subscribeToAuthState: () => Promise.resolve(() => {}),
  getStoredAuthUser: () => null,
  getAuthProvider: () => 'backend',
}))

import {
  shouldPromptHomeOneTap,
  markHomeOneTapShown,
  clearHomeOneTapCaps,
} from './GoogleOneTapPrompt'

const SESSION_KEY = 'expedition.googleOnetap.dismissedSession'
const DAILY_KEY = 'expedition.googleOnetap.lastShownDay'

describe('GoogleOneTapPrompt caps', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('allows the first prompt of a clean session', () => {
    expect(shouldPromptHomeOneTap()).toBe(true)
  })

  it('suppresses after it has been shown once', () => {
    markHomeOneTapShown()
    expect(shouldPromptHomeOneTap()).toBe(false)
  })

  it('re-enables after sign-out clears the caps', () => {
    markHomeOneTapShown()
    expect(shouldPromptHomeOneTap()).toBe(false)
    clearHomeOneTapCaps()
    expect(shouldPromptHomeOneTap()).toBe(true)
  })

  it('respects the once-per-calendar-day rule', () => {
    localStorage.setItem(DAILY_KEY, '2000-01-01')
    expect(shouldPromptHomeOneTap()).toBe(true)

    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem(DAILY_KEY, today)
    expect(shouldPromptHomeOneTap()).toBe(false)
  })

  it('a new session can prompt again the next day', () => {
    markHomeOneTapShown()
    expect(shouldPromptHomeOneTap()).toBe(false)

    // New session next day: session flag gone, daily key belongs to yesterday.
    sessionStorage.removeItem(SESSION_KEY)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    localStorage.setItem(DAILY_KEY, yesterday)
    expect(shouldPromptHomeOneTap()).toBe(true)
  })
})
