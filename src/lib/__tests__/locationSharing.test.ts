import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearConsent, writeConsent } from '../cookieConsent'
import { flushGatedMemory, resetPendingWrites } from '../consentGatedStorage'
import {
  LOCATION_SHARING_KEY,
  forgetSharedCoordinates,
  getGeolocationPermission,
  isLocationSharingEnabled,
  rememberSharedCoordinates,
  requestCurrentCoordinates,
  setLocationSharingEnabled,
  subscribeLocationSharing,
} from '../locationSharing'
import { getStoredLocation } from '../analytics'

/** Good-enough GeolocationPosition for the success callback. */
function position(lat = 5.6037, lng = -0.187) {
  return {
    coords: { latitude: lat, longitude: lng, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
    timestamp: Date.now(),
  } as GeolocationPosition
}

/** Error object carrying the same constants the browser exposes. */
function geoError(code: number) {
  return { code, message: '', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError
}

function installGeolocation(handler: (success: PositionCallback, error: (err: GeolocationPositionError) => void) => void) {
  const getCurrentPosition = vi.fn((success: PositionCallback, error: (err: GeolocationPositionError) => void) => {
    handler(success, error)
  })
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  })
  return getCurrentPosition
}

function removeGeolocation() {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined })
}

function installPermissions(state: PermissionState) {
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: vi.fn(async () => ({ state })) },
  })
}

beforeEach(() => {
  window.localStorage.clear()
  resetPendingWrites()
  clearConsent()
  installPermissions('prompt')
})

afterEach(() => {
  removeGeolocation()
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: undefined })
  window.localStorage.clear()
  resetPendingWrites()
  clearConsent()
})

describe('location sharing preference', () => {
  it('is off by default', () => {
    expect(isLocationSharingEnabled()).toBe(false)
  })

  it('persists an opt-in once functional consent is granted', () => {
    writeConsent({ functional: true }, 'preferences')
    setLocationSharingEnabled(true)
    expect(isLocationSharingEnabled()).toBe(true)
    expect(window.localStorage.getItem(LOCATION_SHARING_KEY)).toBe('on')

    setLocationSharingEnabled(false)
    expect(isLocationSharingEnabled()).toBe(false)
    expect(window.localStorage.getItem(LOCATION_SHARING_KEY)).toBeNull()
  })

  it('never writes to the device before functional consent', () => {
    setLocationSharingEnabled(true)
    // Works for the session…
    expect(isLocationSharingEnabled()).toBe(true)
    // …but nothing has been persisted.
    expect(window.localStorage.getItem(LOCATION_SHARING_KEY)).toBeNull()

    // Granting consent flushes the session-held choice.
    writeConsent({ functional: true }, 'preferences')
    flushGatedMemory()
    expect(window.localStorage.getItem(LOCATION_SHARING_KEY)).toBe('on')
  })

  it('notifies subscribers when the preference changes', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeLocationSharing(listener)

    setLocationSharingEnabled(true)
    expect(listener).toHaveBeenCalledTimes(1)

    setLocationSharingEnabled(false)
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    setLocationSharingEnabled(true)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('removes the stored location when sharing is turned off', () => {
    writeConsent({ functional: true }, 'preferences')
    rememberSharedCoordinates({ lat: 5.6, lng: -0.18 })
    expect(getStoredLocation()).not.toBeNull()

    forgetSharedCoordinates()
    expect(getStoredLocation()).toBeNull()
  })
})

describe('getGeolocationPermission', () => {
  it('reports the browser verdict without prompting', async () => {
    installGeolocation(() => {})
    installPermissions('granted')
    await expect(getGeolocationPermission()).resolves.toBe('granted')

    installPermissions('denied')
    await expect(getGeolocationPermission()).resolves.toBe('denied')

    installPermissions('prompt')
    await expect(getGeolocationPermission()).resolves.toBe('prompt')
  })

  it('reports unsupported when the device has no geolocation API', async () => {
    removeGeolocation()
    await expect(getGeolocationPermission()).resolves.toBe('unsupported')
  })

  it('falls back to prompt when the Permissions API cannot report geolocation', async () => {
    installGeolocation(() => {})
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: vi.fn(async () => { throw new Error('unsupported') }) },
    })
    await expect(getGeolocationPermission()).resolves.toBe('prompt')
  })
})

describe('requestCurrentCoordinates', () => {
  it('resolves the device coordinates', async () => {
    installGeolocation((success) => success(position(5.5, -0.2)))
    await expect(requestCurrentCoordinates()).resolves.toEqual({ ok: true, coords: { lat: 5.5, lng: -0.2 } })
  })

  it('maps a denial to reason "denied"', async () => {
    installGeolocation((_success, error) => error(geoError(1)))
    await expect(requestCurrentCoordinates()).resolves.toEqual({ ok: false, reason: 'denied' })
  })

  it('maps a timeout to reason "timeout"', async () => {
    installGeolocation((_success, error) => error(geoError(3)))
    await expect(requestCurrentCoordinates()).resolves.toEqual({ ok: false, reason: 'timeout' })
  })

  it('reports unsupported without a geolocation API', async () => {
    removeGeolocation()
    await expect(requestCurrentCoordinates()).resolves.toEqual({ ok: false, reason: 'unsupported' })
  })
})
