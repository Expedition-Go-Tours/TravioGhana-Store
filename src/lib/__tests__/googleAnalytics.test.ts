/**
 * The GA loader is the consent gate for a third-party vendor, so these tests
 * pin the two things that matter legally and operationally: nothing loads (or
 * is stored) before analytics consent, and withdrawing consent tears GA down —
 * script, kill switch and cookies. The loader keeps module-level state, so each
 * test re-imports it after `vi.resetModules()` and detaches its listener.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearConsent, writeConsent } from '../cookieConsent'

const SCRIPT_SELECTOR = 'script[data-ga-loader]'
const MEASUREMENT_ID = 'G-JMH0ZKFYB8'
const DISABLE_FLAG = `ga-disable-${MEASUREMENT_ID}`

type GaModule = typeof import('../googleAnalytics')

let stop: (() => void) | undefined

/** Fresh module instance bound to a fresh consent listener. */
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

function loaderScript(): HTMLScriptElement | null {
  return document.querySelector<HTMLScriptElement>(SCRIPT_SELECTOR)
}

function dataLayerCalls(): unknown[][] {
  return (window.dataLayer as unknown[][] | undefined) ?? []
}

beforeEach(() => {
  clearConsent()
  clearGaCookies()
  document.head.querySelectorAll(SCRIPT_SELECTOR).forEach((node) => node.remove())
  delete (window as { gtag?: unknown }).gtag
  delete (window as { dataLayer?: unknown }).dataLayer
  delete (window as unknown as Record<string, unknown>)[DISABLE_FLAG]
})

afterEach(() => {
  stop?.()
  stop = undefined
})

describe('without analytics consent', () => {
  it('does not inject the tag, define gtag or report page views', async () => {
    const mod = await loadGa()

    expect(loaderScript()).toBeNull()
    expect(window.gtag).toBeUndefined()

    mod.trackGaPageView('/tours')
    expect(window.dataLayer).toBeUndefined()
  })
})

describe('with analytics consent', () => {
  it('injects gtag.js and queues the consent and config calls', async () => {
    writeConsent({ analytics: true }, 'accept-all')
    await loadGa()

    const script = loaderScript()
    expect(script).not.toBeNull()
    expect(script?.src).toBe(`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`)
    expect(script?.async).toBe(true)

    const calls = dataLayerCalls().map((call) => call[0])
    expect(calls).toContain('consent')
    expect(calls).toContain('config')
    expect(window.gtag).toBeTypeOf('function')
  })

  it('reports one page_view per navigation, with the path', async () => {
    writeConsent({ analytics: true }, 'accept-all')
    const mod = await loadGa()

    mod.trackGaPageView('/tours?city=accra')

    const last = dataLayerCalls().at(-1)
    expect(last?.[0]).toBe('event')
    expect(last?.[1]).toBe('page_view')
    expect((last?.[2] as Record<string, unknown>).page_path).toBe('/tours?city=accra')
  })

  it('starts GA when consent is granted after init', async () => {
    await loadGa()
    expect(loaderScript()).toBeNull()

    writeConsent({ analytics: true }, 'accept-all')

    expect(loaderScript()).not.toBeNull()
    expect(window.gtag).toBeTypeOf('function')
  })

  it('tears GA down and clears its cookies when consent is withdrawn', async () => {
    writeConsent({ analytics: true }, 'accept-all')
    document.cookie = '_ga=GA1.1.1234567890; Path=/'
    document.cookie = `_ga_${MEASUREMENT_ID}=GS1.1.abcdef; Path=/`
    const mod = await loadGa()
    expect(document.cookie).toContain('_ga=')

    writeConsent({ analytics: false }, 'preferences')

    expect(loaderScript()).toBeNull()
    expect((window as unknown as Record<string, unknown>)[DISABLE_FLAG]).toBe(true)
    expect(document.cookie).not.toContain('_ga=')

    // A withdrawn visitor sends nothing further.
    const before = dataLayerCalls().length
    mod.trackGaPageView('/tours')
    expect(dataLayerCalls().length).toBe(before)
  })
})
