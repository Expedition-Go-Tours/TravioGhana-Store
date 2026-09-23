import { useSyncExternalStore } from 'react'

/**
 * Tracks a CSS media query with `useSyncExternalStore` — the linter- and
 * production-approved pattern (no sync setState-in-effect, correct SSR
 * snapshot). `fallback` is returned when `window.matchMedia` is unavailable.
 */
export default function useMediaQuery(query: string, fallback = false) {
  return useSyncExternalStore(
    (callback) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', callback)
      return () => mq.removeEventListener('change', callback)
    },
    () => window.matchMedia(query).matches,
    () => fallback,
  )
}
