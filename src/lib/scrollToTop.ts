import { getLenis } from './LenisProvider'

/**
 * Land at the top of the document, even while Lenis is mid-glide.
 *
 * A bare `window.scrollTo(0, 0)` is silently dropped by Lenis when its wheel
 * animation is running: `onNativeScroll` only adopts native positions while
 * `isScrolling` is `false`/`'native'`, and the rAF loop then re-applies the
 * old offset every frame — so navigating right after a flick-scroll left the
 * new page parked mid-list (the homepage→/tours mood-card repro).
 *
 * Driving Lenis directly (`immediate`) cancels the in-flight animation and
 * syncs its internal `animatedScroll`/`targetScroll` to 0. `force` covers a
 * stopped/locked instance (open modal). The native call stays as the fallback
 * for when Lenis isn't mounted (tests, pre-mount frames).
 */
export function scrollToTop(): void {
  const lenis = getLenis()
  if (lenis) {
    lenis.scrollTo(0, { immediate: true, force: true })
  }
  window.scrollTo(0, 0)
}
