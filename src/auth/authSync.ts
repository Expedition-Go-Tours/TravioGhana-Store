/**
 * Cross-tab authentication synchronisation.
 *
 * Uses BroadcastChannel as the primary mechanism, with the storage event as
 * a fallback for browsers that don't support BroadcastChannel (e.g. older
 * Safari, some embedded WebViews).
 *
 * Only metadata is broadcast — never refresh tokens or user data. Other tabs
 * re-read from localStorage when they receive a message.
 */

type AuthSyncMessage = { type: 'AUTH_REFRESHED' | 'AUTH_LOGGED_OUT' }
type AuthSyncHandler = (msg: AuthSyncMessage) => void

const CHANNEL_NAME = 'expedition_go_auth'
const STORAGE_KEY = 'expedition_go_auth'

let channel: BroadcastChannel | null = null
let listeners: AuthSyncHandler[] = []

try {
  channel = new BroadcastChannel(CHANNEL_NAME)
} catch {
  // BroadcastChannel not supported — storage event fallback covers us.
}

// ── BroadcastChannel listener (primary) ────────────────────────────────
channel?.addEventListener('message', (e: MessageEvent<AuthSyncMessage>) => {
  if (e.data?.type) {
    listeners.forEach((fn) => fn(e.data))
  }
})

// ── Storage event listener (fallback for other tabs) ───────────────────
// Fires in other tabs when THIS tab writes to localStorage.
function onStorageEvent(e: StorageEvent) {
  if (e.key !== STORAGE_KEY) return

  if (e.newValue === null) {
    // Another tab cleared auth — log out here too.
    listeners.forEach((fn) => fn({ type: 'AUTH_LOGGED_OUT' }))
  } else if (e.newValue !== e.oldValue) {
    // Another tab updated tokens — re-read and reschedule.
    listeners.forEach((fn) => fn({ type: 'AUTH_REFRESHED' }))
  }
}

// ── Public API ─────────────────────────────────────────────────────────

/** Broadcast an auth event to other tabs. */
export function authBroadcast(type: AuthSyncMessage['type']) {
  const msg: AuthSyncMessage = { type }

  // BroadcastChannel (primary)
  try {
    channel?.postMessage(msg)
  } catch {
    // ignore — channel may be closed in some edge cases
  }

  // Storage event is automatically fired by the browser when we write to
  // localStorage, so other tabs receive it without extra work. But
  // AUTH_LOGGED_OUT is triggered by clearAuth (removeItem) and
  // AUTH_REFRESHED by storeAuth (setItem), both of which fire the storage
  // event natively. No manual dispatch needed.
}

/** Subscribe to auth events from other tabs. Returns an unsubscribe fn. */
export function authSyncSubscribe(handler: AuthSyncHandler): () => void {
  if (listeners.length === 0) {
    // First subscriber — attach the storage listener.
    window.addEventListener('storage', onStorageEvent)
  }

  listeners.push(handler)

  return () => {
    listeners = listeners.filter((fn) => fn !== handler)
    if (listeners.length === 0) {
      window.removeEventListener('storage', onStorageEvent)
    }
  }
}
