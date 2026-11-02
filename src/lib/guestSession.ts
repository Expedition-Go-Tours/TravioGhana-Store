/**
 * Guest checkout session.
 *
 * A traveller who books without an account gets an opaque `guestToken` back
 * from `POST /checkout/confirm`. It is the only credential they have: the
 * draft read, the release, the PayPal capture and the confirmation poll all
 * authorize against it (see `guestAccess.js` on the backend).
 *
 * Stored in **session**Storage on purpose: it survives a refresh mid-payment
 * (which must not strand an open hold) but dies with the tab, so a shared
 * machine does not keep a stranger's checkout alive after the browser closes.
 */

const KEY = 'travio_guest_token'

export function setGuestToken(token: string | null | undefined): void {
  try {
    if (!token) return
    sessionStorage.setItem(KEY, token)
  } catch {
    /* private mode / disabled storage — the flow degrades to no guest access */
  }
}

export function getGuestToken(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function clearGuestToken(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* noop */
  }
}

/** Headers to add to a request that may need guest authorization. */
export function guestHeaders(): Record<string, string> {
  const token = getGuestToken()
  return token ? { 'x-guest-token': token } : {}
}
