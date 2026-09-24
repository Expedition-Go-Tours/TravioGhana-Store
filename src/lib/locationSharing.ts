/**
 * Location sharing — the single source of truth for the traveller's opt-in.
 *
 * The browser geolocation API must never run unprompted: the native permission
 * prompt may only appear after an explicit user action. This module owns the
 * persisted preference (`eg_location_sharing`, functional category) so every
 * consumer reacts to the same choice, and exposes a one-shot position request
 * that callers invoke from user gestures only.
 *
 * Storage is consent-gated through `consentGatedStorage`: before functional
 * cookies are accepted the preference is held in memory and never written to
 * the device; withdrawing consent removes it.
 */

import { clearStoredLocation, storeLocation, trackLocationShared } from './analytics'
import { readGated, removeGated, writeGated } from './consentGatedStorage'

/** Preference key — `'on'` means the traveller chose to share their location. */
export const LOCATION_SHARING_KEY = 'eg_location_sharing'

/** Fired on every preference change so live consumers can react. */
export const LOCATION_SHARING_EVENT = 'eg:location-sharing-changed'

/** The browser's verdict, read without ever prompting. */
export type GeolocationPermission = 'granted' | 'denied' | 'prompt' | 'unsupported'

/** Why a position request failed. */
export type LocationFailureReason = 'denied' | 'unavailable' | 'timeout' | 'unsupported'

export interface UserCoordinates {
  lat: number
  lng: number
}

export type LocationRequestResult =
  | { ok: true; coords: UserCoordinates }
  | { ok: false; reason: LocationFailureReason }

/** Has the traveller chosen to share their location? Defaults to off. */
export function isLocationSharingEnabled(): boolean {
  return readGated(LOCATION_SHARING_KEY) === 'on'
}

/** Persist the traveller's choice and notify every subscriber. */
export function setLocationSharingEnabled(on: boolean): void {
  if (on) writeGated(LOCATION_SHARING_KEY, 'on')
  else removeGated(LOCATION_SHARING_KEY)
  emitLocationSharingChange()
}

/**
 * The browser's own geolocation verdict, without ever prompting. Returns
 * `prompt` when the Permissions API can't report geolocation (older Safari)
 * or no choice has been made yet.
 */
export async function getGeolocationPermission(): Promise<GeolocationPermission> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return 'unsupported'
  try {
    const status = await navigator.permissions?.query({ name: 'geolocation' as PermissionName })
    if (status && (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt')) {
      return status.state
    }
  } catch {
    /* Permissions API unavailable for geolocation — fall back to 'prompt' */
  }
  return 'prompt'
}

/**
 * One-shot device position. Callers must only invoke this from a user gesture
 * (`enable`/`retry` handlers) — this is the call that can raise the browser's
 * permission prompt.
 */
export function requestCurrentCoordinates(options?: PositionOptions): Promise<LocationRequestResult> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ ok: false, reason: 'unsupported' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ ok: true, coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } }),
      (err) => {
        const reason: LocationFailureReason =
          err.code === err.PERMISSION_DENIED
            ? 'denied'
            : err.code === err.TIMEOUT
              ? 'timeout'
              : 'unavailable'
        resolve({ ok: false, reason })
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000, ...options },
    )
  })
}

/**
 * Remember coordinates the traveller opted into sharing (24h TTL) and record
 * the analytics event. Only ever called after an explicit opt-in.
 */
export function rememberSharedCoordinates(coords: UserCoordinates): void {
  storeLocation(coords.lat, coords.lng)
  trackLocationShared(coords.lat, coords.lng)
}

/** Forget the stored coordinates when sharing is switched off. */
export function forgetSharedCoordinates(): void {
  clearStoredLocation()
}

/** Subscribe to preference changes — same tab and other tabs. */
export function subscribeLocationSharing(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const onCustom = () => callback()
  const onStorage = (event: StorageEvent) => {
    if (event.key === LOCATION_SHARING_KEY) callback()
  }
  window.addEventListener(LOCATION_SHARING_EVENT, onCustom)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(LOCATION_SHARING_EVENT, onCustom)
    window.removeEventListener('storage', onStorage)
  }
}

function emitLocationSharingChange(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(LOCATION_SHARING_EVENT))
  } catch {
    /* CustomEvent unavailable — subscribers simply don't hear about it */
  }
}
