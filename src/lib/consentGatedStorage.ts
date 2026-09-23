/**
 * Storage that only persists when the visitor has agreed to functional cookies.
 *
 * Optional personalisation (wishlist, recent searches, location history…) must
 * not write to the device before consent, and must be removed when consent is
 * refused or withdrawn. But the features still have to *work* — a visitor who
 * hasn't answered the banner yet should still be able to build a wishlist in
 * the current session.
 *
 * So writes land in an in-memory store until consent exists, and are flushed to
 * real storage the moment it is granted. Reads fall back to that memory store
 * for anything the visitor has done this session.
 */

import { hasConsent } from './cookieConsent'
import { FUNCTIONAL_STORAGE_KEYS } from './cookieInventory'

type StorageArea = 'local' | 'session'

/** Values held for the session because functional consent isn't in place yet. */
const pendingWrites = new Map<string, string>()

function backend(area: StorageArea): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return area === 'session' ? window.sessionStorage : window.localStorage
  } catch {
    return null
  }
}

const memoryKey = (area: StorageArea, key: string) => `${area}:${key}`

/**
 * Read an optional value. Returns what the visitor stored earlier only when
 * functional consent is in place; otherwise it returns anything they've set
 * during this session, and never the previously persisted copy.
 */
export function readGated(key: string, area: StorageArea = 'local'): string | null {
  if (hasConsent('functional')) {
    const store = backend(area)
    try {
      const stored = store?.getItem(key)
      if (stored != null) return stored
    } catch {
      /* fall through to memory */
    }
  }
  return pendingWrites.get(memoryKey(area, key)) ?? null
}

/** Write an optional value — persisted only with functional consent. */
export function writeGated(key: string, value: string, area: StorageArea = 'local'): void {
  if (hasConsent('functional')) {
    const store = backend(area)
    try {
      store?.setItem(key, value)
      pendingWrites.delete(memoryKey(area, key))
      return
    } catch {
      /* quota/private mode — keep it in memory so the session still works */
    }
  }
  pendingWrites.set(memoryKey(area, key), value)
}

/** Remove an optional value from both real storage and the session store. */
export function removeGated(key: string, area: StorageArea = 'local'): void {
  pendingWrites.delete(memoryKey(area, key))
  try {
    backend(area)?.removeItem(key)
  } catch {
    /* ignore */
  }
}

/**
 * Move everything held in memory into real storage. Called when functional
 * consent is granted, so a wishlist built before answering the banner survives
 * a reload afterwards.
 */
export function flushGatedMemory(): void {
  if (!hasConsent('functional') || pendingWrites.size === 0) return
  for (const [composite, value] of Array.from(pendingWrites.entries())) {
    const separator = composite.indexOf(':')
    const area = composite.slice(0, separator) as StorageArea
    const key = composite.slice(separator + 1)
    try {
      backend(area)?.setItem(key, value)
      pendingWrites.delete(composite)
    } catch {
      /* leave it in memory; the next successful write will persist it */
    }
  }
}

/**
 * Erase every known optional value. Used when functional consent is refused or
 * withdrawn — the policy commits to making a reasonable effort to remove what
 * was already stored, not merely to stop writing more.
 */
export function purgeFunctionalStorage(): void {
  pendingWrites.clear()
  for (const key of FUNCTIONAL_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
    try {
      window.sessionStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}

/** Test seam — drops session-held values without touching real storage. */
export function resetPendingWrites(): void {
  pendingWrites.clear()
}
