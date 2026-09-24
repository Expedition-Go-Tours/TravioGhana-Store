/**
 * useLocationSharing — the one hook every location-aware surface uses.
 *
 * Guarantees the browser's location permission prompt can only appear from a
 * user gesture (`enable` / `retry`). On mount it may resolve coordinates
 * silently, but only when the traveller has already turned sharing on AND the
 * browser has already granted access — never while permission is still
 * `prompt`.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { subscribeConsent } from '../lib/cookieConsent'
import {
  forgetSharedCoordinates,
  getGeolocationPermission,
  isLocationSharingEnabled,
  rememberSharedCoordinates,
  requestCurrentCoordinates,
  setLocationSharingEnabled,
  subscribeLocationSharing,
  type GeolocationPermission,
  type LocationFailureReason,
  type UserCoordinates,
} from '../lib/locationSharing'

export type LocationSharingStatus =
  | 'idle'        // sharing off, or on but waiting for a user gesture
  | 'requesting'  // the device position is being resolved
  | 'ready'       // coordinates available
  | 'denied'      // the browser blocked location access
  | 'error'       // the device could not provide a position
  | 'unsupported' // no geolocation API on this device

export type LocationSharingEnableResult =
  | { ok: true; coords: UserCoordinates }
  | { ok: false; reason: LocationFailureReason }

export interface LocationSharingState {
  /** The traveller's persisted opt-in (off by default). */
  enabled: boolean
  /** The browser's own verdict, read without prompting. */
  permission: GeolocationPermission
  status: LocationSharingStatus
  coords: UserCoordinates | null
  /** User gesture: turn sharing on and resolve the position (may prompt). */
  enable: () => Promise<LocationSharingEnableResult>
  /** Turn sharing off and forget the stored location. */
  disable: () => void
  /** Re-resolve the position while sharing is on (user gesture). */
  retry: () => Promise<LocationSharingEnableResult>
}

export function useLocationSharing(): LocationSharingState {
  const [enabled, setEnabled] = useState<boolean>(() => isLocationSharingEnabled())
  const [permission, setPermission] = useState<GeolocationPermission>(() =>
    typeof navigator !== 'undefined' && navigator.geolocation ? 'prompt' : 'unsupported',
  )
  const [status, setStatus] = useState<LocationSharingStatus>(() =>
    typeof navigator !== 'undefined' && navigator.geolocation ? 'idle' : 'unsupported',
  )
  const [coords, setCoords] = useState<UserCoordinates | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Keep every instance in sync with the shared preference. Coordinates are
  // only resolved unprompted when the visitor has opted in AND the browser has
  // already granted access; 'prompt' and 'denied' wait for a user gesture.
  useEffect(() => {
    let cancelled = false

    const sync = async () => {
      // No device API: the initial state already says 'unsupported', and
      // nothing can ever change it — skip without scheduling updates.
      if (typeof navigator === 'undefined' || !navigator.geolocation) return

      const perm = await getGeolocationPermission()
      // Read the preference *after* the await: a stale snapshot taken before
      // it could revert state the traveller just changed (e.g. enable()).
      const pref = isLocationSharingEnabled()
      if (cancelled || !mountedRef.current) return

      setEnabled(pref)
      setPermission(perm)

      if (!pref) {
        setCoords(null)
        // A blocked/unsupported verdict stays visible even after the opt-in is
        // reverted, so the traveller is told how to recover.
        if (perm === 'unsupported') setStatus('unsupported')
        else if (perm === 'denied') setStatus('denied')
        else setStatus('idle')
        return
      }
      if (perm === 'unsupported') {
        setCoords(null)
        setStatus('unsupported')
        return
      }
      if (perm === 'denied') {
        setCoords(null)
        setStatus('denied')
        return
      }
      if (perm !== 'granted') {
        // Waiting for the traveller to allow access — no popup here.
        return
      }

      setStatus('requesting')
      const result = await requestCurrentCoordinates({ maximumAge: 300000 })
      if (cancelled || !mountedRef.current) return
      if (result.ok) {
        setCoords(result.coords)
        setStatus('ready')
      } else if (result.reason === 'denied') {
        setCoords(null)
        setStatus('denied')
      } else {
        setStatus('error')
      }
    }

    void sync()
    const unsubscribePref = subscribeLocationSharing(() => {
      void sync()
    })
    const unsubscribeConsent = subscribeConsent(() => {
      void sync()
    })
    return () => {
      cancelled = true
      unsubscribePref()
      unsubscribeConsent()
    }
  }, [])

  /** Resolve a position — only call from a user gesture. */
  const resolvePosition = useCallback(async (options?: PositionOptions): Promise<LocationSharingEnableResult> => {
    setStatus('requesting')
    const result = await requestCurrentCoordinates(options)
    if (!mountedRef.current) return result

    if (result.ok) {
      rememberSharedCoordinates(result.coords)
      setCoords(result.coords)
      setPermission('granted')
      setEnabled(true)
      setStatus('ready')
      return result
    }

    setCoords(null)
    if (result.reason === 'denied') {
      setPermission('denied')
      setStatus('denied')
    } else if (result.reason === 'unsupported') {
      setPermission('unsupported')
      setStatus('unsupported')
    } else {
      setStatus('error')
    }
    return result
  }, [])

  /** User gesture: opt in and request the position (may show the prompt). */
  const enable = useCallback(async (): Promise<LocationSharingEnableResult> => {
    setLocationSharingEnabled(true)
    setEnabled(true)
    const result = await resolvePosition({ enableHighAccuracy: true, timeout: 12000 })
    if (!result.ok && (result.reason === 'denied' || result.reason === 'unsupported')) {
      // Never keep an opt-in the browser refused.
      setLocationSharingEnabled(false)
      setEnabled(false)
    }
    return result
  }, [resolvePosition])

  /** User gesture: retry after a timeout/unavailable error or a settings change. */
  const retry = useCallback(async (): Promise<LocationSharingEnableResult> => {
    const result = await resolvePosition({ enableHighAccuracy: true, timeout: 12000 })
    if (result.ok) {
      // A retry that succeeds (e.g. after the traveller enabled location in
      // their browser settings) is a fresh opt-in — persist it again.
      if (!isLocationSharingEnabled()) setLocationSharingEnabled(true)
    } else if (result.reason === 'denied' || result.reason === 'unsupported') {
      setLocationSharingEnabled(false)
      setEnabled(false)
    }
    return result
  }, [resolvePosition])

  /** Turn sharing off everywhere and forget the stored location. */
  const disable = useCallback(() => {
    setLocationSharingEnabled(false)
    forgetSharedCoordinates()
    setEnabled(false)
    setCoords(null)
    setStatus('idle')
  }, [])

  return { enabled, permission, status, coords, enable, disable, retry }
}
