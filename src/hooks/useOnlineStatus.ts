import { useSyncExternalStore } from 'react'

/**
 * Tracks browser connectivity through the window `online`/`offline` events.
 *
 * `useSyncExternalStore` is the linter- and production-approved pattern (no
 * sync setState-in-effect, correct SSR snapshot) — same approach as
 * useMediaQuery. `true` is the server snapshot: prerendered HTML should not
 * assume the visitor is offline.
 */
export default function useOnlineStatus() {
  return useSyncExternalStore(
    (callback) => {
      window.addEventListener('online', callback)
      window.addEventListener('offline', callback)
      return () => {
        window.removeEventListener('online', callback)
        window.removeEventListener('offline', callback)
      }
    },
    () => navigator.onLine,
    () => true,
  )
}
