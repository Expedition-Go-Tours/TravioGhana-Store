import { useSyncExternalStore } from 'react'

/**
 * Tracks a CSS media query with `useSyncExternalStore` — the linter- and
 * production-approved pattern (no sync setState-in-effect, correct SSR
 * snapshot). `fallback` is returned when `window.matchMedia` is unavailable.
 */
export default function useMediaQuery(query: string, fallback = false) {
  const supported = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'

  return useSyncExternalStore(
    (callback) => {
      if (!supported()) return () => {}
      const mq = window.matchMedia(query)
      mq.addEventListener('change', callback)
      return () => mq.removeEventListener('change', callback)
    },
    () => (supported() ? window.matchMedia(query).matches : fallback),
    () => fallback,
  )
}
