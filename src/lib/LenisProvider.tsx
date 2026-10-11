import { useEffect, type ReactNode } from 'react'
import Lenis from 'lenis'

/**
 * Smooth (inertia) scrolling for the whole storefront, powered by Lenis
 * (https://github.com/darkroomengineering/lenis). Lenis replaces the browser's
 * instant wheel/touch displacement with a requestAnimationFrame interpolation
 * loop — the page glides with configurable easing instead of jumping.
 *
 * - Native programmatic scrolls (window.scrollTo, anchor jumps) still work:
 *   Lenis only governs wheel + touch input and syncs to native scroll events.
 * - Route-change scroll-to-top in App.tsx is unaffected.
 * - Inner scrollers (modals, dropdowns, chat drawer, horizontal rails) are
 *   untouched — Lenis only smooths the main document scroll. Mark sections
 *   with `data-lenis-prevent` if they ever need to opt out.
 */

// Module-level handle for the live instance so components can scroll
// programmatically (`getLenis()?.scrollTo(target)`) without prop drilling.
// Null before mount and after unmount.
let liveInstance: Lenis | null = null

export function getLenis() {
  return liveInstance
}

export default function LenisProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const instance = new Lenis({
      lerp: 0.1,
      duration: 1.2,
      smoothWheel: true,
      touchMultiplier: 1.5,
    })
    liveInstance = instance

    let rafId: number
    const raf = (time: number) => {
      instance.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(rafId)
      instance.destroy()
      liveInstance = null
    }
  }, [])

  return <>{children}</>
}
