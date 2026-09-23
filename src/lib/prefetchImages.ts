import { LIGHTBOX_IMAGE, lightboxImageUrls } from './image'

/**
 * Warm the photo viewer's images as soon as the tour detail page is up, so the
 * first "next" click in "View all photos" paints from cache instead of starting
 * a fresh Cloudinary request.
 *
 * Uses the exact `src`/`srcSet`/`sizes` the viewer will request (see
 * `lightboxImageUrls`), so every prefetch is a guaranteed cache hit, and runs at
 * idle priority so it never competes with the gallery's LCP tile.
 *
 * @returns a cleanup function that cancels a still-pending prefetch.
 */
export function prefetchLightboxImages(sources: (string | null | undefined)[]): () => void {
  const urls = sources.map(lightboxImageUrls).filter((u): u is { src: string; srcSet: string } => u !== null)
  if (typeof window === 'undefined' || urls.length === 0) return () => {}

  // Respect the user's data-saver preference: the viewer still loads on demand.
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (connection?.saveData) return () => {}

  const warm = () => {
    for (const { src, srcSet } of urls) {
      const img = new Image()
      img.decoding = 'async'
      img.sizes = LIGHTBOX_IMAGE.sizes
      img.srcset = srcSet
      img.src = src
    }
  }

  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(warm, { timeout: 1500 })
    return () => window.cancelIdleCallback(handle)
  }

  const timer = window.setTimeout(warm, 800)
  return () => window.clearTimeout(timer)
}
