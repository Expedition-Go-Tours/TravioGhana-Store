import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearConsent, writeConsent } from '../lib/cookieConsent'
import { resetPendingWrites } from '../lib/consentGatedStorage'
import { isLocationSharingEnabled, setLocationSharingEnabled } from '../lib/locationSharing'
import { useLocationSharing } from './useLocationSharing'

function position(lat = 5.6037, lng = -0.187) {
  return {
    coords: { latitude: lat, longitude: lng, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
    timestamp: Date.now(),
  } as GeolocationPosition
}

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

/** Let the hook's mount-time permission sync settle inside act(). */
async function flushLocationSync() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  window.localStorage.clear()
  resetPendingWrites()
  clearConsent()
  writeConsent({ functional: true }, 'preferences')
})

afterEach(() => {
  removeGeolocation()
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: undefined })
  window.localStorage.clear()
  resetPendingWrites()
  clearConsent()
})

describe('useLocationSharing', () => {
  it('never calls geolocation on mount when sharing is off', async () => {
    const getCurrentPosition = installGeolocation((success) => success(position()))
    installPermissions('prompt')

    const { result } = renderHook(() => useLocationSharing())
    await flushLocationSync()
    await waitFor(() => expect(result.current.permission).toBe('prompt'))

    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
    expect(result.current.coords).toBeNull()
  })

  it('does not prompt when opted in but the browser still needs a gesture', async () => {
    setLocationSharingEnabled(true)
    const getCurrentPosition = installGeolocation((success) => success(position()))
    installPermissions('prompt')

    const { result } = renderHook(() => useLocationSharing())
    await flushLocationSync()
    await waitFor(() => expect(result.current.enabled).toBe(true))

    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })

  it('resolves coordinates silently when opted in and permission was already granted', async () => {
    setLocationSharingEnabled(true)
    const getCurrentPosition = installGeolocation((success) => success(position(5.55, -0.19)))
    installPermissions('granted')

    const { result } = renderHook(() => useLocationSharing())
    await flushLocationSync()

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(result.current.coords).toEqual({ lat: 5.55, lng: -0.19 })
  })

  it('enable() requests the position from a user gesture and persists the opt-in', async () => {
    const getCurrentPosition = installGeolocation((success) => success(position(5.61, -0.18)))
    installPermissions('prompt')

    const { result } = renderHook(() => useLocationSharing())
    await flushLocationSync()

    await act(async () => {
      const outcome = await result.current.enable()
      expect(outcome.ok).toBe(true)
    })
    await flushLocationSync()

    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('ready')
    expect(result.current.enabled).toBe(true)
    expect(isLocationSharingEnabled()).toBe(true)
    expect(result.current.coords).toEqual({ lat: 5.61, lng: -0.18 })
  })

  it('reverts the opt-in and reports a blocked state when the browser denies', async () => {
    installGeolocation((_success, error) => error(geoError(1)))
    installPermissions('denied')

    const { result } = renderHook(() => useLocationSharing())
    await flushLocationSync()

    await act(async () => {
      const outcome = await result.current.enable()
      expect(outcome).toEqual({ ok: false, reason: 'denied' })
    })
    await flushLocationSync()

    expect(result.current.enabled).toBe(false)
    expect(isLocationSharingEnabled()).toBe(false)
    expect(result.current.status).toBe('denied')
    expect(result.current.coords).toBeNull()
  })

  it('keeps the opt-in on a transient failure so retry() can resolve it', async () => {
    let behaviour: 'timeout' | 'success' = 'timeout'
    const getCurrentPosition = vi.fn((success: PositionCallback, error: (err: GeolocationPositionError) => void) => {
      if (behaviour === 'timeout') error(geoError(3))
      else success(position(5.62, -0.17))
    })
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } })
    installPermissions('prompt')

    const { result } = renderHook(() => useLocationSharing())
    await flushLocationSync()

    await act(async () => {
      const outcome = await result.current.enable()
      expect(outcome).toEqual({ ok: false, reason: 'timeout' })
    })
    await flushLocationSync()
    expect(result.current.status).toBe('error')
    expect(isLocationSharingEnabled()).toBe(true)

    behaviour = 'success'
    await act(async () => {
      const outcome = await result.current.retry()
      expect(outcome.ok).toBe(true)
    })
    await flushLocationSync()
    expect(result.current.status).toBe('ready')
    expect(result.current.coords).toEqual({ lat: 5.62, lng: -0.17 })
  })

  it('re-opts in when the traveller grants access in settings and retries', async () => {
    let denied = true
    const getCurrentPosition = vi.fn((success: PositionCallback, error: (err: GeolocationPositionError) => void) => {
      if (denied) error(geoError(1))
      else success(position(5.63, -0.16))
    })
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } })
    installPermissions('denied')

    const { result } = renderHook(() => useLocationSharing())
    await flushLocationSync()

    await act(async () => {
      await result.current.enable()
    })
    await flushLocationSync()
    expect(isLocationSharingEnabled()).toBe(false)

    // The traveller flips location on in their browser settings…
    denied = false
    installPermissions('granted')

    await act(async () => {
      const outcome = await result.current.retry()
      expect(outcome.ok).toBe(true)
    })
    await flushLocationSync()

    expect(result.current.status).toBe('ready')
    expect(isLocationSharingEnabled()).toBe(true)
    expect(result.current.coords).toEqual({ lat: 5.63, lng: -0.16 })
  })

  it('disable() turns sharing off and forgets coordinates', async () => {
    installGeolocation((success) => success(position()))
    installPermissions('prompt')

    const { result } = renderHook(() => useLocationSharing())
    await flushLocationSync()

    await act(async () => {
      await result.current.enable()
    })
    await flushLocationSync()
    expect(result.current.status).toBe('ready')

    act(() => {
      result.current.disable()
    })
    await flushLocationSync()

    expect(result.current.enabled).toBe(false)
    expect(result.current.coords).toBeNull()
    expect(result.current.status).toBe('idle')
    expect(isLocationSharingEnabled()).toBe(false)
  })
})
