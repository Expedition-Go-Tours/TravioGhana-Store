/**
 * Route-chunk warmup for the public support section.
 *
 * The support pages are code-split (see App.tsx). Hovering/focusing any link
 * into the section — or being anywhere in it — fetches the other chunks in
 * the background so navigation never shows the Suspense fallback.
 */
const loaders = [
  () => import('../pages/HelpCentrePage'),
  () => import('../pages/ContactUsPage'),
  () => import('../pages/FAQPage'),
]

let warmed = false

export function prefetchSupportPages() {
  if (warmed) return
  warmed = true
  for (const load of loaders) {
    load().catch(() => {
      /* a failed warmup must never break the app */
    })
  }
}

/** Run the warmup during idle time (falls back to a short timeout). */
export function scheduleSupportPrefetch() {
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  }
  if (typeof idleWindow.requestIdleCallback === 'function') {
    idleWindow.requestIdleCallback(() => prefetchSupportPages(), { timeout: 3000 })
  } else {
    window.setTimeout(prefetchSupportPages, 1200)
  }
}
