/**
 * Shared performance profile: one place to ask "should this device pay for
 * optional work?" so idle prefetches, map warm-ups and heavy effects all make
 * the same call on mobile/slow connections.
 */

interface NetworkConnection {
  saveData?: boolean
  effectiveType?: string
}

export function getConnection(): NetworkConnection | undefined {
  if (typeof navigator === 'undefined') return undefined
  return (navigator as Navigator & { connection?: NetworkConnection }).connection
}

/** Save-data is on, or the connection is 2G/3G. */
export function prefersReducedData(): boolean {
  const connection = getConnection()
  if (!connection) return false
  if (connection.saveData) return true
  return (
    connection.effectiveType === 'slow-2g' ||
    connection.effectiveType === '2g' ||
    connection.effectiveType === '3g'
  )
}

/** Phone/tablet widths or touch-primary devices (where GPU effects are costliest). */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(max-width: 1023px), (pointer: coarse)').matches
}

/** User asked the OS to reduce motion — decorative animation should be skipped. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Idle prefetches of route chunks should be skipped on constrained networks. */
export function shouldIdlePrefetch(): boolean {
  return !prefersReducedData()
}
