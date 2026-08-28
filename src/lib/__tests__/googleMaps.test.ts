import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  GOOGLE_MAPS_OUTCOME_KEY,
  GoogleMapsLoadError,
  isGoogleMapsAuthFailed,
  loadGoogleMaps,
  recordGoogleMapsFailure,
  resetGoogleMapsLoader,
  shouldAttemptGoogleMaps,
} from '../googleMaps'

const CALLBACK_KEY = '__travioGhanaMapsCallback'
type Win = Window & { [CALLBACK_KEY]?: () => void; gm_authFailure?: () => void; google?: { maps?: unknown } }

let appended: HTMLScriptElement | null = null

function stubScriptInjection() {
  appended = null
  vi.spyOn(window.HTMLHeadElement.prototype, 'appendChild').mockImplementation(function (
    this: HTMLElement,
    node: Node,
  ) {
    if (node instanceof HTMLScriptElement) appended = node
    return node
  })
}

function fireCallback() {
  const cb = (window as unknown as Win)[CALLBACK_KEY]
  expect(cb).toBeTypeOf('function')
  cb?.()
}

describe('googleMaps loader', () => {
  afterEach(() => {
    resetGoogleMapsLoader()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    delete (window as unknown as Win).google
    delete (window as unknown as Win)[CALLBACK_KEY]
    delete (window as unknown as Win).gm_authFailure
  })

  it('rejects with NO_KEY when no VITE_GOOGLE_MAPS_API_KEY is set', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
    await expect(loadGoogleMaps()).rejects.toMatchObject({
      name: 'GoogleMapsLoadError',
      reason: 'NO_KEY',
    })
  })

  it('injects the Maps JS script with the configured key and resolves on callback', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key-123')
    stubScriptInjection()

    const promise = loadGoogleMaps()
    expect(appended).not.toBeNull()
    expect(appended?.src).toContain('maps.googleapis.com/maps/api/js')
    expect(appended?.src).toContain('key=test-key-123')
    // Best-practice loading pattern + the marker import library (used by
    // AdvancedMarkerElement, since google.maps.Marker is deprecated).
    expect(appended?.src).toContain('loading=async')
    expect(appended?.src).toContain('libraries=marker')

    // The API loads the namespace asynchronously; simulate that before firing
    // the loader's global callback.
    ;(window as unknown as Win).google = { maps: { foo: 'bar' } }
    fireCallback()
    await expect(promise).resolves.toEqual({ foo: 'bar' })
  })

  it('rejects with SCRIPT_ERROR when the script tag errors', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key-123')
    stubScriptInjection()

    const promise = loadGoogleMaps()
    const err = new Event('error')
    appended?.onerror?.(err)
    await expect(promise).rejects.toMatchObject({
      name: 'GoogleMapsLoadError',
      reason: 'SCRIPT_ERROR',
    })
  })

  it('rejects with AUTH_FAILURE on gm_authFailure and stays sticky', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key-123')
    stubScriptInjection()

    const promise = loadGoogleMaps()
    const auth = (window as unknown as Win).gm_authFailure
    expect(auth).toBeTypeOf('function')
    auth?.()

    await expect(promise).rejects.toMatchObject({
      name: 'GoogleMapsLoadError',
      reason: 'AUTH_FAILURE',
    })
    expect(isGoogleMapsAuthFailed()).toBe(true)
    // Later callers fail immediately without re-injecting the script.
    appended = null
    await expect(loadGoogleMaps()).rejects.toBeInstanceOf(GoogleMapsLoadError)
    expect(appended).toBeNull()
  })

  it('rejects with TIMEOUT when the API never loads', async () => {
    vi.useFakeTimers()
    try {
      vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key-123')
      stubScriptInjection()
      const promise = loadGoogleMaps()
      vi.advanceTimersByTime(16000)
      await expect(promise).rejects.toMatchObject({
        name: 'GoogleMapsLoadError',
        reason: 'TIMEOUT',
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('caches the outcome so repeated calls reuse the same promise', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key-123')
    stubScriptInjection()

    const p1 = loadGoogleMaps()
    const p2 = loadGoogleMaps()
    expect(p2).toBe(p1)
    ;(window as unknown as Win).google = { maps: { foo: 'bar' } }
    fireCallback()
    await expect(p1).resolves.toEqual({ foo: 'bar' })
  })

  it('skips the network on a recent remembered failure (billing/key not enabled)', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key-123')
    stubScriptInjection()
    window.localStorage.setItem(
      GOOGLE_MAPS_OUTCOME_KEY,
      JSON.stringify({ ok: false, ts: Date.now(), key: 'test-key-123' }),
    )

    await expect(loadGoogleMaps()).rejects.toMatchObject({
      name: 'GoogleMapsLoadError',
      reason: 'AUTH_FAILURE',
    })
    // No script was injected, so the Maps API's own console error is not re-logged.
    expect(appended).toBeNull()
    expect(isGoogleMapsAuthFailed()).toBe(true)
  })

  it('still attempts the load when a previous attempt succeeded', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key-123')
    stubScriptInjection()
    window.localStorage.setItem(
      GOOGLE_MAPS_OUTCOME_KEY,
      JSON.stringify({ ok: true, ts: Date.now(), key: 'test-key-123' }),
    )

    const promise = loadGoogleMaps()
    expect(appended).not.toBeNull()
    ;(window as unknown as Win).google = { maps: { foo: 'bar' } }
    fireCallback()
    await expect(promise).resolves.toEqual({ foo: 'bar' })
  })

  it('ignores a remembered failure for a different key (swapped key gets a fresh attempt)', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'new-key-456')
    stubScriptInjection()
    // Stale failure recorded for the previous key.
    window.localStorage.setItem(
      GOOGLE_MAPS_OUTCOME_KEY,
      JSON.stringify({ ok: false, ts: Date.now(), key: 'old-key-123' }),
    )

    const promise = loadGoogleMaps()
    expect(appended).not.toBeNull()
    ;(window as unknown as Win).google = { maps: { foo: 'bar' } }
    fireCallback()
    await expect(promise).resolves.toEqual({ foo: 'bar' })
  })

  it('shouldAttemptGoogleMaps reflects key availability and the cached outcome', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
    expect(shouldAttemptGoogleMaps()).toBe(false)

    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key-123')
    expect(shouldAttemptGoogleMaps()).toBe(true)

    // A recent remembered failure short-circuits (no network attempt).
    window.localStorage.setItem(
      GOOGLE_MAPS_OUTCOME_KEY,
      JSON.stringify({ ok: false, ts: Date.now(), key: 'test-key-123' }),
    )
    expect(shouldAttemptGoogleMaps()).toBe(false)

    // A remembered success keeps the attempt green.
    window.localStorage.setItem(
      GOOGLE_MAPS_OUTCOME_KEY,
      JSON.stringify({ ok: true, ts: Date.now(), key: 'test-key-123' }),
    )
    expect(shouldAttemptGoogleMaps()).toBe(true)
  })

  it('recordGoogleMapsFailure sticks and disables future attempts', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key-123')
    expect(shouldAttemptGoogleMaps()).toBe(true)

    recordGoogleMapsFailure()
    expect(isGoogleMapsAuthFailed()).toBe(true)
    expect(shouldAttemptGoogleMaps()).toBe(false)
  })
})