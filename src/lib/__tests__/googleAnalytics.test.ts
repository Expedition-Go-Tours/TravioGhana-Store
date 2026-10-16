/**
 * index.html ships the gtag.js tag for every visitor — Google's tag setup
 * detects the tag by fetching the page, which carries no consent choice — with
 * Consent Mode v2 defaulting everything to denied. This module owns what must
 * follow the choice, so these tests pin the behaviour that matters legally and
 * operationally: defaults are denied before opt-in, opting in turns analytics
 * storage on, and withdrawing revokes it, clears the cookies and stops
 * collection.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearConsent, writeConsent } from '../cookieConsent'

const MEASUREMENT_ID = 'G-JMH0ZKFYB8'
const DISABLE_FLAG = `ga-disable-${MEASUREMENT_ID}`

type GaModule = typeof import('../googleAnalytics')

let stop: (() => void) | undefined
let calls: unknown[][]

/**
 * Stand in for gtag's queueing stub so the assertions can read the calls. The
 * module keeps a function that is already installed, which is exactly what the
 * real library does.
 */
function installRecorder(): void {
  calls = []
  window.dataLayer = calls
  window.gtag = (...args: unknown[]) => {
    calls.push(args)
  }
}

async function loadGa(): Promise<GaModule> {
  vi.resetModules()
  const mod = (await import('../googleAnalytics')) as GaModule
  stop = mod.initGoogleAnalytics()
  return mod
}

function clearGaCookies(): void {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim()
    if (name && (name === '_ga' || name.startsWith('_ga_'))) {
      document.cookie = `${name}=; Max-Age=0; Path=/`
    }
  }
}

/** The most recent `consent <verb>` call, or undefined. */
function lastConsentUpdate(): Record<string, unknown> | undefined {
  return calls
    .filter((call) => call[0] === 'consent' && call[1] === 'update')
    .at(-1)?.[2] as Record<string, unknown> | undefined
}

const disableFlag = () => (window as unknown as Record<string, unknown>)[DISABLE_FLAG]

beforeEach(() => {
  clearConsent()
  clearGaCookies()
  installRecorder()
  delete (window as unknown as Record<string, unknown>)[DISABLE_FLAG]
})

afterEach(() => {
  stop?.()
  stop = undefined
})

describe('before the visitor opts in', () => {
  it('declares consent mode defaults with every category denied', async () => {
    await loadGa()

    const consentDefault = calls.find((call) => call[0] === 'consent' && call[1] === 'default')
    expect(consentDefault?.[2]).toMatchObject({
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    })
  })

  it('configures the tag with automatic page views off', async () => {
    await loadGa()

    const config = calls.find((call) => call[0] === 'config')
    expect(config?.[1]).toBe(MEASUREMENT_ID)
    expect((config?.[2] as Record<string, unknown>).send_page_view).toBe(false)
  })

  it('stops collection and reports no page view', async () => {
    const mod = await loadGa()

    expect(disableFlag()).toBe(true)
    mod.trackGaPageView('/tours')
    expect(calls.some((call) => call[0] === 'event')).toBe(false)
  })
})

describe('once the visitor allows analytics', () => {
  it('grants analytics storage and lifts the kill switch', async () => {
    writeConsent({ analytics: true }, 'accept-all')
    await loadGa()

    expect(lastConsentUpdate()).toMatchObject({ analytics_storage: 'granted' })
    expect(disableFlag()).toBe(false)
  })

  it('reports one page_view per navigation, with the path', async () => {
    writeConsent({ analytics: true }, 'accept-all')
    const mod = await loadGa()

    mod.trackGaPageView('/tours?city=accra')

    const event = calls.filter((call) => call[0] === 'event').at(-1)
    expect(event?.[1]).toBe('page_view')
    expect((event?.[2] as Record<string, unknown>).page_path).toBe('/tours?city=accra')
  })

  it('switches on when consent is granted after load', async () => {
    await loadGa()
    expect(lastConsentUpdate()).toMatchObject({ analytics_storage: 'denied' })

    writeConsent({ analytics: true }, 'accept-all')

    expect(lastConsentUpdate()).toMatchObject({ analytics_storage: 'granted' })
    expect(disableFlag()).toBe(false)
  })
})

describe('when consent is withdrawn', () => {
  it('revokes storage, clears the cookies and stops collection', async () => {
    writeConsent({ analytics: true }, 'accept-all')
    document.cookie = '_ga=GA1.1.1234567890; Path=/'
    document.cookie = `_ga_${MEASUREMENT_ID}=GS1.1.abcdef; Path=/`
    const mod = await loadGa()
    expect(document.cookie).toContain('_ga=')

    writeConsent({ analytics: false }, 'preferences')

    expect(lastConsentUpdate()).toMatchObject({ analytics_storage: 'denied' })
    expect(disableFlag()).toBe(true)
    expect(document.cookie).not.toContain('_ga=')

    const before = calls.length
    mod.trackGaPageView('/tours')
    expect(calls.length).toBe(before)
  })
})
