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

/**
 * jsdom's window.location can be replaced wholesale (same pattern as
 * Navbar.test.tsx). Every non-gate test runs as the live site; the gate tests
 * drop in a different hostname.
 */
function setHost(hostname: string): void {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: new URL(`https://${hostname}/`),
  })
}

beforeEach(() => {
  clearConsent()
  clearGaCookies()
  installRecorder()
  delete (window as unknown as Record<string, unknown>)[DISABLE_FLAG]
  setHost('www.travioghana.com')
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

  it('reports the page the visitor is on when they opt in mid-visit', async () => {
    await loadGa()
    expect(calls.some((call) => call[0] === 'event')).toBe(false)

    writeConsent({ analytics: true }, 'accept-all')

    // Without this, a visitor who accepts on the landing page sends GA a config
    // and a consent update but no page view until their next navigation.
    const event = calls.filter((call) => call[0] === 'event').at(-1)
    expect(event?.[1]).toBe('page_view')
    expect((event?.[2] as Record<string, unknown>).page_path).toBe('/')
  })

  it('does not report again when an unrelated category changes', async () => {
    writeConsent({ analytics: true }, 'accept-all')
    await loadGa()

    writeConsent({ analytics: true, marketing: true }, 'preferences')

    expect(calls.some((call) => call[0] === 'event')).toBe(false)
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

describe('the queueing stub', () => {
  it('pushes an arguments object, which is the shape gtag.js dispatches', async () => {
    // Drop the recorder so the module installs its real queueing stub.
    delete (window as { gtag?: unknown }).gtag
    window.dataLayer = []

    vi.resetModules()
    const mod = (await import('../googleAnalytics')) as GaModule
    stop = mod.initGoogleAnalytics()

    const first = window.dataLayer![0]
    // A plain Array here is silently ignored by gtag.js: consent never
    // registers and every hit is dropped, with no error to notice. See the
    // comment on ensureStub().
    expect(Array.isArray(first)).toBe(false)
    expect((first as unknown[])[0]).toBe('consent')
    expect((first as unknown[])[1]).toBe('default')
  })
})

describe('trackGaEvent', () => {
  it('drops events before the visitor opts in', async () => {
    const mod = await loadGa()
    mod.trackGaEvent('view_item', { item_id: 'abc' })
    expect(calls.some((call) => call[0] === 'event')).toBe(false)
  })

  it('forwards the event name and parameters once consent is granted', async () => {
    writeConsent({ analytics: true }, 'accept-all')
    const mod = await loadGa()

    mod.trackGaEvent('begin_checkout', { currency: 'GHS', value: 120 })

    const event = calls.filter((call) => call[0] === 'event').at(-1)
    expect(event?.[1]).toBe('begin_checkout')
    expect(event?.[2]).toMatchObject({ currency: 'GHS', value: 120 })
  })

  it('stops sending events after consent is withdrawn', async () => {
    writeConsent({ analytics: true }, 'accept-all')
    const mod = await loadGa()
    writeConsent({ analytics: false }, 'preferences')

    const before = calls.length
    mod.trackGaEvent('purchase', { value: 100 })
    expect(calls.length).toBe(before)
  })
})

describe('getGaClientId', () => {
  it('returns null before the visitor opts in, even if a cookie lingers', async () => {
    document.cookie = '_ga=GA1.1.1234567890.1700000000; Path=/'
    const mod = await loadGa()
    expect(mod.getGaClientId()).toBeNull()
  })

  it('extracts the client_id from the `_ga` cookie once consented', async () => {
    writeConsent({ analytics: true }, 'accept-all')
    document.cookie = '_ga=GA1.1.1234567890.1700000000; Path=/'
    const mod = await loadGa()
    expect(mod.getGaClientId()).toBe('1234567890.1700000000')
  })

  it('returns null when the cookie is absent or malformed', async () => {
    writeConsent({ analytics: true }, 'accept-all')
    const mod = await loadGa()
    expect(mod.getGaClientId()).toBeNull()

    document.cookie = '_ga=not-a-real-cookie; Path=/'
    expect(mod.getGaClientId()).toBeNull()
  })
})

/**
 * The measurement ID ships as a static literal in index.html for every host,
 * so this gate is the only thing keeping dev servers, `vite preview` and
 * preview deployments out of the production property (whose hostname report had
 * collected `localhost` and `example.com` traffic).
 */
describe('production host gate', () => {
  it('accepts exactly the live hosts', async () => {
    const mod = await loadGa()
    expect(mod.isProductionHost('www.travioghana.com')).toBe(true)
    expect(mod.isProductionHost('travioghana.com')).toBe(true)
    expect(mod.isProductionHost('localhost')).toBe(false)
    expect(mod.isProductionHost('127.0.0.1')).toBe(false)
    expect(mod.isProductionHost('travioghana.vercel.app')).toBe(false)
    expect(mod.isProductionHost('example.com')).toBe(false)
    expect(mod.isProductionHost('')).toBe(false)
  })

  it('queues no consent or config calls and arms the kill switch off-site', async () => {
    setHost('localhost')
    await loadGa()
    expect(calls.filter((call) => call[0] === 'consent' || call[0] === 'config' || call[0] === 'js')).toEqual([])
    expect(disableFlag()).toBe(true)
    expect(typeof stop).toBe('function')
  })

  it('cannot be re-armed by granting consent on a non-production host', async () => {
    setHost('preview.example.net')
    await loadGa()
    writeConsent({ analytics: true }, 'accept-all')
    expect(disableFlag()).toBe(true)
    expect(calls.filter((call) => call[0] === 'consent' && call[1] === 'update')).toEqual([])
    expect(calls.some((call) => call[0] === 'event')).toBe(false)
  })
})
