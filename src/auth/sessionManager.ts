/**
 * Session watchdog — proactive access-token refresh and lifecycle management.
 *
 * This module is a pure browser-level engine: no React, no DOM rendering.
 * It decodes the JWT expiry, schedules a silent refresh a few minutes before
 * the access token lapses, re-evaluates on focus/visibility changes, and
 * notifies the React layer (via onSessionInvalidated) when the session is
 * truly dead.
 *
 * Cross-tab synchronisation is delegated to authSync.ts.
 */
import { getAccessTokenExpiryMs, refreshAuthToken } from '../lib/auth'
import { authBroadcast, authSyncSubscribe } from './authSync'

// ── Configuration ──────────────────────────────────────────────────────

/** Refresh the access token this many ms before expiry. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000

/** Max setTimeout delay — ~24 days, well under the 32-bit cap. */
const MAX_TIMEOUT_MS = 24 * 60 * 60 * 1000

// ── Module-level state (lives for the entire browser tab lifetime) ──────

let refreshTimer: ReturnType<typeof setTimeout> | null = null
let isStarted = false
let invalidationListeners: Array<(reason: string) => void> = []

// Event handler references so we can remove them cleanly.
let boundVisibilityHandler: (() => void) | null = null
let boundFocusHandler: (() => void) | null = null
let boundSyncUnsubscribe: (() => void) | null = null

// ── Internal helpers ───────────────────────────────────────────────────

function clearRefreshTimer() {
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
}

function invalidateSession(reason: string) {
  clearRefreshTimer()
  invalidationListeners.forEach((fn) => {
    try { fn(reason) } catch { /* listener error — don't crash */ }
  })
  authBroadcast('AUTH_LOGGED_OUT')
}

async function attemptRefresh(reason: string) {
  clearRefreshTimer()
  try {
    const newToken = await refreshAuthToken()
    if (newToken) {
      // Refresh succeeded — re-schedule based on the new token's exp.
      scheduleRefresh()
    } else {
      // No refresh token available or refresh returned nothing — session dead.
      invalidateSession(reason === 'scheduled' ? 'refresh_failed' : reason)
    }
  } catch {
    invalidateSession(reason === 'scheduled' ? 'refresh_error' : reason)
  }
}

function scheduleRefresh() {
  clearRefreshTimer()

  const expiryMs = getAccessTokenExpiryMs()
  if (!expiryMs) return // No session — nothing to schedule.

  const now = Date.now()
  const ttl = expiryMs - now

  if (ttl <= 0) {
    // Token already expired — attempt refresh immediately.
    attemptRefresh('expired')
    return
  }

  const delay = Math.max(ttl - REFRESH_MARGIN_MS, 0)
  const cappedDelay = Math.min(delay, MAX_TIMEOUT_MS)

  refreshTimer = setTimeout(() => {
    attemptRefresh('scheduled')
  }, cappedDelay)
}

// ── Lifecycle handlers ─────────────────────────────────────────────────

function onVisibilityChange() {
  if (!document.hidden) {
    scheduleRefresh()
  }
}

function onFocus() {
  scheduleRefresh()
}

function onSyncMessage(msg: { type: string }) {
  if (msg.type === 'AUTH_REFRESHED') {
    // Another tab refreshed tokens — re-read and reschedule.
    scheduleRefresh()
  } else if (msg.type === 'AUTH_LOGGED_OUT') {
    // Another tab logged out — this tab's session is dead too.
    invalidateSession('cross_tab_logout')
  }
}

// ── Public API ─────────────────────────────────────────────────────────

/** Register a callback that fires when the session is truly dead. */
export function onSessionInvalidated(fn: (reason: string) => void): () => void {
  invalidationListeners.push(fn)
  return () => {
    invalidationListeners = invalidationListeners.filter((l) => l !== fn)
  }
}

/** Start the session watchdog. Safe to call multiple times (idempotent). */
export function startSessionWatchdog() {
  if (isStarted) return
  isStarted = true

  // Schedule the first refresh if a session already exists.
  scheduleRefresh()

  // Re-evaluate when the tab becomes visible or gains focus (laptop sleep/wake).
  boundVisibilityHandler = onVisibilityChange
  boundFocusHandler = onFocus
  document.addEventListener('visibilitychange', boundVisibilityHandler)
  window.addEventListener('focus', boundFocusHandler)

  // Cross-tab synchronisation.
  boundSyncUnsubscribe = authSyncSubscribe(onSyncMessage)
}

/** Stop the session watchdog and clean up all listeners. */
export function stopSessionWatchdog() {
  clearRefreshTimer()
  isStarted = false

  if (boundVisibilityHandler) {
    document.removeEventListener('visibilitychange', boundVisibilityHandler)
    boundVisibilityHandler = null
  }
  if (boundFocusHandler) {
    window.removeEventListener('focus', boundFocusHandler)
    boundFocusHandler = null
  }
  if (boundSyncUnsubscribe) {
    boundSyncUnsubscribe()
    boundSyncUnsubscribe = null
  }
}
